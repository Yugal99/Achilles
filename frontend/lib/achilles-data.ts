import type { ApiFinding, ApiSeverity, ToolName } from './scan-types'

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Finding = {
  id: string
  title: string
  epithet: string
  severity: Severity
  /** Human label, e.g. "Exposed secret". */
  category: string
  /** Raw scanner category key, e.g. "exposed_secret". */
  categoryKey: string
  location: string
  summary: string
  impact: string
  fixPrompt: string
  /** Who wrote the explanation: an AI provider, or the built-in rule table. */
  source?: 'grok' | 'gemini' | 'claude' | 'rules'
  /** Exactly what the scanner reported. Shown separately from any interpretation. */
  raw: ApiFinding
}

export const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low']

export const severityMeta: Record<
  ApiSeverity,
  { label: string; text: string; bg: string; soft: string; ring: string; hex: string; rank: number }
> = {
  critical: { label: 'Critical', text: 'text-critical', bg: 'bg-critical', soft: 'bg-critical/8', ring: 'border-critical/30', hex: '#b42318', rank: 4 },
  high: { label: 'High', text: 'text-high', bg: 'bg-high', soft: 'bg-high/8', ring: 'border-high/30', hex: '#c4410a', rank: 3 },
  medium: { label: 'Medium', text: 'text-medium', bg: 'bg-medium', soft: 'bg-medium/8', ring: 'border-medium/30', hex: '#d08a1a', rank: 2 },
  low: { label: 'Low', text: 'text-low', bg: 'bg-low', soft: 'bg-low/8', ring: 'border-low/30', hex: '#1d6fa8', rank: 1 },
  info: { label: 'Info', text: 'text-info', bg: 'bg-info', soft: 'bg-info/8', ring: 'border-info/30', hex: '#8a99a6', rank: 0 },
}

/** Labels for the scanner's Category enum (backend-a/app/models.py). */
export const CATEGORY_LABEL: Record<string, string> = {
  exposed_secret: 'Exposed secret',
  exposed_file: 'Exposed file',
  open_port: 'Open port',
  tls: 'TLS / certificate',
  headers: 'Security headers',
  cors: 'CORS policy',
  misconfig: 'Misconfiguration',
  vulnerability: 'Known vulnerability',
  tech: 'Technology',
}
export const categoryLabel = (key: string) => CATEGORY_LABEL[key] ?? key.replace(/_/g, ' ')

/** The five tools the scanner really runs, with what each one checks. */
export const TOOLS: Array<{ key: ToolName; name: string; checks: string }> = [
  { key: 'nmap', name: 'Nmap', checks: 'Port scan: databases, admin panels and dev servers left open' },
  { key: 'httpx', name: 'httpx', checks: 'Fingerprints the tech stack so later checks know what to look for' },
  { key: 'nuclei', name: 'Nuclei', checks: 'Curated templates: exposed .env/.git, debug pages, open CORS, known CVEs' },
  { key: 'testssl', name: 'testssl.sh', checks: 'TLS protocols and certificate health' },
  { key: 'jscheck', name: 'JS & header check', checks: 'Secrets in client JavaScript and missing security headers' },
]
export const toolName = (key: string) => TOOLS.find((t) => t.key === key)?.name ?? key

export function countBySeverity(list: Finding[]) {
  return list.reduce(
    (acc, f) => {
      acc[f.severity] += 1
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  )
}

/** Display host plus the full target (scheme + port kept) that is sent to the scanner. */
export function parseTarget(input: string): { host: string; target: string } | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('.') || url.hostname.endsWith('.')) return null
    const host = url.hostname.replace(/^www\./, '')
    return { host, target: `${url.protocol}//${url.host}` }
  } catch {
    return null
  }
}
