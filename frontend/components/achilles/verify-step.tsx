'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, FileText, Loader2, Network, Play, ShieldCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { OwnershipChallenge } from '@/lib/scan-types'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

type Method = 'file' | 'dns'
type Phase =
  | { kind: 'loading' }
  | { kind: 'ready'; challenge: OwnershipChallenge; lab: boolean }
  | { kind: 'error'; message: string }

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
}: {
  host: string
  target: string
  mode: 'demo' | 'live'
  onVerified: () => void
  onUseDemo: () => void
}) {
  const [method, setMethod] = useState<Method>('file')
  const [authorized, setAuthorized] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [status, setStatus] = useState<'idle' | 'checking' | 'verified'>('idle')
  const [hint, setHint] = useState<string | null>(null)

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
  }, [mode, target])

  async function verify() {
    setStatus('checking')
    setHint(null)
    if (mode === 'demo') {
      setTimeout(() => setStatus('verified'), 1500)
      return
    }
    try {
      const r = await api.verify(target)
      if (r.verified) setStatus('verified')
      else {
        setStatus('idle')
        setHint(r.message || 'We could not find the token yet. DNS can take a few minutes; a file is usually instant.')
      }
    } catch (e) {
      setStatus('idle')
      setHint(e instanceof ApiError ? e.message : 'Verification failed. Try again.')
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="mx-auto max-w-2xl text-center text-muted-foreground" role="status">
        <Loader2 className="mx-auto size-6 animate-spin text-gold" aria-hidden="true" />
        <p className="mt-4 text-sm">Preparing your ownership challenge…</p>
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-critical/40 bg-card p-6 text-center">
        <AlertTriangle className="size-6 text-critical" aria-hidden="true" />
        <p className="text-sm">{phase.message}</p>
        <button
          type="button"
          onClick={onUseDemo}
          className="flex h-10 items-center gap-2 rounded-md bg-gold px-4 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Play className="size-4" aria-hidden="true" /> Show the sample scan instead
        </button>
      </div>
    )
  }

  const { challenge, lab } = phase
  const fileUrl = challenge.methods.well_known_file.urls[0]
  const fileContent = challenge.methods.well_known_file.content
  const dns = challenge.methods.dns_txt
  const builderPrompt = `Create a file at public/.well-known/achilles.txt containing exactly this text and nothing else: ${fileContent}`

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <ShieldCheck className="mx-auto size-8 text-gold" aria-hidden="true" />
        <h1 className="mt-4 font-serif text-3xl font-semibold text-balance">Prove this kingdom is yours</h1>
        <p className="mt-3 text-muted-foreground">
          To keep scanning safe and legal, confirm you own <span className="font-medium text-foreground">{host}</span>.
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card p-6 sm:p-8">
        {lab ? (
          <p className="rounded-md border border-gold/30 bg-gold-soft p-4 text-sm">
            <span className="font-medium text-gold">Lab target.</span> This host is listed as one the scanner owner runs
            themselves, so the ownership check is skipped.
          </p>
        ) : (
          <>
            <div role="radiogroup" aria-label="Verification method" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { id: 'file', icon: FileText, title: 'Well-known file', body: '/.well-known/achilles.txt · easiest for vibe-coded apps' },
                  { id: 'dns', icon: Network, title: 'DNS TXT record', body: 'Best if you control the domain (e.g. GoDaddy)' },
                ] as const
              ).map(({ id, icon: Icon, title, body }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={method === id}
                  onClick={() => setMethod(id)}
                  disabled={status !== 'idle'}
                  className={cn(
                    'flex items-start gap-3 rounded-md border p-4 text-left transition-colors disabled:opacity-60',
                    method === id ? 'border-gold bg-gold-soft' : 'border-border hover:border-gold/40',
                  )}
                >
                  <Icon className={cn('mt-0.5 size-5 shrink-0', method === id ? 'text-gold' : 'text-muted-foreground')} aria-hidden="true" />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{body}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6">
              {method === 'file' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Publish a text file at <span className="font-mono text-foreground">{fileUrl}</span> whose only content is:
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3">
                    <code className="overflow-x-auto whitespace-nowrap font-mono text-sm text-gold">{fileContent}</code>
                    <CopyButton text={fileContent} />
                  </div>
                  <div className="mt-4 rounded-md border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-wider text-gold">Ask your AI builder</p>
                      <CopyButton text={builderPrompt} label="Copy prompt" />
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{builderPrompt}</p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Add a <span className="text-foreground">{dns.type}</span> record named{' '}
                    <span className="font-mono text-foreground">{dns.record_names[1] ?? dns.record_names[0]}</span> (or{' '}
                    <span className="font-mono text-foreground">{dns.record_names[0]}</span>) with this value:
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-4 py-3">
                    <code className="overflow-x-auto whitespace-nowrap font-mono text-sm text-gold">{dns.value}</code>
                    <CopyButton text={dns.value} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">DNS changes can take a few minutes to appear.</p>
                </>
              )}
            </div>

            <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={authorized}
                onChange={(e) => setAuthorized(e.target.checked)}
                disabled={status !== 'idle'}
                className="mt-0.5 size-4 accent-[var(--gold)]"
              />
              I own this app or have written permission to test it.
            </label>
          </>
        )}

        {hint && (
          <p role="alert" className="mt-4 rounded-md border border-medium/40 p-3 text-sm text-muted-foreground">
            {hint}
          </p>
        )}

        <div className="mt-8">
          {status === 'verified' ? (
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
              <p role="status" className="flex items-center gap-2 text-sm text-foreground">
                <span className="flex size-6 items-center justify-center rounded-full bg-gold text-primary-foreground">
                  <Check className="size-3.5" aria-hidden="true" />
                </span>
                {lab ? `Lab target ready: ${host}` : `Ownership verified for ${host}`}
              </p>
              <button
                type="button"
                onClick={onVerified}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground hover:brightness-110 sm:w-auto"
              >
                Begin scan <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={verify}
              disabled={!authorized || status === 'checking'}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-gold px-6 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'checking' ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking {method === 'dns' ? 'DNS' : 'your file'}…
                </>
              ) : (
                'Verify ownership'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
