'use client'

import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { severityMeta } from '@/lib/achilles-data'
import { formatWhen } from '@/lib/insights'
import type { ScanStatusView } from '@/lib/scan-types'
import { cn } from '@/lib/utils'

const OPENABLE = ['completed', 'partial']
const GRADE_TONE: Record<string, string> = {
  A: 'border-success text-success',
  B: 'border-success text-success',
  C: 'border-medium text-medium',
  D: 'border-high text-high',
  F: 'border-critical text-critical',
}

/** A compact list of earlier scans of one host, each openable as a full report. */
export function ScanHistoryList({
  scans,
  currentId,
  onOpen,
  max = 8,
}: {
  scans: ScanStatusView[]
  currentId?: string
  onOpen: (scanId: string) => Promise<void> | void
  max?: number
}) {
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function open(id: string) {
    setOpening(id)
    setError(null)
    try {
      await onOpen(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load that report.')
    } finally {
      setOpening(null)
    }
  }

  return (
    <div>
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {scans.slice(0, max).map((s) => {
          const current = s.scan_id === currentId
          const ok = OPENABLE.includes(s.status)
          const b = s.summary.by_severity
          return (
            <li key={s.scan_id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', current && 'bg-surface-selected')}>
              <span
                className={cn(
                  'font-display flex size-9 shrink-0 items-center justify-center rounded-md border bg-background text-sm font-semibold',
                  ok ? GRADE_TONE[s.summary.grade] : 'border-border text-muted-foreground',
                )}
                aria-label={ok ? `Grade ${s.summary.grade}` : s.status}
              >
                {ok ? s.summary.grade : '–'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {formatWhen(s.finished_at ?? s.created_at)}
                  {current && <span className="ml-2 text-xs font-semibold text-primary">Viewing</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ok ? (
                    (['critical', 'high', 'medium', 'low'] as const).map((k, i) => (
                      <span key={k}>
                        {i > 0 && ' · '}
                        <span className={b[k] ? severityMeta[k].text : undefined}>
                          {b[k]} {severityMeta[k].label.toLowerCase()}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="capitalize">{s.status}{s.error ? `: ${s.error}` : ''}</span>
                  )}
                </p>
              </div>
              {ok && !current && (
                <button
                  type="button"
                  onClick={() => open(s.scan_id)}
                  disabled={!!opening}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-sm border border-accent px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                >
                  {opening === s.scan_id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  View report
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {scans.length > max && <p className="mt-2 text-xs text-muted-foreground">Showing the {max} most recent of {scans.length} scans.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  )
}
