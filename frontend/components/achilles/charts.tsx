// Lightweight, dependency-free SVG charts. Each one carries a text equivalent for screen readers
// and labels every value, so nothing depends on color alone.
import { AlertTriangle, Check, Clock, Loader2, Minus } from 'lucide-react'
import { severityMeta, TOOLS } from '@/lib/achilles-data'
import type { ApiSeverity, ScanResult, ToolStatus } from '@/lib/scan-types'
import { cn } from '@/lib/utils'
import { EmptyState } from './kit'

const SEVS: ApiSeverity[] = ['critical', 'high', 'medium', 'low', 'info']

export function SeverityDonut({
  counts,
  size = 168,
  compact = false,
}: {
  counts: Record<ApiSeverity, number>
  size?: number
  compact?: boolean
}) {
  const total = SEVS.reduce((n, s) => n + counts[s], 0)
  const r = 15.9155 // circumference = 100
  let offset = 25
  const segs = SEVS.filter((s) => counts[s] > 0).map((s) => {
    const pct = (counts[s] / total) * 100
    const seg = { s, pct, offset }
    offset -= pct
    return seg
  })
  const summary = SEVS.map((s) => `${severityMeta[s].label} ${counts[s]}`).join(', ')
  return (
    <figure className={cn('flex items-center gap-6', compact ? 'gap-4' : 'flex-col sm:flex-row')}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" width={size} height={size} role="img" aria-label={`${total} findings: ${summary}`}>
          <circle cx="21" cy="21" r={r} fill="none" stroke="var(--surface-soft)" strokeWidth="4.2" />
          {segs.map(({ s, pct, offset: o }) => (
            <circle
              key={s}
              cx="21"
              cy="21"
              r={r}
              fill="none"
              stroke={severityMeta[s].hex}
              strokeWidth="4.2"
              strokeDasharray={`${Math.max(0, pct - (segs.length > 1 ? 0.8 : 0))} ${100 - pct + (segs.length > 1 ? 0.8 : 0)}`}
              strokeDashoffset={o}
              className="transition-[stroke-dasharray] duration-500"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-semibold tracking-tight text-navy tabular-nums', compact ? 'text-2xl' : 'text-4xl')}>{total}</span>
          {!compact && <span className="text-[11px] text-muted-foreground">{total === 1 ? 'finding' : 'findings'}</span>}
        </div>
      </div>
      {!compact && (
        <figcaption className="w-full">
          <ul className="grid gap-1.5">
            {SEVS.map((s) => (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span className="size-2.5 shrink-0 rounded-sm" style={{ background: severityMeta[s].hex }} aria-hidden="true" />
                <span className="flex-1 text-navy">{severityMeta[s].label}</span>
                <span className="font-medium text-navy tabular-nums">{counts[s]}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                  {total ? Math.round((counts[s] / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </figcaption>
      )}
    </figure>
  )
}

export function CategoryBars({ data }: { data: Array<{ key: string; label: string; count: number }> }) {
  if (!data.length) return <EmptyState title="No actionable findings" body="None of the checks reported an issue in any category." />
  const max = Math.max(...data.map((d) => d.count))
  return (
    <ul className="grid gap-3" aria-label="Findings by category">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate text-navy" title={d.label}>
            {d.label}
          </span>
          <span className="h-2.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-aegean to-teal transition-[width] duration-500"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-medium text-navy tabular-nums">{d.count}</span>
        </li>
      ))}
    </ul>
  )
}

const TOOL_STATE: Record<ToolStatus, { label: string; tone: string; Icon: typeof Check }> = {
  ok: { label: 'Completed', tone: 'text-success', Icon: Check },
  skipped: { label: 'Skipped', tone: 'text-muted-foreground', Icon: Minus },
  running: { label: 'Running', tone: 'text-aegean', Icon: Loader2 },
  pending: { label: 'Waiting', tone: 'text-muted-foreground', Icon: Clock },
  timeout: { label: 'Timed out', tone: 'text-medium', Icon: AlertTriangle },
  error: { label: 'Error', tone: 'text-critical', Icon: AlertTriangle },
  not_installed: { label: 'Not installed', tone: 'text-medium', Icon: AlertTriangle },
}

/** Scan coverage = which of the five checks actually ran, how long each took and what it found. */
export function ToolCoverage({ tools }: { tools: ScanResult['tools'] }) {
  const ran = TOOLS.filter((t) => ['ok', 'skipped'].includes(tools[t.key]?.status ?? '')).length
  const maxDur = Math.max(1, ...TOOLS.map((t) => tools[t.key]?.duration_s ?? 0))
  return (
    <div>
      <p className="text-sm text-navy">
        <span className="text-2xl font-semibold tabular-nums">{ran}</span>
        <span className="text-muted-foreground"> of {TOOLS.length} checks finished normally</span>
      </p>
      <ul className="mt-4 grid gap-3">
        {TOOLS.map((t) => {
          const run = tools[t.key]
          const st = TOOL_STATE[run?.status ?? 'pending']
          return (
            <li key={t.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <st.Icon className={cn('size-3.5 shrink-0', st.tone, run?.status === 'running' && 'animate-spin')} aria-hidden="true" />
                <span className="font-medium text-navy">{t.name}</span>
                <span className={cn('text-xs', st.tone)}>{st.label}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {run?.duration_s != null ? `${run.duration_s.toFixed(1)}s` : '—'} · {run?.findings_count ?? 0} found
              </span>
              <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-soft" aria-hidden="true">
                <span
                  className={cn('block h-full rounded-full', run?.status === 'ok' ? 'bg-teal/70' : 'bg-medium/50')}
                  style={{ width: `${((run?.duration_s ?? 0) / maxDur) * 100}%` }}
                />
              </span>
              {run?.message && <span className="col-span-2 -mt-0.5 truncate text-xs text-muted-foreground" title={run.message}>{run.message}</span>}
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Bars show each tool&apos;s run time. Coverage means these checks ran, not that every route or risk was tested.
      </p>
    </div>
  )
}

/** Risk score over completed scans of one host. Needs at least two real scans. */
export function RiskTrend({ points }: { points: Array<{ at: string | null; risk: number; grade: string }> }) {
  if (points.length < 2)
    return (
      <EmptyState
        title="No trend yet"
        body="Rescan this app after making fixes and the risk score of each stored scan will be plotted here."
      />
    )
  const W = 320
  const H = 120
  const pad = 14
  const max = Math.max(10, ...points.map((p) => p.risk))
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1)
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.risk)}`).join(' ')
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Risk score across ${points.length} scans: ${points.map((p) => p.risk).join(', ')}`}>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={pad + t * (H - 2 * pad)} y2={pad + t * (H - 2 * pad)} stroke="var(--border)" strokeDasharray="2 4" />
        ))}
        <path d={`${d} L${x(points.length - 1)},${H - pad} L${x(0)},${H - pad} Z`} fill="var(--sky)" opacity="0.6" />
        <path d={d} fill="none" stroke="var(--aegean)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.risk)} r="3.5" fill="#fff" stroke="var(--aegean)" strokeWidth="2" />
            <text x={x(i)} y={y(p.risk) - 8} textAnchor="middle" className="fill-navy text-[9px] font-semibold">
              {p.risk}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
        {points.map((p, i) => (
          <span key={i}>
            {p.at ? new Date(p.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : `Scan ${i + 1}`} · {p.grade}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
