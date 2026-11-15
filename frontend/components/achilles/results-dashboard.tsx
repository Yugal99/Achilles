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
  MapPin,
  Microscope,
  RotateCcw,
  Search,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react'
import { countBySeverity, severityMeta, SEVERITY_ORDER, toolName, type Finding, type Severity } from '@/lib/achilles-data'
import { securityScoreOf, toUiFindings, verdictOf } from '@/lib/fixes'
import { categoryCounts, compareScans, formatWhen, PROVIDER_LABEL, type TipsState } from '@/lib/insights'
import type { ScanResult, ScanStatusView } from '@/lib/scan-types'
import { ScanHistoryList } from './scan-history'
import { CategoryBars, RiskTrend, SeverityDonut, ToolCoverage } from './charts'
import { CopyButton } from './copy-button'
import { ExportMenu } from './export-menu'
import { btn, EmptyState, Notice, Panel, PanelTitle, SampleTag } from './kit'
import { SeverityBadge } from './severity-badge'
import { cn } from '@/lib/utils'

export function ScoreRing({ score, size = 132, grade }: { score: number; size?: number; grade?: string }) {
  const r = 52
  const c = 2 * Math.PI * r
  const tone = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--medium)' : 'var(--critical)'
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90" width={size} height={size} aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-soft)" strokeWidth="8" />
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
        <span className="text-4xl font-semibold tracking-tight text-navy">{grade ?? score}</span>
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
  const [openId, setOpenId] = useState<string | null>(findings[0]?.id ?? null)
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
    requestAnimationFrame(() => document.getElementById('oracle')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={scan.status} />
            {mode === 'demo' && <SampleTag>Sample report · canned data</SampleTag>}
            <span className="text-xs text-muted-foreground">Profile: {scan.profile}</span>
          </div>
          <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight text-navy sm:text-4xl">{scan.target.host}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Scanned {formatWhen(scan.finished_at ?? scan.created_at)}
            {scan.duration_s ? ` · took ${Math.round(scan.duration_s)}s` : ''} · <span className="font-mono">{scan.scan_id}</span>
          </p>
          {scan.stack.technologies.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Detected technologies">
              {scan.stack.technologies.map((t) => (
                <li key={t} className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-navy">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRescan} className={btn.secondary}>
            <RotateCcw className="size-4" aria-hidden="true" /> Rescan
          </button>
          <button type="button" onClick={onOpenReport} className={btn.primary}>
            <FileText className="size-4" aria-hidden="true" /> Open report deck
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
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

      {/* summary */}
      <section aria-label="Summary" className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_2fr]">
        <Panel className="flex items-center gap-5 p-5">
          <ScoreRing score={securityScoreOf(scan)} grade={scan.summary.grade} />
          <div>
            <p className={cn('text-lg font-semibold', verdict.tone)}>{verdict.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{verdict.text}</p>
            <p className="mt-2 text-xs text-muted-foreground">Risk score {scan.summary.risk_score} (lower is better)</p>
          </div>
        </Panel>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEVERITY_ORDER.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setSev(sev === s ? 'all' : s)
                  document.getElementById('findings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                aria-label={`${counts[s]} ${severityMeta[s].label} findings. Filter list`}
                className={cn(
                  'flex h-full w-full flex-col justify-between rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow] duration-150 hover:shadow-[0_8px_24px_-16px_rgb(16_42_67/0.4)]',
                  sev === s ? 'border-aegean shadow-[0_0_0_3px_rgb(40_126_176/0.12)]' : 'border-border',
                )}
              >
                <span className={cn('flex items-center gap-1.5 text-xs font-semibold', severityMeta[s].text)}>
                  <span className={cn('size-2 rounded-full', severityMeta[s].bg)} aria-hidden="true" />
                  {severityMeta[s].label}
                </span>
                <span className="mt-4 text-3xl font-semibold text-navy tabular-nums">{counts[s]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* charts */}
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
                  <Delta label="New" value={diff.added.length} tone="text-high" />
                  <Delta label="Not detected" value={diff.resolved.length} tone="text-success" />
                  <Delta label="Persistent" value={diff.persistent.length} tone="text-navy" />
                </dl>
                {diff.unconfirmed.length > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-medium">
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

      {/* findings */}
      <section id="findings" aria-labelledby="findings-title" className="mt-10 scroll-mt-24">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="findings-title" className="text-xl font-semibold text-navy">
              Security findings
            </h2>
            <p className="text-sm text-muted-foreground">
              Showing {visible.length} of {findings.length}. Informational stack details are listed in the header.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Search findings</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, location or check"
              className="h-10 w-full rounded-lg border border-border bg-surface-soft/50 pr-3 pl-9 text-sm text-navy placeholder:text-[#8a9bab] focus:border-aegean focus:outline-none"
            />
          </label>
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

        {findings.length === 0 ? (
          <div className="mt-4">
            <EmptyState icon={CheckCircle2} title="No weaknesses found by these checks" body="That covers only what the five tools test. It is not a guarantee the app is secure." />
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No findings match these filters"
              body={
                <button type="button" className="text-primary underline underline-offset-4" onClick={() => (setQuery(''), setSev('all'), setCat('all'))}>
                  Clear filters
                </button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
            {visible.map((f) => (
              <FindingRow
                key={f.id}
                f={f}
                open={openId === f.id}
                isNew={!!diff?.added.some((a) => a.id === f.id)}
                onToggle={() => setOpenId(openId === f.id ? null : f.id)}
                onRemediate={() => select(f.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* oracle */}
      {selected && (
        <RemediationPanel finding={selected} findings={findings} tipsState={tipsState} mode={mode} onSelect={setSelectedId} />
      )}

      <div className="mt-10 border-t border-border pt-6">
        <ExportMenu scan={scan} findings={findings} />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: ScanResult['status'] }) {
  const ok = status === 'completed'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold',
        ok ? 'border-success/30 bg-[#eef8f2] text-success' : 'border-medium/30 bg-[#fdf6e9] text-medium',
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <CircleDashed className="size-3.5" aria-hidden="true" />}
      {ok ? 'Scan completed' : status === 'partial' ? 'Partial scan' : status}
    </span>
  )
}

function Delta({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-soft/50 px-2 py-3">
      <dd className={cn('text-2xl font-semibold tabular-nums', tone)}>{value}</dd>
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
    <label className="relative block">
      <span className="sr-only">{label}</span>
      {icon && <ArrowDownUp className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-border bg-card pr-8 text-sm text-navy focus:border-aegean focus:outline-none sm:w-auto',
          icon ? 'pl-8' : 'pl-3',
        )}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </label>
  )
}

function SourceTag({ source }: { source?: Finding['source'] }) {
  const ai = source && source !== 'rules'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', ai ? 'border-aegean/30 bg-sky/50 text-primary' : 'border-border bg-surface-soft text-muted-foreground')}>
      {ai ? <Bot className="size-3" aria-hidden="true" /> : <FileText className="size-3" aria-hidden="true" />}
      {PROVIDER_LABEL[source ?? 'rules']}
    </span>
  )
}

function FindingRow({ f, open, isNew, onToggle, onRemediate }: { f: Finding; open: boolean; isNew: boolean; onToggle: () => void; onRemediate: () => void }) {
  const r = f.raw
  return (
    <li className={cn('rounded-xl border bg-card transition-[border-color,box-shadow] duration-150', open ? 'border-aegean/40 shadow-[0_10px_30px_-20px_rgb(16_42_67/0.45)]' : 'border-border hover:border-aegean/25')}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={`${f.id}-panel`} className="flex w-full items-start gap-3 p-4 text-left sm:items-center sm:p-5">
        <span className={cn('mt-1.5 h-8 w-1 shrink-0 rounded-full sm:mt-0', severityMeta[f.severity].bg)} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={f.severity} />
            <span className="text-xs text-muted-foreground">{f.category}</span>
            {isNew && <span className="rounded-md bg-high/10 px-1.5 py-0.5 text-[11px] font-semibold text-high">New</span>}
          </span>
          <span className="mt-1.5 block font-medium text-navy">{f.title}</span>
          <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{f.location}</span>
        </span>
        <ChevronDown className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 sm:mt-0', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div id={`${f.id}-panel`} className="animate-fade-up grid grid-cols-[minmax(0,1fr)] gap-4 border-t border-border p-4 sm:p-5 lg:grid-cols-3 [&>*]:min-w-0">
          <Block icon={Microscope} title="Observed evidence" note={`Reported by ${toolName(r.tool)}`}>
            <dl className="grid gap-2 text-sm">
              <Row k="Check" v={<span className="font-mono text-xs">{r.check_id}</span>} />
              <Row k="Location" v={<span className="font-mono text-xs break-all">{r.location || '—'}</span>} />
              {r.evidence && <Row k="Evidence" v={<span className="font-mono text-xs break-all">{r.evidence}</span>} />}
              {r.description && <Row k="Scanner note" v={r.description} />}
            </dl>
          </Block>
          <Block icon={Sparkles} title="Interpretation" note={<SourceTag source={f.source} />}>
            <p className="text-sm leading-relaxed text-navy">{f.summary}</p>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">Why it matters</p>
            <p className="mt-1 text-sm leading-relaxed text-navy">{f.impact}</p>
          </Block>
          <Block icon={Wrench} title="Suggested fix" note="Review before applying">
            {r.remediation && <p className="mb-3 text-sm leading-relaxed text-navy">{r.remediation}</p>}
            <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{f.fixPrompt}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={f.fixPrompt} label="Copy fix prompt" variant="solid" />
              <button type="button" onClick={onRemediate} className={btn.ghost}>
                Open in remediation
              </button>
            </div>
          </Block>
        </div>
      )}
    </li>
  )
}

function Block({ icon: Icon, title, note, children }: { icon: typeof Wrench; title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-soft/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-navy uppercase">
          <Icon className="size-3.5 text-primary" aria-hidden="true" /> {title}
        </p>
        {typeof note === 'string' ? <span className="text-[11px] text-muted-foreground">{note}</span> : note}
      </div>
      {children}
    </div>
  )
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{k}</dt>
      <dd className="text-navy">{v}</dd>
    </div>
  )
}

const TARGETS = [
  { id: 'generic', label: 'Any tool', suffix: '' },
  { id: 'cursor', label: 'Cursor', suffix: '\n\nMake the change directly in this repository, then show me the diff and how to test it.' },
  { id: 'v0', label: 'v0', suffix: '\n\nApply this to my v0 project and summarize every file you changed.' },
  { id: 'lovable', label: 'Lovable', suffix: '\n\nApply this to my Lovable project and summarize every file you changed.' },
] as const

function RemediationPanel({
  finding,
  findings,
  tipsState,
  mode,
  onSelect,
}: {
  finding: Finding
  findings: Finding[]
  tipsState: TipsState
  mode: 'demo' | 'live'
  onSelect: (id: string) => void
}) {
  const [target, setTarget] = useState<(typeof TARGETS)[number]['id']>('generic')
  const t = TARGETS.find((x) => x.id === target)!
  const prompt = finding.fixPrompt + t.suffix
  const refs = finding.raw.references.filter((u) => /^https?:\/\//.test(u))

  return (
    <section id="oracle" aria-labelledby="oracle-title" className="mt-12 scroll-mt-24">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        <span className="h-px w-6 bg-gold" aria-hidden="true" /> The Oracle
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="oracle-title" className="text-xl font-semibold text-navy">
          AI-Powered Security Remediation
        </h2>
        <label className="relative block sm:w-80">
          <span className="sr-only">Finding to remediate</span>
          <select
            value={finding.id}
            onChange={(e) => onSelect(e.target.value)}
            className="h-10 w-full appearance-none rounded-lg border border-border bg-card pr-8 pl-3 text-sm text-navy focus:border-aegean focus:outline-none"
          >
            {findings.map((f) => (
              <option key={f.id} value={f.id}>
                [{severityMeta[f.severity].label}] {f.title}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="text-xs text-muted-foreground">{finding.category}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-navy">{finding.title}</h3>
          <p className="mt-2 flex items-start gap-1.5 font-mono text-xs break-all text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {finding.location}
          </p>
          <div className="mt-4 rounded-lg border border-border bg-surface-soft/50 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">Evidence from {toolName(finding.raw.tool)}</p>
            <p className="mt-1 font-mono text-xs break-all text-navy">{finding.raw.evidence || `${finding.raw.check_id} matched at this location`}</p>
          </div>
          <p className="mt-4 text-xs font-semibold text-muted-foreground uppercase">Explanation</p>
          <p className="mt-1 text-sm leading-relaxed text-navy">{finding.summary}</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{finding.impact}</p>
          {finding.raw.remediation && (
            <>
              <p className="mt-4 text-xs font-semibold text-muted-foreground uppercase">Scanner&apos;s suggested correction</p>
              <p className="mt-1 text-sm leading-relaxed text-navy">{finding.raw.remediation}</p>
            </>
          )}
        </Panel>

        <Panel className="flex flex-col p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-navy">Fix prompt</p>
            <div role="radiogroup" aria-label="Format prompt for" className="flex flex-wrap gap-1 rounded-lg bg-surface-soft p-1">
              {TARGETS.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={target === x.id}
                  onClick={() => setTarget(x.id)}
                  className={cn('h-7 rounded-md px-2.5 text-xs font-medium transition-colors', target === x.id ? 'bg-white text-navy shadow-sm' : 'text-muted-foreground hover:text-navy')}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <pre className="mt-3 max-h-64 flex-1 overflow-auto rounded-lg border border-border bg-[#fbfdfe] p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-navy">{prompt}</pre>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <SourceTag source={finding.source} />
            <CopyButton text={prompt} label="Copy prompt" variant="solid" />
          </div>

          <div className="mt-5 grid gap-3 border-t border-border pt-4">
            <Attribution tipsState={tipsState} mode={mode} source={finding.source} />
            {refs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">References from the scanner</p>
                <ul className="mt-1.5 grid gap-1">
                  {refs.slice(0, 4).map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 truncate text-sm text-primary underline-offset-4 hover:underline">
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" /> {u.replace(/^https?:\/\//, '')}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
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
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-aegean" aria-hidden="true" />
      ) : state === 'fail' ? (
        <XCircle className="mt-0.5 size-4 shrink-0 text-medium" aria-hidden="true" />
      ) : (
        <CircleDashed className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span>
        <span className="font-medium text-navy">{label}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </li>
  )
  const tips = tipsState.kind === 'ready' ? tipsState.tips : null
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase">How this fix was produced</p>
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
