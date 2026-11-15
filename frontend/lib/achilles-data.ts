export type Severity = 'critical' | 'high' | 'medium' | 'low'

export type Finding = {
  id: string
  title: string
  epithet: string
  severity: Severity
  category: string
  location: string
  summary: string
  impact: string
  fixPrompt: string
  /** Who wrote the explanation: an AI provider, or the built-in rule table. */
  source?: 'grok' | 'gemini' | 'claude' | 'rules'
}

export const severityMeta: Record<Severity, { label: string; text: string; bg: string; ring: string }> = {
  critical: { label: 'Critical', text: 'text-critical', bg: 'bg-critical', ring: 'border-critical/40' },
  high: { label: 'High', text: 'text-high', bg: 'bg-high', ring: 'border-high/40' },
  medium: { label: 'Medium', text: 'text-medium', bg: 'bg-medium', ring: 'border-medium/40' },
  low: { label: 'Low', text: 'text-low', bg: 'bg-low', ring: 'border-low/40' },
}

export const scanPhases = [
  { label: 'Charting the coastline', detail: 'Crawling routes and public pages' },
  { label: 'Inspecting the armor', detail: 'Analyzing JavaScript bundles for secrets' },
  { label: 'Testing the gates', detail: 'Probing API routes for access control' },
  { label: 'Sounding the walls', detail: 'Checking database rules and policies' },
  { label: 'Reading the omens', detail: 'Reviewing headers, cookies, and TLS' },
  { label: 'Consulting the oracle', detail: 'AI ranks risks and drafts fixes' },
]

export function countBySeverity(list: Finding[]) {
  return list.reduce(
    (acc, f) => {
      acc[f.severity] += 1
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>,
  )
}

export function normalizeUrl(input: string) {
  return parseTarget(input)?.host ?? null
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
