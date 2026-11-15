'use client'

import { useMemo, useState } from 'react'
import {
  ArrowDownUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
  Search,
  XCircle,
} from 'lucide-react'
import { countBySeverity, cvssLabel, severityMeta, SEVERITY_ORDER, toolName, type Finding, type Severity } from '@/lib/achilles-data'
import { securityScoreOf, toUiFindings, verdictOf } from '@/lib/fixes'
import { categoryCounts, compareScans, formatWhen, PROVIDER_LABEL, type TipsState } from '@/lib/insights'
import type { ScanResult, ScanStatusView } from '@/lib/scan-types'
import { ScanHistoryList } from './scan-history'
import { CategoryBars, RiskTrend, SeverityDonut, ToolCoverage } from './charts'
import { CopyButton } from './copy-button'
import { ExportMenu } from './export-menu'
import { godFor } from '@/lib/pantheon'
import { Bolt, Owl } from './god-icons'
import { btn, chip, EmptyState, Eyebrow, field, Notice, Panel, PanelTitle, SampleTag } from './kit'
import { MeanderBand } from './motifs'
import { SeverityBadge } from './severity-badge'
import { cn } from '@/lib/utils'

export function ScoreRing({ score, size = 132, grade }: { score: number; size?: number; grade?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const tone = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--accent)' : 'var(--critical)'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-selected)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-semibold text-foreground">{grade ?? score}</span>
        <span className="text-[11px] text-muted-foreground">{grade ? `score ${score}/100` : 'of 100'}</span>
      </div>
    </div>
  )
}

type Sort = 'severity' | 'category' | 'title'

export function ResultsDashboard({
  scan,
  mode,
  scannerFake,
  tipsState,
  history,
  previous,
  onOpenScan,
  onOpenReport,
  onRescan,
}: {
  scan: ScanResult
  mode: 'demo' | 'live'
  scannerFake: boolean
  tipsState: TipsState
  /** Stored scans of this host (newest first), or null while loading. Empty when unavailable. */
  history: ScanStatusView[] | null
  /** Full results of the scan before this one, for the "since last scan" comparison. */
  previous: ScanResult | null
  onOpenScan: (scanId: string) => Promise<void>
  onOpenReport: () => void
  onRescan: () => void
}) {
  const tips = tipsState.kind === 'ready' ? tipsState.tips : null
  const findings = useMemo(() => toUiFindings(scan, tips), [scan, tips])
  const counts = countBySeverity(findings)
  const verdict = verdictOf(scan)
  const cats = categoryCounts(scan)
  const cutShort = Object.entries(scan.tools).filter(([, t]) => ['timeout', 'error', 'not_installed'].includes(t.status))
  const prev = previous
  const diff = prev ? compareScans(prev, scan) : null
  const finished = (history ?? []).filter(
    (h) => ['completed', 'partial'].includes(h.status) && (h.created_at ?? '') <= (scan.created_at ?? ''),
  )
  if (!finished.some((h) => h.scan_id === scan.scan_id)) finished.unshift(scan)
  const trend = finished
    .slice(0, 10)
    .reverse()
    .map((s) => ({ at: s.finished_at ?? s.created_at, risk: s.summary.risk_score, grade: s.summary.grade }))

  const [query, setQuery] = useState('')
  const [sev, setSev] = useState<Severity | 'all'>('all')
  const [cat, setCat] = useState<string>('all')
  const [sort, setSort] = useState<Sort>('severity')
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id ?? null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return findings
      .filter((f) => sev === 'all' || f.severity === sev)
      .filter((f) => cat === 'all' || f.categoryKey === cat)
      .filter((f) => !q || `${f.title} ${f.location} ${f.category} ${f.raw.check_id}`.toLowerCase().includes(q))
      .sort((a, b) =>
        sort === 'severity'
          ? severityMeta[b.severity].rank - severityMeta[a.severity].rank
          : sort === 'category'
            ? a.category.localeCompare(b.category)
            : a.title.localeCompare(b.title),
      )
  }, [findings, query, sev, cat, sort])

  const selected = findings.find((f) => f.id === selectedId) ?? findings[0] ?? null
  const select = (id: string) => {
    setSelectedId(id)
    // On narrow screens the panel sits under the list, so bring it into view.
    if (window.matchMedia('(max-width: 1023px)').matches)
      requestAnimationFrame(() => document.getElementById('oracle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const n = findings.length
  const heading = n === 0 ? 'No weak point found.' : `${NUMBER_WORDS[n] ?? n} weak point${n === 1 ? '' : 's'} found.`
  const lead =
    n === 0
      ? 'These checks found no weaknesses. That covers only what these tools test. It is not a guarantee the app is secure.'
      : counts.critical > 0
        ? n === 1
          ? 'It is the heel. Fix the critical finding first.'
          : `${counts.critical === 1 ? 'One of them is' : `${counts.critical} of them are`} the heel. Start with the critical finding${counts.critical === 1 ? '' : 's'}, then work down.`
        : 'None of them is critical. Work down from the most severe.'

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>The reckoning</Eyebrow>
          <h1 className="mt-4 text-4xl font-bold text-balance text-foreground sm:text-5xl">{heading}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {lead}
            {mode === 'demo' && ' This is illustrative sample data.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className={chip}>{scan.target.host}</span>
            {mode === 'demo' && <SampleTag>Sample</SampleTag>}
            <StatusBadge status={scan.status} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Scanned {formatWhen(scan.finished_at ?? scan.created_at)}
            {scan.duration_s ? ` · took ${Math.round(scan.duration_s)}s` : ''} · profile {scan.profile} · <span className="font-mono">{scan.scan_id}</span>
          </p>
          {scan.stack.technologies.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Detected technologies">
              {scan.stack.technologies.map((t) => (
                <li key={t} className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={onRescan} className={btn.secondary}>
            <RotateCcw className="size-4" aria-hidden="true" /> Rescan
          </button>
          <button type="button" onClick={onOpenReport} className={btn.primary}>
            <FileText className="size-4" aria-hidden="true" /> Open full report
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 empty:hidden">
        {mode === 'live' && scannerFake && (
          <Notice tone="warn">
            <b>Canned results.</b> The scanner is running in fake mode, so these findings were not produced by scanning{' '}
            {scan.target.host}.
          </Notice>
        )}
        {cutShort.length > 0 && (
          <Notice tone="warn">
            <b>Partial report.</b> Some checks were cut short:{' '}
            {cutShort.map(([name, t]) => `${toolName(name)} (${t.message || t.status})`).join(', ')}. Issues those checks
            look for may be missing.
          </Notice>
        )}
      </div>

      {/* severity tiles: click one to filter the list */}
      <ul aria-label="Findings by severity" className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {SEVERITY_ORDER.map((s) => {
          const crit = s === 'critical'
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setSev(sev === s ? 'all' : s)
                  document.getElementById('findings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                aria-pressed={sev === s}
                aria-label={`${counts[s]} ${severityMeta[s].label} findings. Filter list`}
                className={cn(
                  'flex min-h-[116px] w-full items-center justify-between gap-3 rounded-sm border p-5 text-left transition-colors duration-150 sm:p-6',
                  crit ? 'border-critical bg-critical text-primary-foreground' : 'border-border bg-card hover:border-line-strong',
                  sev === s && (crit ? 'outline-2 outline-offset-2 outline-ink' : 'border-accent bg-surface-selected'),
                )}
              >
                <span>
                  <span className={cn('block text-sm font-bold tracking-[1.5px] uppercase', !crit && severityMeta[s].text)}>{severityMeta[s].label}</span>
                  <span className={cn('font-display mt-1 block text-5xl leading-none font-bold tabular-nums', !crit && 'text-foreground')}>{counts[s]}</span>
                </span>
                {crit && <Bolt size={40} className="shrink-0" />}
              </button>
            </li>
          )
        })}
      </ul>

      {/* findings list with the fix panel beside it */}
      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section id="findings" aria-labelledby="findings-title" className="scroll-mt-28">
          <h2 id="findings-title" className="text-xl font-semibold tracking-[2px] text-foreground">
            Findings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Showing {visible.length} of {findings.length}. Select one to see its fix.
          </p>

          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Search findings</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Title, location or check" className={cn(field, 'pr-3 pl-9')} />
              </span>
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <Select label="Severity" value={sev} onChange={(v) => setSev(v as Severity | 'all')} options={[['all', 'All severities'], ...SEVERITY_ORDER.map((s) => [s, severityMeta[s].label] as [string, string])]} />
              <Select label="Category" value={cat} onChange={setCat} options={[['all', 'All categories'], ...cats.map((c) => [c.key, c.label] as [string, string])]} />
              <Select
                label="Sort"
                icon
                value={sort}
                onChange={(v) => setSort(v as Sort)}
                options={[
                  ['severity', 'Most severe first'],
                  ['category', 'Category'],
                  ['title', 'Title A–Z'],
                ]}
              />
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="mt-4">
              <EmptyState icon={CheckCircle2} title="No weak point found." body="These checks found no weaknesses. That covers only what these tools test. It is not a guarantee the app is secure." />
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No findings match these filters"
                body={
                  <button type="button" className="inline-flex min-h-12 items-center text-accent underline underline-offset-4" onClick={() => (setQuery(''), setSev('all'), setCat('all'))}>
                    Clear filters
                  </button>
                }
              />
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2.5">
              {visible.map((f, i) => (
                <FindingRow key={f.id} f={f} selected={selected?.id === f.id} isNew={!!diff?.added.some((a) => a.id === f.id)} delay={Math.min(i, 8) * 50} onSelect={() => select(f.id)} />
              ))}
            </ul>
          )}
        </section>

        {selected && <CounselPanel finding={selected} tipsState={tipsState} mode={mode} onRescan={onRescan} />}
      </div>

      {/* the rest of the report: grade, charts, comparison and history */}
      <MeanderBand className="mt-14" />
      <section aria-labelledby="details-title" className="mt-10">
        <h2 id="details-title" className="text-xl font-semibold tracking-[2px] text-foreground">
          Scan details
        </h2>
        <Panel className="mt-4 flex items-center gap-5 p-5">
          <ScoreRing score={securityScoreOf(scan)} grade={scan.summary.grade} />
          <div>
            <p className={cn('text-lg font-semibold', verdict.tone)}>{verdict.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{verdict.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">Risk score {scan.summary.risk_score} (lower is better)</p>
          </div>
        </Panel>
      <section aria-label="Charts" className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Panel className="p-5">
          <PanelTitle hint="All findings, including informational">Severity distribution</PanelTitle>
          <div className="mt-5">
            <SeverityDonut counts={scan.summary.by_severity} size={136} />
          </div>
        </Panel>
        <Panel className="p-5">
          <PanelTitle hint="Actionable findings by scanner category">Findings by category</PanelTitle>
          <div className="mt-6">
            <CategoryBars data={cats} />
          </div>
        </Panel>
        <Panel className="p-5">
          <PanelTitle hint="Which checks ran, and what each found">Scan coverage</PanelTitle>
          <div className="mt-4">
            <ToolCoverage tools={scan.tools} />
          </div>
        </Panel>
        <Panel className="p-5 lg:col-span-2">
          <PanelTitle hint="Risk score of each stored scan of this host, up to this one">Risk trend</PanelTitle>
          <div className="mt-4">
            <RiskTrend points={trend} />
          </div>
        </Panel>
        <Panel className="p-5">
          <PanelTitle hint={prev ? `Compared with the scan at ${formatWhen(prev.finished_at)}` : 'Matched by stable finding id'}>Since last scan</PanelTitle>
          <div className="mt-4">
            {diff ? (
              <>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <Delta label="New" value={diff.added.length} tone="text-critical" />
                  <Delta label="Not detected" value={diff.resolved.length} tone="text-success" />
                  <Delta label="Persistent" value={diff.persistent.length} tone="text-foreground" />
                </dl>
                {diff.unconfirmed.length > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-accent">
                    {diff.unconfirmed.length} earlier finding{diff.unconfirmed.length === 1 ? '' : 's'} weren&apos;t seen, but the
                    tool that found {diff.unconfirmed.length === 1 ? 'it' : 'them'} didn&apos;t finish this time, so they aren&apos;t counted
                    as resolved.
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  &ldquo;Not detected&rdquo; means the same check ran and no longer reports the issue.
                </p>
              </>
            ) : (
              <EmptyState title="Nothing to compare yet" body="Rescan after applying fixes to see which findings are new, persistent or no longer detected." />
            )}
          </div>
        </Panel>
      </section>

      {mode === 'live' && (
        <Panel className="mt-4 p-5">
          <PanelTitle
            hint="Every stored scan of this host. Open any of them, or rescan to add a new one."
            action={
              <button type="button" onClick={onRescan} className={btn.sm}>
                <RotateCcw className="size-3.5" aria-hidden="true" /> Rescan now
              </button>
            }
          >
            Scan history
          </PanelTitle>
          <div className="mt-4">
            {history === null ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Loading history…
              </p>
            ) : history.length === 0 ? (
              <EmptyState title="No stored history" body="The scanner couldn't return earlier scans for this host." />
            ) : (
              <ScanHistoryList scans={history} currentId={scan.scan_id} onOpen={onOpenScan} />
            )}
          </div>
        </Panel>
      )}
      </section>

      <div className="mt-10 border-t border-border pt-6">
        <ExportMenu scan={scan} findings={findings} />
      </div>
    </div>
  )
}

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty']

function StatusBadge({ status }: { status: ScanResult['status'] }) {
  const ok = status === 'completed'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-xs font-semibold',
        ok ? 'border-line-strong text-muted-foreground' : 'border-accent text-accent',
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <CircleDashed className="size-3.5" aria-hidden="true" />}
      {ok ? 'Scan completed' : status === 'partial' ? 'Partial scan' : status}
    </span>
  )
}

function Delta({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-border bg-background px-2 py-3">
      <dd className={cn('font-display text-2xl font-semibold tabular-nums', tone)}>{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  icon,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<[string, string]>
  icon?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="relative block">
        {icon && <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(field, 'appearance-none pr-8 sm:w-auto', icon ? 'pl-8' : 'pl-3')}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      </span>
    </label>
  )
}

function SourceTag({ source }: { source?: Finding['source'] }) {
  const ai = source && source !== 'rules'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', ai ? 'border-accent text-accent' : 'border-line-strong text-muted-foreground')}>
      {ai ? <Bot className="size-3" aria-hidden="true" /> : <FileText className="size-3" aria-hidden="true" />}
      {PROVIDER_LABEL[source ?? 'rules']}
    </span>
  )
}

function FindingRow({ f, selected, isNew, delay, onSelect }: { f: Finding; selected: boolean; isNew: boolean; delay: number; onSelect: () => void }) {
  const god = godFor({ category: f.categoryKey, tool: f.raw.tool })
  const Icon = god.icon
  return (
    <li className="animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'flex w-full items-center gap-4 rounded-sm border p-4 text-left transition-colors duration-150',
          selected ? 'border-accent bg-surface-selected' : 'border-border bg-card hover:border-line-strong',
        )}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-sm border border-line-strong text-accent">
          <Icon size={28} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">{f.title}</span>
          <span className="mt-1 block font-mono text-xs tracking-wider text-muted-foreground">
            <span className="uppercase">{god.name}</span> · {toolName(f.raw.tool)}
            {isNew && <span className="ml-2 font-sans font-semibold tracking-normal text-critical">New</span>}
          </span>
        </span>
        <SeverityBadge severity={f.severity} />
      </button>
    </li>
  )
}

const TARGETS = [
  { id: 'generic', label: 'Any tool', suffix: '' },
  { id: 'cursor', label: 'Cursor', suffix: '\n\nMake the change directly in this repository, then show me the diff and how to test it.' },
  { id: 'v0', label: 'v0', suffix: '\n\nApply this to my v0 project and summarize every file you changed.' },
  { id: 'lovable', label: 'Lovable', suffix: '\n\nApply this to my Lovable project and summarize every file you changed.' },
] as const

const label = 'text-xs font-bold tracking-[1.5px] text-foreground uppercase'

function CounselPanel({ finding, tipsState, mode, onRescan }: { finding: Finding; tipsState: TipsState; mode: 'demo' | 'live'; onRescan: () => void }) {
  const [target, setTarget] = useState<(typeof TARGETS)[number]['id']>('generic')
  const t = TARGETS.find((x) => x.id === target)!
  const prompt = finding.fixPrompt + t.suffix
  const r = finding.raw
  const refs = r.references.filter((u) => /^https?:\/\//.test(u))

  return (
    <section
      id="oracle"
      aria-labelledby="oracle-title"
      className="scroll-mt-28 rounded-sm border border-border border-t-[3px] border-t-accent bg-card p-5 sm:p-6 lg:sticky lg:top-28 lg:max-h-[calc(100svh-8.5rem)] lg:overflow-y-auto"
    >
      <h2 id="oracle-title" className="flex items-center gap-3 text-sm font-semibold tracking-[3px] text-accent uppercase">
        <Owl size={36} className="shrink-0" /> Counsel of Athena
      </h2>

      <div key={finding.id} className="animate-fade-up">
        <div className="mt-5 flex items-start justify-between gap-3">
          <h3 className="text-xl leading-snug font-semibold text-foreground">{finding.title}</h3>
          <SeverityBadge severity={finding.severity} />
        </div>

        <p className={cn(label, 'mt-6')}>What it means</p>
        <p className="mt-2 leading-relaxed text-muted-foreground">{finding.summary}</p>
        <p className="mt-2 leading-relaxed text-muted-foreground">{finding.impact}</p>

        <p className={cn(label, 'mt-6')}>Evidence</p>
        <div className="mt-2 rounded-sm border border-border bg-background p-4 font-mono text-[13px] leading-relaxed break-all text-foreground">
          <p>{finding.location || r.location}</p>
          <p>{r.evidence || `${r.check_id} matched at this location`}</p>
          {cvssLabel(r) && <p className="mt-2">{cvssLabel(r)}</p>}
          <p className="mt-2 text-xs text-muted-foreground">
            {r.check_id} · reported by {toolName(r.tool)}
          </p>
        </div>
        {r.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.description}</p>}
        {r.remediation && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Scanner&apos;s suggested correction: </span>
            {r.remediation}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <p className={label}>Fix prompt</p>
          <SourceTag source={finding.source} />
        </div>
        <div role="radiogroup" aria-label="Format prompt for" className="mt-2 flex flex-wrap gap-1.5">
          {TARGETS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={target === x.id}
              onClick={() => setTarget(x.id)}
              className={cn(
                'min-h-12 rounded-sm border px-3 text-xs font-semibold transition-colors',
                target === x.id ? 'border-accent bg-surface-selected text-accent' : 'border-line-strong text-muted-foreground hover:text-foreground',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <pre className="mt-2 max-h-72 overflow-auto rounded-sm border border-dashed border-line-dotted p-4 font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">{prompt}</pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <CopyButton text={prompt} label="Copy prompt" variant="solid" />
          <button type="button" onClick={onRescan} className={btn.secondary}>
            Rescan to confirm
          </button>
        </div>

        <div className="mt-6 grid gap-4 border-t border-border pt-5">
          <Attribution tipsState={tipsState} mode={mode} source={finding.source} />
          {refs.length > 0 && (
            <div>
              <p className={label}>References from the scanner</p>
              <ul className="mt-1.5 grid gap-1">
                {refs.slice(0, 4).map((u) => (
                  <li key={u}>
                    <a href={u} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-12 max-w-full items-center gap-1 truncate text-sm text-accent underline-offset-4 hover:underline">
                      <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /> {u.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Attribution({ tipsState, mode, source }: { tipsState: TipsState; mode: 'demo' | 'live'; source?: Finding['source'] }) {
  const step = (label: string, state: 'done' | 'active' | 'skip' | 'fail' | 'na', detail: string) => (
    <li className="flex items-start gap-2.5 text-sm">
      {state === 'done' ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      ) : state === 'active' ? (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-accent" aria-hidden="true" />
      ) : state === 'fail' ? (
        <XCircle className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden="true" />
      ) : (
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span>
        <span className="font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  )
  const tips = tipsState.kind === 'ready' ? tipsState.tips : null
  return (
    <div>
      <p className={label}>How this fix was produced</p>
      <ol className="mt-2 grid gap-2.5">
        {mode === 'demo'
          ? step('Built-in rule library', 'done', 'The sample scan does not call any AI provider.')
          : tipsState.kind === 'loading'
            ? step('Fix generation', 'active', 'Asking the configured AI provider for plain-English fixes…')
            : tipsState.kind === 'error'
              ? step('Fix generation unavailable', 'fail', 'The tips service did not respond. Showing the built-in rule library.')
              : tips && source && source !== 'rules'
                ? step(`Fix generated by ${PROVIDER_LABEL[source]}`, 'done', `Validated against this scan's finding ids before display.`)
                : step('Built-in rule library', 'done', 'No AI provider returned a valid fix, so the offline rules were used.')}
        {tips && tips.attempts.length > 0 && (
          <li className="pl-6.5 text-xs text-muted-foreground">
            Provider attempts:{' '}
            {tips.attempts.map((a, i) => (
              <span key={i}>
                {i > 0 && ' → '}
                {PROVIDER_LABEL[a.provider] ?? a.provider} {a.ok ? '✓' : `✗ (${a.error ?? 'failed'})`}
              </span>
            ))}
          </li>
        )}
        {step('Independent AI cross-check', 'na', 'Not implemented. No second model reviews this fix, so treat it as a suggestion.')}
        {step('Confirmed fixed', 'na', 'Only a rescan can show the scanner no longer detects this issue.')}
      </ol>
    </div>
  )
}
