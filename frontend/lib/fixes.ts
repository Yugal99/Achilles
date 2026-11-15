// The "tips engine" for the UI: turns a scanner Finding into a plain-English fix card.
// Rule table first (check_id / category), then a generic card built from the scanner's own text.
// It only ever explains findings the tools actually produced.
import type { ApiFinding, ApiSeverity, ScanResult, TipsResponse } from './scan-types'
import type { Finding, Severity } from './achilles-data'

type Rule = {
  match: (f: ApiFinding) => boolean
  epithet: string
  summary: string
  impact: string
  fixPrompt: (f: ApiFinding) => string
}

const has = (f: ApiFinding, ...needles: string[]) =>
  needles.some((n) => f.check_id.toLowerCase().includes(n) || f.title.toLowerCase().includes(n))

const RULES: Rule[] = [
  {
    match: (f) => f.category === 'exposed_secret' || has(f, 'service-role', 'secret-key', 'api-key', '-key'),
    epithet: 'The Open Gate',
    summary: 'A secret key is shipped inside your public JavaScript, so every visitor can read it.',
    impact: 'Anyone can use that key as you: read or change your data, or run up your AI and cloud bills.',
    fixPrompt: (f) =>
      `A secret key is exposed in my client-side code (${f.location}${f.evidence ? `, looks like ${f.evidence}` : ''}). Move every use of it into server-only code (Route Handlers or Server Actions), import "server-only" in that module, and make sure no NEXT_PUBLIC_ variable holds a secret. Then list the files you changed and remind me to rotate the leaked key at the provider.`,
  },
  {
    match: (f) => has(f, 'exposed-env', '.env'),
    epithet: 'The Unlocked Chest',
    summary: 'Your .env file can be downloaded by anyone who asks for it.',
    impact: 'It usually holds every password and API key your app uses.',
    fixPrompt: (f) =>
      `${f.location} serves my .env file publicly. Make sure env files are never inside the public/static folder or served by the web server, block dotfiles in the hosting config, then tell me which keys to rotate because they were exposed.`,
  },
  {
    match: (f) => has(f, 'exposed-git', '.git'),
    epithet: 'The Open Archive',
    summary: 'Your .git folder is publicly readable.',
    impact: 'Attackers can download your full source code and its history, including old secrets.',
    fixPrompt: (f) =>
      `${f.location} exposes my .git directory. Stop deploying the .git folder (use a build output directory), block access to /.git in the server config, and list any secrets that appear in the git history so I can rotate them.`,
  },
  {
    match: (f) => has(f, 'sourcemap', 'source map', 'source-map'),
    epithet: 'The Captured Map',
    summary: 'JavaScript source maps are public, so your original source code can be read in the browser.',
    impact: 'Makes it far easier to hunt for secrets, hidden routes and logic bugs.',
    fixPrompt: () =>
      'Disable public production source maps: make sure productionBrowserSourceMaps is not true in next.config, delete any .map files from the deployed build, or upload them privately to my error tracker instead.',
  },
  {
    match: (f) => f.category === 'open_port',
    epithet: 'The Unwatched Door',
    summary: 'A port that should be private (a database, cache or dev server) answers from the internet.',
    impact: 'Attackers can talk straight to the service, guess passwords, or use known bugs in it.',
    fixPrompt: (f) =>
      `${f.location} is reachable from the internet. Close it: bind the service to 127.0.0.1 or a private network, block the port in the firewall or security group, and use a production build instead of a dev server. Explain what you changed.`,
  },
  {
    match: (f) => has(f, 'plain http', 'http-only', 'plain-http', 'no-tls') || (f.category === 'tls' && has(f, 'http')),
    epithet: 'The Open Road',
    summary: 'The site is served over plain HTTP, so traffic can be read or changed in transit.',
    impact: 'Logins, cookies and form data can be stolen on shared Wi-Fi or by anyone on the network path.',
    fixPrompt: () =>
      'Serve my site over HTTPS only: enable TLS at my host or reverse proxy, redirect all HTTP requests to HTTPS with a 301, and add a Strict-Transport-Security header (max-age=63072000; includeSubDomains).',
  },
  {
    match: (f) => f.category === 'tls',
    epithet: 'The Cracked Seal',
    summary: 'Your TLS setup is weak or misconfigured (old protocols, bad or expiring certificate).',
    impact: 'Browsers may warn visitors, and weak encryption can be broken.',
    fixPrompt: (f) =>
      `Fix this TLS problem on my site: "${f.title}". Allow only TLS 1.2 and 1.3, use a valid auto-renewing certificate, and show me the exact config change for my host.`,
  },
  {
    match: (f) => f.category === 'cors' || has(f, 'cors'),
    epithet: 'The Open Border',
    summary: 'Your API allows requests from any website (permissive CORS).',
    impact: 'A malicious site can make a visitor’s browser call your API and read the answers.',
    fixPrompt: () =>
      'Tighten CORS on my API: replace the wildcard or reflected Access-Control-Allow-Origin with an explicit allowlist of my own domains, and never combine a permissive origin with Access-Control-Allow-Credentials.',
  },
  {
    match: (f) => has(f, 'clickjacking', 'frame'),
    epithet: 'The Painted Door',
    summary: 'Your pages can be loaded inside someone else’s page (clickjacking).',
    impact: 'Attackers can trick users into clicking buttons they cannot see.',
    fixPrompt: () =>
      "Add anti-framing protection to every response: Content-Security-Policy 'frame-ancestors none' and X-Frame-Options: DENY, via the headers() function in next.config (or my host's headers config).",
  },
  {
    match: (f) => f.category === 'headers' || has(f, 'missing-csp', 'missing-hsts', 'missing-xcto', 'missing-referrer', 'content-security-policy'),
    epithet: 'The Thin Shield',
    summary: 'Standard browser security headers are missing.',
    impact: 'Makes cross-site scripting, clickjacking and content-sniffing attacks easier to pull off.',
    fixPrompt: (f) =>
      `My site is missing a security header (${f.title}). Add baseline headers through the headers() function in next.config: X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, Strict-Transport-Security: max-age=63072000, X-Frame-Options: DENY and a starter Content-Security-Policy. Explain how to tighten the CSP later.`,
  },
  {
    match: (f) => has(f, 'rls', 'row level'),
    epithet: 'The Unguarded Wall',
    summary: 'Row Level Security is off on a database table, so any signed-in user can read other users’ rows.',
    impact: 'Private user data (emails, names, phone numbers) is readable by any account.',
    fixPrompt: (f) =>
      `Enable Row Level Security on ${f.location}. Add policies so a user can SELECT, UPDATE and DELETE only rows where id = auth.uid(), and INSERT only their own row. Write the SQL migration and explain each policy in one sentence.`,
  },
  {
    match: (f) => has(f, 'admin', 'no-auth', 'unauth'),
    epithet: 'The Trojan Horse',
    summary: 'An admin or internal route answers without checking who is asking.',
    impact: 'Attackers can list users or run admin actions without an account.',
    fixPrompt: (f) =>
      `The route ${f.location} has no auth check. Add a server-side guard that returns 401 with no session and 403 unless the user is an admin, put it in a reusable requireAdmin() helper, and apply it to every admin route.`,
  },
  {
    match: (f) => has(f, 'rate', 'brute'),
    epithet: 'The Endless Siege',
    summary: 'Login or another sensitive endpoint accepts unlimited attempts.',
    impact: 'Weak passwords can be brute-forced in minutes.',
    fixPrompt: (f) =>
      `Add rate limiting to ${f.location}: at most 5 failed attempts per IP and per email in 15 minutes, answering HTTP 429 with a friendly message and without revealing whether the email exists.`,
  },
  {
    match: (f) => has(f, 'stack', 'trace', 'verbose', 'debug'),
    epithet: 'The Loose Tongue',
    summary: 'Errors or debug pages reveal internals such as file paths and library versions.',
    impact: 'Gives attackers a map of how your app works.',
    fixPrompt: (f) =>
      `${f.location} reveals debug or stack-trace details. Return a generic { error: "Something went wrong" } with a 500 status, log the full error server-side with a request id, and turn debug mode off in production.`,
  },
  {
    match: (f) => has(f, 'cookie', 'httponly', 'samesite'),
    epithet: 'The Careless Courier',
    summary: 'A cookie is missing safety flags (Secure, HttpOnly or SameSite).',
    impact: 'Session cookies can be stolen by scripts or sent in cross-site requests.',
    fixPrompt: () =>
      'Set every session cookie with Secure, HttpOnly and SameSite=Lax (or Strict), then show me where the cookies are created and what you changed.',
  },
]

function generic(f: ApiFinding): Omit<Rule, 'match'> {
  return {
    epithet: 'A Crack in the Armor',
    summary: f.description || f.title,
    impact: 'Left alone, this gives an attacker one more foothold to chain with other weaknesses.',
    fixPrompt: () =>
      `Fix this security issue in my app: "${f.title}" at ${f.location}.${f.description ? ` Why it matters: ${f.description}` : ''}${f.remediation ? ` Suggested remedy: ${f.remediation}` : ''} Explain what you changed and how to verify it is fixed.`,
  }
}

const UI_SEVERITY: Partial<Record<ApiSeverity, Severity>> = {
  critical: 'critical',
  high: 'high',
  medium: 'medium',
  low: 'low',
}

export function explainFinding(f: ApiFinding): Finding | null {
  const severity = UI_SEVERITY[f.severity]
  if (!severity) return null // "info" items feed the stack panel, not the risk list
  const rule = RULES.find((r) => r.match(f)) ?? generic(f)
  return {
    id: f.id,
    title: f.title,
    epithet: rule.epithet,
    severity,
    category: f.category.replace(/_/g, ' '),
    location: f.location,
    summary: f.description && !RULES.find((r) => r.match(f)) ? f.description : rule.summary,
    impact: rule.impact,
    fixPrompt: rule.fixPrompt(f),
  }
}

/** Rule-based cards first; if the server returned AI-written tips for a finding, those replace the text. */
export function toUiFindings(scan: ScanResult, tips?: TipsResponse | null): Finding[] {
  return scan.findings
    .map((f): Finding | null => {
      const base = explainFinding(f)
      const t = tips?.tips?.[f.id]
      if (!base) return null
      if (!t) return { ...base, source: 'rules' as const }
      return {
        ...base,
        summary: t.summary || base.summary,
        impact: t.impact || base.impact,
        fixPrompt: t.fix_prompt || base.fixPrompt,
        source: t.source,
      }
    })
    .filter((x): x is Finding => x !== null)
}

const PROVIDER_NAME: Record<string, string> = { grok: 'Grok', gemini: 'Gemini', claude: 'Claude' }
export const tipsSourceLabel = (tips?: TipsResponse | null) =>
  tips && tips.source !== 'rules' ? `Fixes written by ${PROVIDER_NAME[tips.source] ?? tips.source}` : 'Built-in fix library'

/** Dashboard score: 100 = no known issues. Derived from the scanner's own risk score. */
export function securityScoreOf(scan: ScanResult): number {
  return Math.max(0, 100 - scan.summary.risk_score)
}

export function verdictOf(scan: ScanResult) {
  const s = scan.summary.by_severity
  if (s.critical > 0) return { label: 'Vulnerable', tone: 'text-critical', text: 'A critical flaw puts your app or data at risk. Fix it first.' }
  if (s.high > 0) return { label: 'At risk', tone: 'text-high', text: 'High-risk openings need attention before you share this app widely.' }
  if (s.medium > 0) return { label: 'Needs hardening', tone: 'text-medium', text: 'No serious holes, but several worthwhile fixes remain.' }
  if (s.low > 0) return { label: 'Mostly sound', tone: 'text-low', text: 'Only small issues left to tidy up.' }
  return { label: 'Strong', tone: 'text-gold', text: 'No weaknesses found by these checks.' }
}
