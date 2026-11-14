'use client'

import { useState } from 'react'
import { ChevronDown, FileText, MapPin, RotateCcw } from 'lucide-react'
import { countBySeverity, findings, securityScore, severityMeta, type Severity } from '@/lib/achilles-data'
import { SeverityBadge } from './severity-badge'
import { CopyButton } from './copy-button'
import { cn } from '@/lib/utils'

export function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-4xl font-semibold text-foreground">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">of 100</span>
      </div>
    </div>
  )
}

const filters: Array<Severity | 'all'> = ['all', 'critical', 'high', 'medium', 'low']

export function ResultsDashboard({
  host,
  onOpenReport,
  onRescan,
}: {
  host: string
  onOpenReport: () => void
  onRescan: () => void
}) {
  const counts = countBySeverity(findings)
  const [filter, setFilter] = useState<Severity | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(findings[0].id)
  const visible = filter === 'all' ? findings : findings.filter((f) => f.severity === filter)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">Security results</p>
          <h1 className="mt-2 font-serif text-3xl font-semibold">{host}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Scanned just now · 14 routes · 9 bundles · 1 database</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onRescan}
            className="flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:border-gold/40 hover:text-foreground"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Rescan
          </button>
          <button
            type="button"
            onClick={onOpenReport}
            className="flex h-10 items-center gap-2 rounded-md bg-gold px-4 text-sm font-semibold text-primary-foreground hover:brightness-110"
          >
            <FileText className="size-4" aria-hidden="true" /> Open report
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-6 rounded-lg border border-border bg-card p-6">
          <ScoreRing score={securityScore} />
          <div className="max-w-[12rem]">
            <p className="font-serif text-lg text-high">Vulnerable</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              One critical flaw puts your entire database at risk. Fix it first.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(Object.keys(counts) as Severity[]).map((s) => (
            <li key={s} className="flex flex-col justify-between rounded-lg border border-border bg-card p-5">
              <span className={cn('text-xs font-medium uppercase tracking-wider', severityMeta[s].text)}>
                {severityMeta[s].label}
              </span>
              <span className="mt-4 font-serif text-4xl font-semibold">{counts[s]}</span>
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="findings-title" className="mt-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="findings-title" className="font-serif text-xl font-semibold">
            Findings
          </h2>
          <div role="tablist" aria-label="Filter by severity" className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs capitalize transition-colors',
                  filter === f ? 'border-gold bg-gold-soft text-gold' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-5 flex flex-col gap-3">
          {visible.map((f) => {
            const open = openId === f.id
            return (
              <li key={f.id} className={cn('rounded-lg border bg-card transition-colors', open ? 'border-gold/40' : 'border-border')}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : f.id)}
                  aria-expanded={open}
                  aria-controls={`${f.id}-panel`}
                  className="flex w-full items-center gap-4 p-5 text-left"
                >
                  <SeverityBadge severity={f.severity} className="hidden shrink-0 sm:inline-flex" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{f.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      <span className="font-serif italic text-gold/80">{f.epithet}</span> · {f.category} · {f.id}
                    </span>
                  </span>
                  <SeverityBadge severity={f.severity} className="shrink-0 sm:hidden" />
                  <ChevronDown
                    className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <div id={`${f.id}-panel`} className="animate-in fade-in border-t border-border px-5 pb-5 pt-4">
                    <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden="true" /> {f.location}
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">What’s wrong</p>
                        <p className="mt-1 text-sm leading-relaxed">{f.summary}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Why it matters</p>
                        <p className="mt-1 text-sm leading-relaxed">{f.impact}</p>
                      </div>
                    </div>
                    <div className="mt-5 rounded-md border border-border bg-background p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium uppercase tracking-wider text-gold">AI fix prompt</p>
                        <CopyButton text={f.fixPrompt} label="Copy prompt" />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.fixPrompt}</p>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
