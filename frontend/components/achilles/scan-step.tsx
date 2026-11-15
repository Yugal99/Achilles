'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Clock, Minus, Play, Square, XCircle } from 'lucide-react'
import { api, ApiError, type ScanProfile } from '@/lib/api'
import { demoScan } from '@/lib/demo-scan'
import { TOOLS } from '@/lib/achilles-data'
import { actionableCount } from '@/lib/insights'
import { TERMINAL, type ScanResult, type ToolName, type ToolRun, type ToolStatus } from '@/lib/scan-types'
import { btn, Notice, Panel, SampleTag, StepHeading } from './kit'
import { GODS, GODS_BY_TOOL, type God } from '@/lib/pantheon'
import { Pennant, type PennantState } from './motifs'
import { cn } from '@/lib/utils'

type LogLine = { text: string; kind: 'info' | 'flag' | 'done' }
type View = {
  scanId: string | null
  queuePosition: number | null
  progress: number
  tools: Partial<Record<ToolName, ToolRun>>
  done: boolean
  log: LogLine[]
  flagged: number
  error: { message: string; back?: 'verify' } | null
  cancelled: boolean
  result: ScanResult | null
}

const EMPTY: View = { scanId: null, queuePosition: null, progress: 0, tools: {}, done: false, log: [], flagged: 0, error: null, cancelled: false, result: null }

const finished = (s?: ToolStatus) => !!s && !['pending', 'running'].includes(s)

function toolLines(prev: Partial<Record<ToolName, ToolStatus>>, tools: Partial<Record<ToolName, ToolRun>>): LogLine[] {
  const lines: LogLine[] = []
  for (const t of TOOLS) {
    const run = tools[t.key]
    if (!run || prev[t.key] === run.status) continue
    prev[t.key] = run.status
    if (run.status === 'running') lines.push({ text: `${t.name}: started`, kind: 'info' })
    else if (finished(run.status))
      lines.push({
        text: `${t.name}: ${run.message || run.status}${run.duration_s ? ` (${run.duration_s.toFixed(1)}s)` : ''}`,
        kind: run.status === 'ok' || run.status === 'skipped' ? 'info' : 'flag',
      })
  }
  return lines
}

/** Offline replay of the bundled sample scan: each tool starts at once and finishes after its recorded duration (time-compressed). */
function useDemoReplay(enabled: boolean): View {
  const SPEED = 12 // 1 replay second = 12 recorded seconds
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setElapsed((t) => t + 0.1), 100)
    return () => clearInterval(id)
  }, [enabled])
  if (!enabled) return EMPTY
  const t = elapsed * SPEED
  const tools: Partial<Record<ToolName, ToolRun>> = {}
  for (const k of TOOLS) {
    const real = demoScan.tools[k.key]
    tools[k.key] = t >= (real.duration_s ?? 0) ? real : { ...real, status: 'running', duration_s: null, message: '' }
  }
  const log: LogLine[] = TOOLS.filter((k) => demoScan.tools[k.key].status !== 'skipped').map((k) => ({ text: `${k.name}: started`, kind: 'info' as const }))
  for (const k of [...TOOLS].sort((a, b) => (demoScan.tools[a.key].duration_s ?? 0) - (demoScan.tools[b.key].duration_s ?? 0))) {
    const run = tools[k.key]!
    if (finished(run.status)) log.push({ text: `${k.name}: ${run.message}${run.duration_s != null ? ` (${run.duration_s.toFixed(1)}s)` : ''}`, kind: run.findings_count ? 'flag' : 'info' })
  }
  const doneCount = TOOLS.filter((k) => finished(tools[k.key]?.status)).length
  const done = doneCount === TOOLS.length
  if (done) log.push({ text: `Report ready · ${actionableCount(demoScan)} findings`, kind: 'done' })
  return {
    ...EMPTY,
    scanId: demoScan.scan_id,
    progress: Math.round((100 * doneCount) / TOOLS.length),
    tools,
    done,
    log,
    flagged: done ? actionableCount(demoScan) : 0,
    result: done ? demoScan : null,
  }
}

/** Starts a real scan through the proxy and polls until it reaches a terminal state. */
function useLiveScan(enabled: boolean, target: string, profile: ScanProfile): View & { cancel: () => Promise<void> } {
  const [view, setView] = useState<View>({ ...EMPTY, log: [{ text: `Requesting a scan of ${target}`, kind: 'info' }] })
  const startRef = useRef<Promise<{ scan_id: string; joined?: boolean }> | null>(null)
  const idRef = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const seen: Partial<Record<ToolName, ToolStatus>> = {}
    let lastTotal = 0
    let failures = 0
    let queuedLogged = false

    const fail = (e: unknown) => {
      const message = e instanceof Error ? e.message : 'The scan failed.'
      setView((v) => ({
        ...v,
        error: { message, back: e instanceof ApiError && e.code === 'ownership_not_verified' ? 'verify' : undefined },
      }))
    }

    async function run() {
      let scanId: string
      try {
        // One start request per mount, even if React re-runs this effect (StrictMode in dev).
        startRef.current ??= api.startScan(target, profile)
        const started = await startRef.current
        scanId = started.scan_id
        idRef.current = scanId
        const accepted = started.joined ? `Joined scan ${scanId}, which was already in progress` : `Scan ${scanId} accepted`
        setView((v) => (v.scanId ? v : { ...v, scanId, log: [...v.log, { text: accepted, kind: 'info' }] }))
      } catch (e) {
        return fail(e)
      }
      while (!cancelled) {
        try {
          const s = await api.status(scanId)
          failures = 0
          const lines = toolLines(seen, s.tools)
          if (s.status === 'queued' && !queuedLogged) {
            queuedLogged = true
            lines.push({ text: `Waiting in line (position ${s.queue_position ?? 1}). Another scan is using the scanner.`, kind: 'flag' })
          }
          const nonInfo = actionableCount(s)
          if (nonInfo > lastTotal) {
            lines.push({ text: `${nonInfo} finding${nonInfo === 1 ? '' : 's'} so far`, kind: 'flag' })
            lastTotal = nonInfo
          }
          setView((v) => ({
            ...v,
            progress: s.progress,
            queuePosition: s.status === 'queued' ? s.queue_position : null,
            flagged: nonInfo,
            tools: s.tools,
            log: [...v.log, ...lines],
          }))
          if (TERMINAL.includes(s.status)) {
            if (s.status === 'cancelled') return setView((v) => ({ ...v, cancelled: true }))
            if (s.status === 'failed') return fail(new Error(s.error || 'The scan failed.'))
            const result = await api.results(scanId)
            if (cancelled) return
            setView((v) => ({
              ...v,
              progress: 100,
              done: true,
              result,
              log: [...v.log, { text: `Report ready · ${actionableCount(result)} findings`, kind: 'done' }],
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
  }, [enabled, target, profile])

  async function cancel() {
    if (!idRef.current) return
    try {
      await api.cancel(idRef.current)
      setView((v) => ({ ...v, log: [...v.log, { text: 'Cancellation requested', kind: 'flag' }] }))
    } catch (e) {
      setView((v) => ({ ...v, log: [...v.log, { text: e instanceof Error ? e.message : 'Could not cancel', kind: 'flag' }] }))
    }
  }

  return enabled ? { ...view, cancel } : { ...EMPTY, cancel }
}

function useElapsed(running: boolean) {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now() - s * 1000
    const id = setInterval(() => setS(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  return s
}

export function ScanStep({
  host,
  target,
  mode,
  profile,
  scannerFake,
  onComplete,
  onBack,
  onUseDemo,
}: {
  host: string
  target: string
  mode: 'demo' | 'live'
  profile: ScanProfile
  scannerFake: boolean
  onComplete: (result: ScanResult) => void
  onBack: () => void
  onUseDemo: () => void
}) {
  const demo = useDemoReplay(mode === 'demo')
  const live = useLiveScan(mode === 'live', target, profile)
  const deep = mode === 'live' && profile === 'deep'
  const v = mode === 'demo' ? demo : live
  const active = !v.done && !v.error && !v.cancelled
  const elapsed = useElapsed(active)
  const logRef = useRef<HTMLDivElement>(null)
  const doneCount = TOOLS.filter((t) => finished(v.tools[t.key]?.status)).length

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [v.log.length])

  const heading = v.error ? 'The trial was cut short' : v.cancelled ? 'The trial was called off' : v.done ? 'The trial is over' : 'The trial'
  const sub = v.error
    ? `The scan could not finish. ${v.error.message}`
    : v.cancelled
      ? 'Scan cancelled. No report was produced. You can start again whenever you like.'
      : v.done
        ? `Scan complete. ${v.flagged} actionable finding${v.flagged === 1 ? '' : 's'}${v.result?.status === 'partial' ? ' · some checks were cut short' : ''}.`
        : v.queuePosition
          ? `Waiting in line at position ${v.queuePosition}. Another scan is using the scanner, and this one starts when it finishes.`
          : `${deep ? 'Deep scan' : 'Scan'} in progress. Achilles is running ${TOOLS.length} checks against ${host}.`

  // One pennant per scanner, under the god it runs for. Ownership is already proven by this step, so it has no pennant.
  const flags: Array<{ god: God; scanner: string; state: StageState }> = TOOLS.flatMap((t) =>
    GODS_BY_TOOL[t.key].map((id) => ({ god: GODS[id], scanner: t.name, state: stageOf(v.tools[t.key]?.status) })),
  )

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <StepHeading eyebrow="The gods at work" title={heading} plain={<span aria-live="polite">{sub}</span>} />
        {mode === 'demo' && <SampleTag className="self-start">Sample replay · canned data</SampleTag>}
      </div>

      {mode === 'live' && scannerFake && (
        <Notice tone="warn" className="mt-6">
          <b>Scanner is in fake mode.</b> It returns canned results instead of running the real tools, so this report does
          not describe {host}.
        </Notice>
      )}

      {active && v.queuePosition != null && (
        <Notice tone="warn" className="mt-6">
          <b>Not started yet.</b> The scanner runs a limited number of scans at a time and another one is ahead of this.
          A deep scan ahead can take an hour or more. To stop a scan you started earlier, begin the same scan again to
          rejoin it, then cancel it here.
        </Notice>
      )}

      {deep && active && v.queuePosition == null && (
        <Notice className="mt-6">
          <b>Deep scan.</b> Every check runs until it finishes, which can take an hour or more. You can leave this page.
          The scan keeps running, and the finished report shows up under earlier scans of {host}.
        </Notice>
      )}

      {v.error || v.cancelled ? (
        <Panel className="mt-8 flex flex-col items-center gap-3 p-6 text-center">
          {v.error ? <AlertTriangle className="size-6 text-critical" aria-hidden="true" /> : <XCircle className="size-6 text-muted-foreground" aria-hidden="true" />}
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onBack} className={btn.secondary}>
              {v.error?.back === 'verify' ? 'Back to verification' : 'Back'}
            </button>
            <button type="button" onClick={onUseDemo} className={btn.primary}>
              <Play className="size-4" aria-hidden="true" /> View the sample scan
            </button>
          </div>
        </Panel>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Checks finished" value={`${doneCount} / ${TOOLS.length}`} />
            <Stat label="Elapsed" value={`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`} icon={Clock} />
            <Stat label="Actionable findings so far" value={String(v.flagged)} />
          </div>
          <PennantRow progress={v.progress} flags={flags} label={`${doneCount} of ${TOOLS.length} checks finished`} />

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <Panel className="p-5">
              <h2 className="text-base font-semibold text-foreground">Stages</h2>
              <ol className="relative mt-4">
                <Stage state="done" title="Ownership confirmed" detail={host} />
                <Stage
                  state={v.scanId ? 'done' : 'active'}
                  title={v.queuePosition ? `Queued (position ${v.queuePosition})` : 'Scan accepted'}
                  detail={v.scanId ?? 'Waiting for the scanner'}
                />
                {TOOLS.map((t) => {
                  const run = v.tools[t.key]
                  const st = run?.status ?? 'pending'
                  return (
                    <Stage
                      key={t.key}
                      state={stageOf(st)}
                      title={t.name}
                      detail={run?.message || t.checks}
                      meta={run?.duration_s != null ? `${run.duration_s.toFixed(1)}s` : st === 'running' ? 'running' : undefined}
                    />
                  )
                })}
                <Stage last state={v.done ? 'done' : 'pending'} title="Report assembled" detail="Findings normalized, scored and explained" />
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                {deep
                  ? `The ${TOOLS.length} checks run in parallel with no time limit. Cancel the scan to stop early.`
                  : `The ${TOOLS.length} checks run in parallel, each with a hard time limit.`}
              </p>
            </Panel>

            <Panel className="flex flex-col overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
                <span className="truncate font-mono">event log · {host}</span>
                <span className="flex items-center gap-1.5">
                  <span className={cn('size-1.5 rounded-full', v.done ? 'bg-success' : 'animate-pulse bg-accent')} aria-hidden="true" />
                  {v.done ? 'Complete' : 'Live'}
                </span>
              </div>
              <div ref={logRef} className="h-80 overflow-y-auto bg-background p-4 font-mono text-xs leading-6" aria-label="Scan event log" tabIndex={0}>
                {v.log.map((line, i) => (
                  <p key={i} className={cn(line.kind === 'flag' ? 'text-high' : line.kind === 'done' ? 'font-semibold text-success' : 'text-foreground/90')}>
                    <span className="text-accent select-none">› </span>
                    {line.text}
                  </p>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mt-8 flex flex-col-reverse justify-between gap-3 sm:flex-row">
            {mode === 'live' && active ? (
              <button type="button" onClick={live.cancel} disabled={!v.scanId} className={btn.secondary}>
                <Square className="size-3.5" aria-hidden="true" /> Cancel scan
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => v.result && onComplete(v.result)} disabled={!v.done || !v.result} className={btn.primary}>
              View results <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

type StageState = 'done' | 'active' | 'pending' | 'warn' | 'skipped'

const stageOf = (st: ToolStatus = 'pending'): StageState =>
  st === 'ok' ? 'done' : st === 'skipped' ? 'skipped' : st === 'running' ? 'active' : st === 'pending' ? 'pending' : 'warn'

const dot = (state: StageState) =>
  cn(
    'rounded-full border transition-colors duration-500',
    state === 'done' && 'border-accent bg-accent',
    state === 'active' && 'border-accent bg-background',
    state === 'warn' && 'border-critical bg-critical',
    (state === 'pending' || state === 'skipped') && 'border-line-strong bg-background',
  )

const PENNANT_STATE: Record<StageState, PennantState> = { done: 'done', active: 'running', pending: 'waiting', skipped: 'waiting', warn: 'warn' }
const STATE_LABEL: Record<StageState, string> = { done: 'done', active: 'running', pending: 'waiting', skipped: 'skipped', warn: 'cut short' }

/** One pennant per check: dimmed while waiting, full color while running, check-marked when done. The real scanner name sits under each. */
function PennantRow({ progress, flags, label }: { progress: number; flags: Array<{ god: God; scanner: string; state: StageState }>; label: string }) {
  return (
    <Panel className="mt-4 p-5">
      <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1 w-full bg-surface-selected">
        <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      <ul className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-x-2 gap-y-5">
        {flags.map(({ god, scanner, state }) => (
          <li key={scanner} className="flex flex-col items-center text-center">
            <Pennant god={god} state={PENNANT_STATE[state]} />
            <span className={cn('font-display mt-1 text-xs font-semibold tracking-[2px] uppercase', state === 'pending' || state === 'skipped' ? 'text-muted-foreground' : 'text-accent')}>{god.name}</span>
            <span className="font-mono text-[11px] leading-tight text-muted-foreground">{scanner}</span>
            {state === 'skipped' || state === 'warn' ? (
              <span className={cn('text-[11px]', state === 'warn' ? 'text-critical' : 'text-muted-foreground')}>{STATE_LABEL[state]}</span>
            ) : (
              <span className="sr-only">: {STATE_LABEL[state]}</span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Clock }) {
  return (
    <Panel className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
      </p>
      <p className="font-display mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</p>
    </Panel>
  )
}

function Stage({ state, title, detail, meta, last }: { state: StageState; title: string; detail: string; meta?: string; last?: boolean }) {
  const label = { done: 'Complete', active: 'In progress', pending: 'Waiting', warn: 'Cut short', skipped: 'Skipped' }[state]
  return (
    <li className="relative grid grid-cols-[1.5rem_1fr_auto] gap-3 pb-4">
      {!last && <span className="absolute top-6 bottom-0 left-3 w-px border-l-2 border-dotted border-line-dotted" aria-hidden="true" />}
      <span
        className={cn(
          dot(state),
          'relative z-10 flex size-6 items-center justify-center',
          state === 'done' && 'text-primary-foreground',
          state === 'active' && 'text-accent',
          state === 'warn' && 'text-primary-foreground',
          (state === 'pending' || state === 'skipped') && 'text-muted-foreground',
        )}
      >
        {state === 'done' ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : state === 'active' ? (
          <span className="size-2 animate-pulse rounded-full bg-accent" />
        ) : state === 'warn' ? (
          <AlertTriangle className="size-3" aria-hidden="true" />
        ) : state === 'skipped' ? (
          <Minus className="size-3" aria-hidden="true" />
        ) : (
          <span className="size-1.5 rounded-full bg-border" />
        )}
        <span className="sr-only">{label}</span>
      </span>
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', state === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>{title}</p>
        <p className="truncate text-xs text-muted-foreground" title={detail}>
          {detail}
        </p>
      </div>
      {meta && <span className="pt-0.5 font-mono text-[11px] text-muted-foreground">{meta}</span>}
    </li>
  )
}
