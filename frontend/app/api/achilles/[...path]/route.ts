// Server-side proxy to the Achilles scanner API (backend-a). The API key never reaches the browser.
//   ACHILLES_API_URL  default http://localhost:8000/api/v1
//   ACHILLES_API_KEY  the scanner's X-API-Key (server-only: never prefix with NEXT_PUBLIC_)
import type { NextRequest } from 'next/server'

const BASE = (process.env.ACHILLES_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '')

// Only the calls the UI needs. Raw tool output (/raw) can contain unmasked secrets, so it is never proxied.
const ALLOWED: Array<{ method: string; pattern: RegExp }> = [
  { method: 'GET', pattern: /^health$/ },
  { method: 'POST', pattern: /^ownership\/(challenge|verify)$/ },
  { method: 'GET', pattern: /^ownership\/[A-Za-z0-9.\-:]+$/ },
  { method: 'POST', pattern: /^scans$/ },
  { method: 'GET', pattern: /^scans\/scn_[a-f0-9]+(\/results|\/tips)?$/ },
  // Scan history for one host. The scanner only answers for hosts whose ownership is proven.
  { method: 'GET', pattern: /^hosts\/[A-Za-z0-9.\-:]+\/scans$/ },
  { method: 'DELETE', pattern: /^scans\/scn_[a-f0-9]+$/ },
]

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params
  const joined = path.join('/')
  if (!ALLOWED.some((a) => a.method === req.method && a.pattern.test(joined))) {
    return Response.json({ error: { code: 'not_allowed', message: 'Not allowed.' } }, { status: 404 })
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (process.env.ACHILLES_API_KEY) headers['X-API-Key'] = process.env.ACHILLES_API_KEY
  try {
    const upstream = await fetch(`${BASE}/${joined}`, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? await req.text() : undefined,
      cache: 'no-store',
      // /tips may call up to three AI providers in turn, so it gets a longer budget than the rest.
      signal: AbortSignal.timeout(joined.endsWith('/tips') ? 60_000 : 20_000),
    })
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' },
    })
  } catch {
    return Response.json(
      { error: { code: 'scanner_unreachable', message: 'The scanner service is not reachable right now.' } },
      { status: 502 },
    )
  }
}

export { handle as GET, handle as POST, handle as DELETE }
