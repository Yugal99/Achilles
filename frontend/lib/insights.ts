// Derived views over real ScanResults. Nothing here invents data: every number comes from the scan.
import { categoryLabel } from './achilles-data'
import type { ApiSeverity, ScanResult, TipsResponse } from './scan-types'

export const ACTIONABLE: ApiSeverity[] = ['critical', 'high', 'medium', 'low']

/** Actionable findings grouped by scanner category, largest first. */
export function categoryCounts(scan: ScanResult) {
  const m = new Map<string, number>()
  for (const f of scan.findings) if (f.severity !== 'info') m.set(f.category, (m.get(f.category) ?? 0) + 1)
  return [...m.entries()].map(([key, count]) => ({ key, label: categoryLabel(key), count })).sort((a, b) => b.count - a.count)
}

export const actionableCount = (scan: Pick<ScanResult, 'summary'>) => scan.summary.total - scan.summary.by_severity.info

/**
 * Compare two scans of the same host by finding id. The scanner hashes tool+check+location into the
 * id, so the same issue keeps its id across rescans. A finding missing from the newer scan is only
 * "not detected", and only if the tool that found it before finished normally this time.
 */
export function compareScans(prev: ScanResult, next: ScanResult) {
  const act = (s: ScanResult) => s.findings.filter((f) => f.severity !== 'info')
  const before = new Map(act(prev).map((f) => [f.id, f]))
  const after = new Map(act(next).map((f) => [f.id, f]))
  const added = [...after.values()].filter((f) => !before.has(f.id))
  const persistent = [...after.values()].filter((f) => before.has(f.id))
  const gone = [...before.values()].filter((f) => !after.has(f.id))
  const toolOk = (tool: string) => ['ok', 'skipped'].includes(next.tools[tool as keyof ScanResult['tools']]?.status ?? '')
  return {
    added,
    persistent,
    resolved: gone.filter((f) => toolOk(f.tool)),
    unconfirmed: gone.filter((f) => !toolOk(f.tool)),
  }
}

export type TipsState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; tips: TipsResponse }

export const PROVIDER_LABEL: Record<string, string> = { grok: 'Grok (xAI)', gemini: 'Gemini (Google)', claude: 'Claude (Anthropic)', rules: 'Built-in rule library' }

export function formatWhen(iso: string | null) {
  if (!iso) return 'Just now'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
