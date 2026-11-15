'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleDashed, FileText, Globe, History, Loader2, Network, Play, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { OwnershipChallenge, ScanStatusView } from '@/lib/scan-types'
import { ScanHistoryList } from './scan-history'
import { CopyButton } from './copy-button'
import { btn, Notice, Panel, SampleTag } from './kit'
import { cn } from '@/lib/utils'

type Method = 'file' | 'dns'
type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; challenge: OwnershipChallenge; lab: boolean }
  | { kind: 'error'; message: string }
type Status = 'idle' | 'checking' | 'failed' | 'verified'

const DEMO_CHALLENGE: OwnershipChallenge = {
  host: 'vibe-todo.vercel.app',
  token: 'ZhJ8qonZh4E0wJr3nqz7GUjh',
  verified: false,
  methods: {
    dns_txt: {
      record_names: ['vibe-todo.vercel.app', '_achilles.vibe-todo.vercel.app'],
      type: 'TXT',
      value: 'achilles-verify=ZhJ8qonZh4E0wJr3nqz7GUjh',
    },
    well_known_file: {
      urls: ['https://vibe-todo.vercel.app/.well-known/achilles.txt'],
      content: 'ZhJ8qonZh4E0wJr3nqz7GUjh',
    },
  },
}

export function VerifyStep({
  host,
  target,
  mode,
  onVerified,
  onUseDemo,
  onOpenScan,
}: {
  host: string
  target: string
  mode: 'demo' | 'live'
  onVerified: () => void
  onUseDemo: () => void
  /** Open a stored report instead of scanning again. */
  onOpenScan: (scanId: string) => Promise<void>
}) {
  const [method, setMethod] = useState<Method>('file')
  const [authorized, setAuthorized] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [status, setStatus] = useState<Status>('idle')
  const [hint, setHint] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [history, setHistory] = useState<ScanStatusView[] | null>(null)

  // Once ownership is proven, show earlier scans of this host (the scanner refuses before that).
  useEffect(() => {
    if (mode !== 'live' || status !== 'verified' || phase.kind !== 'ready') return
    let cancelled = false
    api
      .hostScans(phase.challenge.host)
      .then((h) => !cancelled && setHistory(h.filter((s) => s.status !== 'queued' && s.status !== 'running')))
      .catch(() => !cancelled && setHistory([]))
    return () => {
      cancelled = true
    }
  }, [mode, status, phase])

  // Live: ask the scanner for this host's token (and whether it is a lab target that skips the check).
  useEffect(() => {
    if (mode === 'demo') {
      setPhase({ kind: 'ready', challenge: DEMO_CHALLENGE, lab: false })
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const c = await api.challenge(target)
        const o = await api.ownership(c.host).catch(() => null)
        if (cancelled) return
        setPhase({ kind: 'ready', challenge: c, lab: !!o?.lab_target })
        if (c.verified || o?.lab_target) setStatus('verified')
      } catch (e) {
        if (!cancelled) setPhase({ kind: 'error', message: e instanceof ApiError ? e.message : 'Something went wrong.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, target, attempt])

  async function verify() {
    setStatus('checking')
    setHint(null)
    if (mode === 'demo') {
      setTimeout(() => setStatus('verified'), 1200)
      return
    }
    try {
      const r = await api.verify(target)
      if (r.verified) setStatus('verified')
      else {
        setStatus('failed')
        setHint(r.message || 'We could not find the token yet. DNS can take a few minutes; a file is usually instant.')
      }
    } catch (e) {
      setStatus('failed')
      setHint(e instanceof ApiError ? e.message : 'Verification failed. Try again.')
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center" role="status">
        <Loader2 className="mx-auto size-6 animate-spin text-aegean" aria-hidden="true" />
        <p className="mt-4 text-sm text-muted-foreground">Requesting a verification token for {host}…</p>
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <Panel className="mx-auto max-w-lg p-6 text-center">
        <XCircle className="mx-auto size-7 text-critical" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold text-navy">Couldn&apos;t start verification</h1>
        <p role="alert" className="mt-1 text-sm text-muted-foreground">
          {phase.message}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => {
              setPhase({ kind: 'loading' })
              setAttempt((a) => a + 1)
            }} className={btn.secondary}>
            <RotateCcw className="size-4" aria-hidden="true" /> Try again
          </button>
          <button type="button" onClick={onUseDemo} className={btn.primary}>
            <Play className="size-4" aria-hidden="true" /> View the sample scan
          </button>
        </div>
      </Panel>
    )
  }

  const { challenge, lab } = phase
  const fileUrl = challenge.methods.well_known_file.urls[0]
  const filePath = (() => {
    try {
      return new URL(fileUrl).pathname
    } catch {
      return '/.well-known/achilles.txt'
    }
  })()
  const fileContent = challenge.methods.well_known_file.content
  const dns = challenge.methods.dns_txt
  const dnsName = dns.record_names[1] ?? dns.record_names[0]
  const builderPrompt = `Create a file at public/.well-known/achilles.txt containing exactly this text and nothing else: ${fileContent}`
  const locked = status === 'checking' || status === 'verified'

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-navy">Verify Your Application</h1>
          <p className="mt-2 text-muted-foreground">
            Before scanning, confirm you own this application or have authorization to test it.
          </p>
        </div>
        {mode === 'demo' && <SampleTag>Sample walkthrough</SampleTag>}
      </div>

      <Panel className="mt-8 flex items-center gap-3 p-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-sky text-primary">
          <Globe className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Target</p>
          <p className="truncate font-mono text-sm font-medium text-navy">{target}</p>
        </div>
        <StatusChip status={status} lab={lab} />
      </Panel>

      {lab ? (
        <Notice className="mt-6">
          <b>Lab target.</b> The scanner operator lists this host as one they run themselves, so the ownership check is
          skipped for it.
        </Notice>
      ) : (
        <>
          <fieldset className="mt-8">
            <legend className="text-sm font-semibold text-navy">Choose a verification method</legend>
            <div role="radiogroup" aria-label="Verification method" className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { id: 'file', icon: FileText, title: 'Well-known file', body: 'Best for apps built with Lovable, Bolt, v0 or Replit.' },
                  { id: 'dns', icon: Network, title: 'DNS TXT record', body: 'Best if you manage the domain’s DNS.' },
                ] as const
              ).map(({ id, icon: Icon, title, body }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={method === id}
                  onClick={() => setMethod(id)}
                  disabled={locked}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow] duration-150 disabled:opacity-60',
                    method === id ? 'border-aegean shadow-[0_0_0_3px_rgb(40_126_176/0.12)]' : 'border-border hover:border-aegean/40',
                  )}
                >
                  <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border', method === id ? 'border-aegean bg-aegean' : 'border-input')}>
                    {method === id && <span className="size-2 rounded-full bg-white" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <Icon className="size-4 text-primary" aria-hidden="true" /> {title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <Panel className="mt-4 p-5 sm:p-6">
            {method === 'file' ? (
              <ol className="grid gap-5">
                <Field n={1} label="Create a file at this exact path">
                  <Value value={filePath} />
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">Full URL: {fileUrl}</p>
                </Field>
                <Field n={2} label="Make its only content this token">
                  <Value value={fileContent} accent />
                </Field>
                <Field n={3} label="Deploy, then verify below">
                  <div className="rounded-lg border border-border bg-surface-soft p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-navy">Using an AI builder? Paste this prompt:</p>
                      <CopyButton text={builderPrompt} label="Copy prompt" />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{builderPrompt}</p>
                  </div>
                </Field>
              </ol>
            ) : (
              <>
                <dl className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                  <dt className="text-sm text-muted-foreground sm:pt-2">Hostname</dt>
                  <dd>
                    <Value value={dnsName} />
                    {dns.record_names.length > 1 && (
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        Or the root: <span className="font-mono">{dns.record_names[0]}</span>
                      </p>
                    )}
                  </dd>
                  <dt className="text-sm text-muted-foreground sm:pt-2">Record type</dt>
                  <dd>
                    <span className="inline-flex h-10 items-center rounded-lg border border-border bg-surface-soft px-3 font-mono text-sm text-navy">{dns.type}</span>
                  </dd>
                  <dt className="text-sm text-muted-foreground sm:pt-2">Value</dt>
                  <dd>
                    <Value value={dns.value} accent />
                  </dd>
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">Add the record at your DNS provider. Changes can take a few minutes to appear.</p>
              </>
            )}
          </Panel>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm text-navy">
            <input
              type="checkbox"
              checked={authorized}
              onChange={(e) => setAuthorized(e.target.checked)}
              disabled={locked}
              className="mt-0.5 size-4 accent-[var(--aegean)]"
            />
            <span>
              I own this application or have written permission to test it.
              <span className="mt-0.5 block text-xs text-muted-foreground">Scanning systems without permission is illegal in most places.</span>
            </span>
          </label>
        </>
      )}

      {hint && (
        <Notice tone="warn" className="mt-4">
          <b>Not verified yet.</b> {hint}
        </Notice>
      )}

      <div className="mt-8">
        {status === 'verified' ? (
          <>
            <div className="flex flex-col gap-4 rounded-xl border border-success/30 bg-[#eef8f2] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p role="status" className="flex items-center gap-2.5 text-sm font-medium text-[#14532d]">
                <span className="flex size-6 items-center justify-center rounded-full bg-success text-white">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {lab ? `Lab target ready: ${host}` : `Ownership verified for ${host}`}
              </p>
              <button type="button" onClick={onVerified} className={btn.primary}>
                {history?.length ? 'Run a new scan' : 'Begin scan'} <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
            {mode === 'live' && history === null && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Looking for earlier scans of {host}…
              </p>
            )}
            {history && history.length > 0 && (
              <Panel className="mt-6 p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <History className="size-4 text-primary" aria-hidden="true" /> You&apos;ve scanned {host} before
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Open an earlier report, or run a new scan to see what changed since.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{history.length} scan{history.length === 1 ? '' : 's'}</span>
                </div>
                <div className="mt-4">
                  <ScanHistoryList scans={history} onOpen={onOpenScan} max={5} />
                </div>
              </Panel>
            )}
          </>
        ) : (
          <button type="button" onClick={verify} disabled={!authorized || status === 'checking'} className={cn(btn.primary, 'w-full')}>
            {status === 'checking' ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking {method === 'dns' ? 'DNS' : 'your file'}…
              </>
            ) : status === 'failed' ? (
              <>
                <RotateCcw className="size-4" aria-hidden="true" /> Check again
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" aria-hidden="true" /> Verify ownership
              </>
            )}
          </button>
        )}
        {!authorized && status === 'idle' && !lab && (
          <p className="mt-2 text-center text-xs text-muted-foreground">Confirm authorization above to continue.</p>
        )}
      </div>
    </div>
  )
}

function StatusChip({ status, lab }: { status: Status; lab: boolean }) {
  const map = {
    idle: { label: 'Pending', cls: 'border-border text-muted-foreground', Icon: CircleDashed },
    checking: { label: 'Checking', cls: 'border-aegean/30 text-aegean', Icon: Loader2 },
    failed: { label: 'Not found', cls: 'border-medium/30 text-medium', Icon: XCircle },
    verified: { label: lab ? 'Lab target' : 'Verified', cls: 'border-success/30 text-success', Icon: Check },
  }[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-semibold', map.cls)}>
      <map.Icon className={cn('size-3.5', status === 'checking' && 'animate-spin')} aria-hidden="true" />
      {map.label}
    </span>
  )
}

function Field({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1.75rem_1fr] gap-3">
      <span className="flex size-7 items-center justify-center rounded-full border border-aegean/30 bg-sky/60 font-mono text-xs font-semibold text-primary">{n}</span>
      <div className="min-w-0">
        <p className="mb-2 text-sm font-medium text-navy">{label}</p>
        {children}
      </div>
    </li>
  )
}

function Value({ value, accent }: { value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-soft py-1.5 pr-1.5 pl-3">
      <code className={cn('min-w-0 overflow-x-auto font-mono text-sm whitespace-nowrap', accent ? 'font-semibold text-primary' : 'text-navy')}>{value}</code>
      <CopyButton text={value} />
    </div>
  )
}
