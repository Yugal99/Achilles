"""Seeded vulnerable test app for Achilles (run it on your own VM only).

    python3 lab/vuln_app.py --port 8088

It deliberately has: an OpenAI-style key and a Supabase service_role JWT in the JS bundle,
a downloadable .env, an exposed .git/config, reflected CORS with credentials, and no security headers.
All keys are fake (they match the patterns but are not real credentials).
"""
import argparse
import base64
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def b64(d):
    return base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip("=")


FAKE_OPENAI = "sk-proj-" + "AchillesFakeKeyForTesting0123456789abcdefghijklmnopqrstuv"
FAKE_SERVICE = f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.{b64({'iss': 'supabase', 'role': 'service_role', 'ref': 'demo'})}.ZmFrZXNpZ25hdHVyZWZvcnRlc3Rpbmc"
FAKE_ANON = f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.{b64({'iss': 'supabase', 'role': 'anon', 'ref': 'demo'})}.ZmFrZXNpZ25hdHVyZWFub25rZXk"

PAGES = {
    "/": ("text/html", """<!doctype html><html><head><title>TaskPilot (seeded test app)</title>
<script type="module" src="/assets/index-abc123.js"></script></head><body><div id="root"></div></body></html>"""),
    "/assets/index-abc123.js": ("application/javascript", f"""
const supabaseUrl="https://demo.supabase.co";const supabaseAnonKey="{FAKE_ANON}";
const lazy=()=>import("/assets/chat-def456.js");
//# sourceMappingURL=index-abc123.js.map
"""),
    "/assets/chat-def456.js": ("application/javascript", f"""
export async function ask(q){{return fetch("https://api.openai.com/v1/chat/completions",{{headers:{{Authorization:"Bearer {FAKE_OPENAI}"}}}})}}
const admin="{FAKE_SERVICE}";
"""),
    "/assets/index-abc123.js.map": ("application/json", '{"version":3,"sources":["src/main.tsx"],"mappings":"AAAA"}'),
    "/.env": ("text/plain", f"SUPABASE_URL=https://demo.supabase.co\nSUPABASE_SERVICE_ROLE_KEY={FAKE_SERVICE}\nOPENAI_API_KEY={FAKE_OPENAI}\n"),
    "/.git/config": ("text/plain", "[core]\n\trepositoryformatversion = 0\n[remote \"origin\"]\n\turl = git@github.com:example/taskpilot.git\n"),
}


class H(SimpleHTTPRequestHandler):
    server_version = "Express/4.18.2"

    def do_GET(self):
        path = self.path.split("?")[0]
        ctype, body = PAGES.get(path, PAGES["/"])  # SPA catch-all like a real Vite/React host
        data = body.encode()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Powered-By", "Express 4.18.2")
        origin = self.headers.get("Origin")
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Set-Cookie", "session_id=abc123; Path=/")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8088)
    ap.add_argument("--cert", help="PEM cert to serve HTTPS (e.g. a self-signed one, so testssl has something to flag)")
    ap.add_argument("--key", help="PEM private key for --cert")
    a = ap.parse_args()
    srv = ThreadingHTTPServer((a.host, a.port), H)
    scheme = "http"
    if a.cert:
        import ssl
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(a.cert, a.key)
        # Do the TLS handshake in the per-connection thread, so one slow client can't block the others.
        class TLSServer(ThreadingHTTPServer):
            def finish_request(self, request, client_address):
                try:
                    request = ctx.wrap_socket(request, server_side=True)
                except (ssl.SSLError, OSError):
                    return
                super().finish_request(request, client_address)

        srv.server_close()
        srv = TLSServer((a.host, a.port), H)
        scheme = "https"
    print(f"Seeded vulnerable app on {scheme}://{a.host}:{a.port}  (fake secrets, test only)")
    srv.serve_forever()
