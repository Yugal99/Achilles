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
}

export const severityMeta: Record<Severity, { label: string; text: string; bg: string; ring: string }> = {
  critical: { label: 'Critical', text: 'text-critical', bg: 'bg-critical', ring: 'border-critical/40' },
  high: { label: 'High', text: 'text-high', bg: 'bg-high', ring: 'border-high/40' },
  medium: { label: 'Medium', text: 'text-medium', bg: 'bg-medium', ring: 'border-medium/40' },
  low: { label: 'Low', text: 'text-low', bg: 'bg-low', ring: 'border-low/40' },
}

export const findings: Finding[] = [
  {
    id: 'ACH-001',
    title: 'Supabase service-role key exposed in client bundle',
    epithet: 'The Open Gate',
    severity: 'critical',
    category: 'Secrets',
    location: '/_next/static/chunks/app/page-8f2c1a.js',
    summary:
      'Your SUPABASE_SERVICE_ROLE_KEY is shipped to every visitor’s browser. This key bypasses all database security rules.',
    impact: 'Anyone can read, edit, or delete every row in your database — including user emails and payments.',
    fixPrompt:
      'My Next.js app exposes SUPABASE_SERVICE_ROLE_KEY in the client bundle. Move every use of the service-role key into server-only code (Route Handlers or Server Actions), import "server-only" in that module, and make the browser client use only NEXT_PUBLIC_SUPABASE_ANON_KEY. Remove any NEXT_PUBLIC_ prefix from the service-role variable, then list the files you changed and remind me to rotate the key in the Supabase dashboard.',
  },
  {
    id: 'ACH-002',
    title: 'Row Level Security disabled on “profiles” table',
    epithet: 'The Unguarded Wall',
    severity: 'high',
    category: 'Database',
    location: 'supabase › public.profiles',
    summary: 'The profiles table has RLS turned off, so any signed-in user can query every other user’s profile.',
    impact: '1,284 user emails, names, and phone numbers are readable by any account.',
    fixPrompt:
      'Enable Row Level Security on the public.profiles table in Supabase. Add policies so a user can SELECT, UPDATE, and DELETE only the row where id = auth.uid(), and INSERT only their own row. Write the SQL migration, explain each policy in one sentence, and update any client queries that relied on reading other users’ profiles.',
  },
  {
    id: 'ACH-003',
    title: 'Admin API route has no authentication check',
    epithet: 'The Trojan Horse',
    severity: 'high',
    category: 'Access control',
    location: 'GET /api/admin/users',
    summary: 'The admin endpoint returns the full user list to anyone who requests it, signed in or not.',
    impact: 'Attackers can enumerate every user and target accounts for phishing or takeover.',
    fixPrompt:
      'My route at app/api/admin/users/route.ts has no auth check. Add a server-side guard that reads the current session, returns 401 if there is no user, and 403 unless the user has role = "admin" in the database. Put the guard in a reusable requireAdmin() helper and apply it to every route under /api/admin.',
  },
  {
    id: 'ACH-004',
    title: 'No rate limiting on login endpoint',
    epithet: 'The Endless Siege',
    severity: 'medium',
    category: 'Authentication',
    location: 'POST /api/auth/login',
    summary: 'The login endpoint accepts unlimited attempts, which makes password-guessing attacks easy.',
    impact: 'Weak passwords can be brute-forced in minutes.',
    fixPrompt:
      'Add rate limiting to POST /api/auth/login: max 5 failed attempts per IP and per email in 15 minutes, returning HTTP 429 with a friendly message. Use Upstash Redis with @upstash/ratelimit, keep the limiter in a separate lib/rate-limit.ts file, and do not reveal whether the email exists.',
  },
  {
    id: 'ACH-005',
    title: 'Missing security headers',
    epithet: 'The Thin Shield',
    severity: 'medium',
    category: 'Configuration',
    location: 'All responses',
    summary: 'Content-Security-Policy, Strict-Transport-Security, and X-Content-Type-Options are not set.',
    impact: 'Makes cross-site scripting and clickjacking attacks easier to pull off.',
    fixPrompt:
      'Add baseline security headers in next.config.mjs via async headers(): X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Strict-Transport-Security: max-age=63072000, X-Frame-Options: SAMEORIGIN, and a Content-Security-Policy-Report-Only starter policy that allows my Supabase URL in connect-src. Explain how to switch to an enforcing CSP later.',
  },
  {
    id: 'ACH-006',
    title: 'Stack traces leaked in API error responses',
    epithet: 'The Loose Tongue',
    severity: 'low',
    category: 'Information disclosure',
    location: 'POST /api/checkout',
    summary: 'Errors return full stack traces, revealing file paths and library versions.',
    impact: 'Gives attackers a map of your internals.',
    fixPrompt:
      'In my API routes, replace responses that return error.stack or error.message with a generic { error: "Something went wrong" } and a 500 status. Log the full error server-side with console.error including a request id, and return that request id to the client so I can debug.',
  },
]

export const scanPhases = [
  { label: 'Charting the coastline', detail: 'Crawling routes and public pages' },
  { label: 'Inspecting the armor', detail: 'Analyzing JavaScript bundles for secrets' },
  { label: 'Testing the gates', detail: 'Probing API routes for access control' },
  { label: 'Sounding the walls', detail: 'Checking database rules and policies' },
  { label: 'Reading the omens', detail: 'Reviewing headers, cookies, and TLS' },
  { label: 'Consulting the oracle', detail: 'AI ranks risks and drafts fixes' },
]

export const scanLog = [
  'GET / → 200 · 14 routes discovered',
  'Found sitemap.xml · 22 URLs queued',
  'Parsing 9 JS chunks (1.4 MB)',
  'Pattern match: eyJhbGciOiJIUzI1Ni… (JWT, role=service_role)',
  'Flagged ACH-001 · secret in client bundle',
  'Probing /api/admin/users without session…',
  'Response 200 · 1,284 records returned',
  'Flagged ACH-003 · missing auth guard',
  'Querying public.profiles with anon role…',
  'Flagged ACH-002 · RLS disabled',
  '20 rapid login attempts → no 429 received',
  'Flagged ACH-004 · no rate limit',
  'Inspecting response headers on 14 routes',
  'Flagged ACH-005 · CSP / HSTS missing',
  'POST /api/checkout malformed body → stack trace',
  'Flagged ACH-006 · verbose errors',
  'Oracle drafting 6 fix prompts…',
  'Scan complete · 6 findings',
]

export const securityScore = 58

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
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (!url.hostname.includes('.')) return null
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
