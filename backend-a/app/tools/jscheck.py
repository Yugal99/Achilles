"""Custom leaked-key + header checker. Pure Python (stdlib), GET requests only, same-origin only."""
from __future__ import annotations

import asyncio
import re
import secrets as pysecrets
import ssl
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlsplit

from .base import ToolContext, ToolOutput, finding, save_raw
from .secrets import mask, scan_text

TOOL = "jscheck"
UA = "Mozilla/5.0 (X11; Linux x86_64) Achilles-Scanner/1.0 (+owner-verified security check)"
MAX_BYTES = 3 * 1024 * 1024
SCRIPT_SRC = re.compile(r"<script[^>]+src=[\"']([^\"']+)[\"']", re.I)
CHUNK_REF = re.compile(r"[\"'`]((?:\.{0,2}/)?(?:assets|_next/static|static/js|_nuxt|build|js)/[A-Za-z0-9_\-./]+?\.m?js)[\"'`]")
SOURCEMAP = re.compile(r"//# sourceMappingURL=([^\s'\"]+\.map)")
CORS_PROBE = "https://achilles-cors-probe.example"

SENSITIVE_PATHS = [
    ("/.env", "exposed-env", "critical", ".env file is publicly downloadable",
     re.compile(r"^\s*[A-Z][A-Z0-9_]{2,}\s*=", re.M),
     "Your .env usually holds database passwords and API keys.",
     "Remove .env from the public/ or dist/ folder, add it to .gitignore, and rotate every secret it contained."),
    ("/.git/config", "exposed-git", "high", ".git folder is publicly downloadable",
     re.compile(r"\[core\]"),
     "Attackers can rebuild your full source code and history, including old secrets.",
     "Block /.git in your web server or stop deploying the .git directory."),
]


def _fetch(url: str, headers: dict | None = None, max_bytes: int = MAX_BYTES, verify: bool = True):
    ctx = ssl.create_default_context()
    if not verify:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=ctx))
    try:
        with opener.open(req, timeout=10) as r:
            body = r.read(max_bytes)
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.headers.get_all("Set-Cookie") or [], \
                body.decode(errors="replace"), r.geturl()
    except urllib.error.HTTPError as e:
        body = e.read(65536).decode(errors="replace") if e.fp else ""
        return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, [], body, url


class Checker:
    def __init__(self, ctx: ToolContext):
        self.ctx = ctx
        self.t = ctx.target
        self.verify = True
        self.findings = {}
        self.fetched = 0
        self.log: list[str] = []

    def get(self, url, headers=None, max_bytes=MAX_BYTES):
        try:
            return _fetch(url, headers, max_bytes, self.verify)
        except (ssl.SSLError, urllib.error.URLError) as e:
            is_tls = isinstance(e, ssl.SSLError) or isinstance(getattr(e, "reason", None), ssl.SSLError)
            if self.verify and is_tls:
                self.log.append(f"TLS verification failed ({e}); continuing without verification")
                self.verify = False  # testssl reports the cert problem; keep going for the rest
                return _fetch(url, headers, max_bytes, False)
            raise

    def add(self, *a, **kw):
        f = finding(TOOL, *a, **kw)
        self.findings[f.id] = f

    def same_site(self, url: str) -> bool:
        h = (urlsplit(url).hostname or "").lower()
        return h == self.t.host or h.endswith("." + self.t.host)

    # --- checks ---------------------------------------------------------------
    def run(self):
        status, hdrs, cookies, html, final = self.get(self.t.url)
        self.log.append(f"GET {self.t.url} -> {status} ({len(html)} bytes) final={final}")
        self.check_headers(hdrs, cookies, final)
        self.check_cors()
        self.check_sensitive_paths(html)
        self.check_secrets(html, final)

    def check_headers(self, h: dict, cookies: list[str], final: str):
        loc = final
        is_https = final.startswith("https://")
        if self.t.scheme == "http" and not is_https:
            self.add("no-https", "Site is served over plain HTTP", "medium", "tls", loc,
                     description="Logins and data travel unencrypted.",
                     remediation="Serve the site over HTTPS and redirect HTTP to HTTPS.")
        checks = [
            ("strict-transport-security", "missing-hsts", "Missing HSTS header", "low", is_https,
             "Browsers may be downgraded to HTTP on first visit.",
             "Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`."),
            ("content-security-policy", "missing-csp", "Missing Content-Security-Policy", "low", True,
             "Without CSP, any XSS bug can load scripts from anywhere and steal sessions.",
             "Add a Content-Security-Policy header (start with `default-src 'self'`)."),
            ("x-content-type-options", "missing-xcto", "Missing X-Content-Type-Options", "info", True,
             "Browsers may MIME-sniff responses.", "Add `X-Content-Type-Options: nosniff`."),
            ("referrer-policy", "missing-referrer-policy", "Missing Referrer-Policy", "info", True,
             "Full URLs (with tokens in them) may leak to other sites.",
             "Add `Referrer-Policy: strict-origin-when-cross-origin`."),
        ]
        for header, cid, title, sev, applies, why, fix in checks:
            if applies and header not in h:
                self.add(cid, title, sev, "headers", loc, description=why, remediation=fix, tags=["headers"])
        csp = h.get("content-security-policy", "")
        if "x-frame-options" not in h and "frame-ancestors" not in csp:
            self.add("missing-clickjacking-protection", "Page can be framed (clickjacking)", "low", "headers", loc,
                     description="Another site can embed your app in an invisible frame and trick users into clicking.",
                     remediation="Add `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`.", tags=["headers"])
        for hname in ("x-powered-by", "server"):
            v = h.get(hname, "")
            if re.search(r"\d+\.\d+", v):
                self.add(f"version-disclosure-{hname}", f"{hname.title()} header reveals version", "info", "headers",
                         loc, evidence=f"{hname}: {v}", description="Version numbers help attackers pick exploits.",
                         remediation=f"Remove or genericize the {hname} header.", tags=["headers"])
        for c in cookies:
            name = c.split("=", 1)[0].strip()
            low = c.lower()
            missing = [f for f, ok in (("Secure", "secure" in low or not is_https), ("HttpOnly", "httponly" in low)) if not ok]
            if missing and re.search(r"sess|auth|token|jwt|sid", name, re.I):
                self.add(f"cookie-flags-{name}", f"Session cookie '{name}' missing {', '.join(missing)}", "medium",
                         "headers", loc, evidence=f"Set-Cookie: {name}=…; missing {', '.join(missing)}",
                         description="Session cookies without HttpOnly can be stolen by XSS; without Secure they leak over HTTP.",
                         remediation="Set cookies with `Secure; HttpOnly; SameSite=Lax`.", tags=["cookies"])

    def check_cors(self):
        try:
            status, h, _, _, _ = self.get(self.t.url, {"Origin": CORS_PROBE}, max_bytes=1024)
        except Exception as e:
            self.log.append(f"cors probe failed: {e}")
            return
        acao = h.get("access-control-allow-origin", "")
        acac = h.get("access-control-allow-credentials", "").lower() == "true"
        if acao == CORS_PROBE and acac:
            self.add("cors-reflect-credentials", "CORS reflects any origin with credentials", "high", "cors",
                     self.t.url, evidence=f"Origin: {CORS_PROBE} -> ACAO: {acao}, ACAC: true",
                     description="Any website can make logged-in requests to your app and read the responses.",
                     remediation="Only allow your own front-end origin(s); never echo the Origin header back.")
        elif acao == CORS_PROBE:
            self.add("cors-reflect-origin", "CORS reflects any origin", "medium", "cors", self.t.url,
                     evidence=f"Origin: {CORS_PROBE} -> ACAO: {acao}",
                     description="Any website can read responses from your app.",
                     remediation="Replace the reflected origin with an explicit allow-list.")
        elif acao == "*":
            self.add("cors-wildcard", "CORS allows any origin (*)", "low", "cors", self.t.url,
                     evidence="Access-Control-Allow-Origin: *",
                     description="Fine for public assets; risky on API routes that return user data.",
                     remediation="Restrict CORS on API routes to your own origin.")

    def check_sensitive_paths(self, index_html: str):
        base = f"{self.t.scheme}://{self.t.host}" + ("" if self.t.port in (80, 443) else f":{self.t.port}")
        # SPA catch-all detection: a random path that returns the same body as the page is not a real file
        try:
            _, _, _, nf_body, _ = self.get(base + "/achilles-" + pysecrets.token_hex(6), max_bytes=65536)
        except Exception:
            nf_body = ""
        for path, cid, sev, title, rx, why, fix in SENSITIVE_PATHS:
            try:
                status, h, _, body, _ = self.get(base + path, max_bytes=65536)
            except Exception:
                continue
            if status != 200 or body == nf_body or "<html" in body[:500].lower():
                continue
            if rx.search(body):
                keys = re.findall(r"^\s*([A-Z][A-Z0-9_]{2,})\s*=", body, re.M)[:8]
                ev = f"HTTP 200, {len(body)} bytes" + (f"; variables: {', '.join(keys)}" if keys else "")
                self.add(cid, title, sev, "exposed_file", base + path, evidence=ev, description=why, remediation=fix)
                for pid, v, s2, t2, why2, fix2 in scan_text(body):
                    self.add(pid, t2.replace("in client code", f"in {path}"), s2, "exposed_secret", base + path,
                             evidence=mask(v), description=why2, remediation=fix2)

    def check_secrets(self, html: str, page_url: str):
        max_scripts = self.ctx.opts.get("max_scripts", 25)
        queue = [urljoin(page_url, s) for s in SCRIPT_SRC.findall(html)]
        sources = [(page_url, html)]
        seen = set()
        while queue and self.fetched < max_scripts:
            u = queue.pop(0).split("#")[0]
            if u in seen or not self.same_site(u):
                continue
            seen.add(u)
            try:
                status, h, _, body, _ = self.get(u)
            except Exception as e:
                self.log.append(f"GET {u} failed: {e}")
                continue
            self.fetched += 1
            if status != 200:
                continue
            sources.append((u, body))
            for ref in CHUNK_REF.findall(body):
                queue.append(urljoin(u if ref.startswith(".") else page_url, ref))
            for sm in SOURCEMAP.findall(body[-500:]):
                self.check_sourcemap(urljoin(u, sm))
        for loc, text in sources:
            for pid, v, sev, title, why, fix in scan_text(text):
                self.add(pid, title, sev, "exposed_secret", loc, evidence=mask(v), description=why,
                         remediation=fix, tags=["secret", pid])

    def check_sourcemap(self, url: str):
        if not self.same_site(url) or any(f.check_id == "exposed-sourcemap" for f in self.findings.values()):
            return
        try:
            status, _, _, body, _ = self.get(url, max_bytes=2048)
        except Exception:
            return
        if status == 200 and ('"mappings"' in body or '"sources"' in body):
            self.add("exposed-sourcemap", "JavaScript source maps are public", "low", "exposed_file", url,
                     description="Source maps hand out your original, readable source code (comments included).",
                     remediation="Disable production source maps (e.g. `build.sourcemap: false` in Vite, "
                                 "`productionBrowserSourceMaps: false` in Next.js).")


async def run(ctx: ToolContext) -> ToolOutput:
    c = Checker(ctx)
    # Runs in a worker thread; on timeout we keep whatever it found so far and abandon the thread.
    partial = False
    try:
        await asyncio.wait_for(asyncio.to_thread(c.run), timeout=ctx.opts["timeout"] - 2)
    except asyncio.TimeoutError:
        partial = True
    save_raw(ctx, "jscheck.log.txt", "\n".join(c.log))
    findings = list(c.findings.values())
    if not findings and not c.log:
        raise RuntimeError("could not fetch the target page")
    msg = f"checked {c.fetched} scripts, {sum(f.category.value == 'exposed_secret' for f in findings)} secrets"
    return ToolOutput(findings=findings, command="builtin:jscheck", partial=partial,
                      message=msg + (" (cut at time limit)" if partial else ""))
