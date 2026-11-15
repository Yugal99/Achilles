// The canned "finished scan" for the 3-minute demo. Same shape as a real ScanResult, so the
// dashboard, report and exports run through exactly the same code as a live scan.
import type { ApiFinding, ScanResult } from './scan-types'

export const DEMO_HOST = 'vibe-todo.vercel.app'

const f = (x: Partial<ApiFinding> & Pick<ApiFinding, 'id' | 'tool' | 'check_id' | 'title' | 'severity' | 'category' | 'location'>): ApiFinding => ({
  description: '',
  evidence: '',
  remediation: '',
  references: [],
  tags: [],
  ...x,
})

export const demoScan: ScanResult = {
  schema_version: '1.0',
  scan_id: 'scn_demo00000001',
  status: 'completed',
  profile: 'demo',
  target: { input: DEMO_HOST, url: `https://${DEMO_HOST}/`, scheme: 'https', host: DEMO_HOST, port: 443, ips: ['76.76.21.21'] },
  created_at: '2026-11-14T22:00:00Z',
  started_at: '2026-11-14T22:00:01Z',
  finished_at: '2026-11-14T22:01:36Z',
  duration_s: 95,
  queue_position: null,
  progress: 100,
  tools: {
    nmap: { status: 'ok', duration_s: 21.4, timeout_s: 75, findings_count: 0, message: '2 open ports, nothing sensitive' },
    httpx: { status: 'ok', duration_s: 3.1, timeout_s: 25, findings_count: 4, message: 'Next.js, React, Supabase, Vercel' },
    nuclei: { status: 'ok', duration_s: 48.7, timeout_s: 100, findings_count: 2, message: '2 template matches' },
    testssl: { status: 'ok', duration_s: 34.9, timeout_s: 100, findings_count: 0, message: 'TLS 1.2/1.3 only, certificate valid' },
    jscheck: { status: 'ok', duration_s: 9.8, timeout_s: 60, findings_count: 4, message: 'checked 9 scripts, 1 secret' },
    trufflehog: { status: 'ok', duration_s: 12.6, timeout_s: 40, findings_count: 0, message: 'scanned 9 files, no live secrets confirmed' },
    retire: { status: 'ok', duration_s: 7.3, timeout_s: 40, findings_count: 0, message: 'scanned 9 files, no vulnerable libraries' },
    arjun: { status: 'ok', duration_s: 41.2, timeout_s: 100, findings_count: 0, message: 'probed 3 endpoints, no hidden parameters' },
  },
  stack: {
    technologies: ['Next.js', 'React', 'Supabase', 'Vercel'],
    webserver: 'Vercel',
    title: 'Vibe Todo',
    status_code: 200,
    final_url: `https://${DEMO_HOST}/`,
  },
  findings: [
    f({
      id: 'a1c3e5f7b901',
      tool: 'jscheck',
      check_id: 'supabase-service-role-key',
      title: 'Supabase service-role key exposed in client bundle',
      severity: 'critical',
      category: 'exposed_secret',
      location: `https://${DEMO_HOST}/_next/static/chunks/app/page-8f2c1a.js`,
      evidence: 'eyJhbGci…Qx9w (role=service_role)',
      description: 'The service-role key bypasses all database security rules and is shipped to every visitor.',
    }),
    f({
      id: 'b2d4f6a8c012',
      tool: 'nuclei',
      check_id: 'supabase-rls-disabled',
      title: 'Row Level Security disabled on “profiles” table',
      severity: 'high',
      category: 'misconfig',
      location: 'supabase › public.profiles',
      description: 'Any signed-in user can query every other user’s profile.',
    }),
    f({
      id: 'c3e5a7b9d123',
      tool: 'nuclei',
      check_id: 'admin-route-no-auth',
      title: 'Admin API route has no authentication check',
      severity: 'high',
      category: 'misconfig',
      location: `GET https://${DEMO_HOST}/api/admin/users`,
      evidence: 'HTTP 200, 1,284 records returned without a session',
    }),
    f({
      id: 'd4f6b8c0e234',
      tool: 'jscheck',
      check_id: 'no-rate-limit-login',
      title: 'No rate limiting on login endpoint',
      severity: 'medium',
      category: 'misconfig',
      location: `POST https://${DEMO_HOST}/api/auth/login`,
      evidence: '20 rapid attempts, no HTTP 429',
    }),
    f({
      id: 'e5a7c9d1f345',
      tool: 'jscheck',
      check_id: 'missing-csp',
      title: 'Missing Content-Security-Policy and Strict-Transport-Security',
      severity: 'medium',
      category: 'headers',
      location: `https://${DEMO_HOST}/`,
    }),
    f({
      id: 'f6b8d0e2a456',
      tool: 'jscheck',
      check_id: 'verbose-error-stack-trace',
      title: 'Stack traces leaked in API error responses',
      severity: 'low',
      category: 'misconfig',
      location: `POST https://${DEMO_HOST}/api/checkout`,
      evidence: 'Error body contains /var/task/.next/server file paths',
    }),
    f({ id: '07c9e1f3b567', tool: 'httpx', check_id: 'tech-nextjs', title: 'Built with Next.js', severity: 'info', category: 'tech', location: `https://${DEMO_HOST}/` }),
    f({ id: '18d0f2a4c678', tool: 'httpx', check_id: 'tech-supabase', title: 'Built with Supabase', severity: 'info', category: 'tech', location: `https://${DEMO_HOST}/` }),
  ],
  summary: {
    total: 8,
    by_severity: { critical: 1, high: 2, medium: 2, low: 1, info: 2 },
    // Real scorer weights (critical 40, high 20, medium 8, low 3): 40 + 2×20 + 2×8 + 3 = 99.
    risk_score: 99,
    grade: 'F',
  },
  error: '',
}

