'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Loader2, Play } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { demoScan, demoScanLog } from '@/lib/demo-scan'
import { scanPhases } from '@/lib/achilles-data'
import { TERMINAL, type ScanResult, type ToolName, type ToolStatus } from '@/lib/scan-types'
import { cn } from '@/lib/utils'

type RowState = 'pending' | 'active' | 'done' | 'warn'
type Row = { key: string; label: string; detail: string; state: RowState }
type LogLine = { text: string; kind: 'info' | 'flag' | 'done' }
type View = {
  progress: number
  done: boolean
  rows: Row[]
  log: LogLine[]
  flagged: number
  error: { message: string; back?: 'verify' } | null
  result: ScanResult | null
}

const TOOL_ROWS: Array<{ key: ToolName; label: string; detail: string }> = [
  { key: 'nmap', label: 'Charting the coastline', detail: 'Port scan: open databases and dev servers' },
  { key: 'httpx', label: 'Reading the omens', detail: 'Detecting your tech stack' },
  { key: 'nuclei', label: 'Testing the gates', detail: 'Exposed files, debug pages, open CORS' },
  { key: 'testssl', label: 'Sounding the walls', detail: 'TLS and certificate health' },
  { key: 'jscheck', label: 'Inspecting the armor', detail: 'Secrets in JavaScript and security headers' },
]

const rowState = (s: ToolStatus): RowState =>
  s === 'ok' || s === 'skipped' ? 'done' : s === 'running' ? 'active' : s === 'pending' ? 'pending' : 'warn'

const EMPTY: View = { progress: 0, done: false, rows: [], log: [], flagged: 0, error: null, result: null }

/** Canned replay of the finished demo scan (offline-safe: used for the 3-minute demo). */
function useDemoReplay(enabled: boolean): View {
  const TOTAL = 9000
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setElapsed((t) => Math.min(TOTAL, t + 100)), 100)
    return () => clearInterval(id)
  }, [enabled])
  if (!enabled) return EMPTY
  const progress = Math.round((elapsed / TOTAL) * 100)
  const done = progress >= 100
  const active = Math.min(scanPhases.length - 1, Math.floor((progress / 100) * scanPhases.length))
  const lines = Math.max(1, Math.ceil((progress / 100) * demoScanLog.length))
  const log = demoScanLog.slice(0, lines).map<LogLine>((text) => ({
    text,
    kind: text.startsWith('Flagged') ? 'flag' : text.startsWith('Scan complete') ? 'done' : 'info',
  }))
  return {
    progress,
    done,
    rows: scanPhases.map((p, i) => ({
      key: p.label,
      label: p.label,
      detail: p.detail,
      state: done || i < active ? 'done' : i === active ? 'active' : 'pending',
    })),
    log,
    flagged: log.filter((l) => l.kind === 'flag').length,
    error: null,
    result: done ? demoScan : null,
  }
}

/** Starts a real scan through the proxy and polls until it reaches a terminal state. */
function useLiveScan(enabled: boolean, target: string): View {
  const [view, setView] = useState<View>({
    ...EMPTY,
    rows: TOOL_ROWS.map((r) => ({ ...r, state: 'pending' })),
    log: [{ text: `Sending the scouts to ${target}…`, kind: 'info' }],
  })
  const startRef = useRef<Promise<{ scan_id: string }> | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let scanId: string | null = null
    const seen: Partial<Record<ToolName, ToolStatus>> = {}
    let lastTotal = 0
    let failures = 0

    const push = (...lines: LogLine[]) => setView((v) => ({ ...v, log: [...v.log, ...lines] }))
    const fail = (e: unknown) => {
      const message = e instanceof Error ? e.message : 'The scan failed.'
      setView((v) => ({
        ...v,
        error: { message, back: e instanceof ApiError && e.code === 'ownership_not_verified' ? 'verify' : undefined },
      }))
    }

    async function run() {
      try {
        // One start request per mount, even if React re-runs this effect (StrictMode in dev).
        startRef.current ??= api.startScan(target, 'demo')
        scanId = (await startRef.current).scan_id
        push({ text: `Scan ${scanId} queued`, kind: 'info' })
      } catch (e) {
        return fail(e)
      }
      while (!cancelled) {
        try {
          const s = await api.status(scanId)
          failures = 0
          const lines: LogLine[] = []
          for (const t of TOOL_ROWS) {
            const run = s.tools[t.key]
            if (!run || seen[t.key] === run.status) continue
            seen[t.key] = run.status
            if (run.status === 'running') lines.push({ text: `${t.key}: started`, kind: 'info' })
            else if (rowState(run.status) !== 'pending')
              lines.push({
                text: `${t.key}: ${run.message || run.status}${run.duration_s ? ` (${run.duration_s.toFixed(1)}s)` : ''}`,
                kind: run.status === 'ok' || run.status === 'skipped' ? 'info' : 'flag',
              })
          }
          const nonInfo = s.summary.total - s.summary.by_severity.info
          if (nonInfo > lastTotal) {
            lines.push({ text: `Flagged · ${nonInfo} weakness${nonInfo === 1 ? '' : 'es'} so far`, kind: 'flag' })
            lastTotal = nonInfo
          }
          setView((v) => ({
            ...v,
            progress: s.progress,
            flagged: nonInfo,
            rows: TOOL_ROWS.map((r) => ({ ...r, state: rowState(s.tools[r.key]?.status ?? 'pending') })),
            log: [...v.log, ...lines],
          }))
          if (TERMINAL.includes(s.status)) {
            if (s.status === 'failed' || s.status === 'cancelled') {
              return fail(new Error(s.error || `The scan ${s.status}.`))
            }
            const result = await api.results(scanId)
            if (cancelled) return
            setView((v) => ({
              ...v,
              progress: 100,
              done: true,
              result,
              log: [...v.log, { text: `Scan complete · ${result.summary.total - result.summary.by_severity.info} findings`, kind: 'done' }],
            }))
            return
          }
        } catch (e) {
          if (++failures >= 5) return fail(e)
        }
        await new Promise((r) => setTimeout(r, 1500))
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [enabled, target])

  return enabled ? view : EMPTY
}

export function ScanStep({
  host,
  target,
  mode,
  onComplete,
  onBack,
  onUseDemo,
}: {
  host: string
  target: string
  mode: 'demo' | 'live'
  onComplete: (result: ScanResult) => void
  onBack: () => void
  onUseDemo: () => void
}) {
  const demo = useDemoReplay(mode === 'demo')
  const live = useLiveScan(mode === 'live', target)
  const v = mode === 'demo' ? demo : live
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [v.log.length])

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center">
        <div className="relative mx-auto size-20" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border border-gold/20" />
          <div className="absolute inset-3 rounded-full border border-gold/30" />
          {!v.done && !v.error && (
            <div className="animate-sweep absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,var(--gold))] opacity-60 [mask:radial-gradient(circle,transparent_55%,black_56%)]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center font-serif text-lg text-gold">{v.progress}%</div>
        </div>
        <h1 className="mt-6 font-serif text-3xl font-semibold text-balance">
          {v.error ? 'The scouts were turned back' : v.done ? 'The scouts have returned' : `Scanning ${host}`}
        </h1>
        <p className="mt-2 text-muted-foreground" aria-live="polite">
          {v.error
            ? v.error.message
            : v.done
              ? `${v.flagged} weakness${v.flagged === 1 ? '' : 'es'} found${v.result?.status === 'partial' ? ' (some checks were cut short)' : ''}.`
              : (v.rows.find((r) => r.state === 'active')?.detail ?? 'Preparing the expedition') + '…'}
        </p>
      </div>

      {v.error ? (
        <div role="alert" className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 rounded-lg border border-critical/40 bg-card p-6 text-center">
          <AlertTriangle className="size-6 text-critical" aria-hidden="true" />
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-10 rounded-md border border-border px-4 text-sm hover:border-gold/40"
            >
              {v.error.back === 'verify' ? 'Back to verification' : 'Back'}
            </button>
            <button
              type="button"
              onClick={onUseDemo}
              className="flex h-10 items-center gap-2 rounded-md bg-gold px-4 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              <Play className="size-4" aria-hidden="true" /> Show the sample scan
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="mt-8 h-1 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={v.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Scan progress"
          >
            <div className="h-full bg-gold transition-[width] duration-300 ease-linear" style={{ width: `${v.progress}%` }} />
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.2fr]">
            <ol className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
              {v.rows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 rounded-md px-2 py-2.5">
                  <span
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full border',
                      row.state === 'done' && 'border-gold bg-gold text-primary-foreground',
                      row.state === 'active' && 'border-gold text-gold',
                      row.state === 'warn' && 'border-medium text-medium',
                      row.state === 'pending' && 'border-border text-muted-foreground',
                    )}
                  >
                    {row.state === 'done' ? (
                      <Check className="size-3.5" aria-hidden="true" />
                    ) : row.state === 'active' ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : row.state === 'warn' ? (
                      <AlertTriangle className="size-3.5" aria-hidden="true" />
                    ) : (
                      <span className="size-1 rounded-full bg-muted-foreground" />
                    )}
                  </span>
                  <span>
                    <span className={cn('block text-sm', row.state === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>
                      {row.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{row.detail}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span className="font-mono">achilles://{host}</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn('size-1.5 rounded-full', v.done ? 'bg-gold' : 'animate-pulse bg-critical')} aria-hidden="true" />
                  {v.done ? 'Complete' : 'Live'}
                </span>
              </div>
              <div ref={logRef} className="h-72 overflow-y-auto p-4 font-mono text-xs leading-6" aria-label="Scan log">
                {v.log.map((line, i) => (
                  <p
                    key={i}
                    className={cn(
                      'animate-in fade-in',
                      line.kind === 'flag' ? 'text-critical' : line.kind === 'done' ? 'text-gold' : 'text-muted-foreground',
                    )}
                  >
                    <span className="text-gold/50">{'› '}</span>
                    {line.text}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => v.result && onComplete(v.result)}
              disabled={!v.done || !v.result}
              className="flex h-11 items-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
            >
              View results <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
