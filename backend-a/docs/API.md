# Achilles Scanner API (Backend A)

Base URL: `http://<kali-vm-ip>:8000` (or the tunnel URL). All paths start with `/api/v1`.
Interactive docs (try every call in the browser): `http://<kali-vm-ip>:8000/docs`.

## Auth

If the server has `ACHILLES_API_KEY` set, send it on every call except `/health` and `/schema`:

```
X-API-Key: <key>
```

Missing or wrong key → `401`.

## Errors

Every error has the same body:

```json
{ "error": { "code": "ownership_not_verified", "message": "Prove you own app.example.com first: ..." } }
```

| HTTP | code | When |
| --- | --- | --- |
| 400 | `bad_target` | Not an http(s) URL / no host / credentials in URL |
| 400 | `bad_profile` | Profile isn't `demo`, `web`, `standard` or `deep` |
| 400 | `target_blocked` | Host resolves to a private/loopback/metadata IP, or doesn't resolve |
| 401 | `unauthorized` | Missing/wrong `X-API-Key` |
| 403 | `ownership_not_verified` | Host hasn't passed the ownership check |
| 404 | `not_found` | Unknown scan id |
| 409 | `not_cancellable` | Cancelling a scan that already finished |
| 429 | `queue_full` | Too many scans waiting |
| 422 | (FastAPI default body) | Malformed JSON body |

---

## The normal flow

```
1. POST /ownership/challenge   -> show the user the TXT record / file to publish
2. POST /ownership/verify      -> repeat until "verified": true
3. POST /scans                 -> 202 + scan_id
4. GET  /scans/{id}            -> poll every 1-2 s, drive the progress bar
5. GET  /scans/{id}/results    -> once status is completed | partial | failed
```

---

## Ownership

### `POST /api/v1/ownership/challenge`

```json
{ "target": "https://myapp.example.com" }
```

Returns the token (the same token every time for a host until it's verified):

```json
{
  "host": "myapp.example.com",
  "token": "ZhJ8qonZh4E0wJr3nqz7GUjh",
  "verified": false,
  "methods": {
    "dns_txt": {
      "record_names": ["myapp.example.com", "_achilles.myapp.example.com"],
      "type": "TXT",
      "value": "achilles-verify=ZhJ8qonZh4E0wJr3nqz7GUjh"
    },
    "well_known_file": {
      "urls": ["https://myapp.example.com/.well-known/achilles.txt", "http://myapp.example.com/.well-known/achilles.txt"],
      "content": "ZhJ8qonZh4E0wJr3nqz7GUjh"
    }
  }
}
```

### `POST /api/v1/ownership/verify`

Same body. Checks DNS first, then the file.

```json
{ "host": "myapp.example.com", "verified": true, "method": "dns_txt", "message": "Ownership verified." }
```

When not found yet: `"verified": false, "method": null` and a hint in `message` (still HTTP 200). Verification stays valid 24 h.

### `GET /api/v1/ownership/{host}`

```json
{ "host": "myapp.example.com", "verified": true, "lab_target": false }
```

---

## Scans

### `POST /api/v1/scans` → `202 Accepted`

```json
{ "target": "https://myapp.example.com", "profile": "demo" }
```

`profile` is optional (default `demo`). `target` can be a bare host (`myapp.example.com`, assumes https) or a URL with path/port.

```json
{
  "scan_id": "scn_b9b67716f314",
  "status": "queued",
  "profile": "demo",
  "target": { "input": "https://myapp.example.com", "url": "https://myapp.example.com/", "scheme": "https",
              "host": "myapp.example.com", "port": 443, "ips": ["203.0.113.5"] },
  "queue_position": 1,
  "links": { "status": "/api/v1/scans/scn_b9b67716f314", "results": "/api/v1/scans/scn_b9b67716f314/results" }
}
```

### `GET /api/v1/scans/{scan_id}`: status for polling

Everything in the result **except** `findings` and `stack`, so it's cheap to poll. See [examples/scan-status.json](examples/scan-status.json).

```json
{
  "scan_id": "scn_b9b67716f314",
  "status": "running",
  "profile": "demo",
  "progress": 60,
  "queue_position": null,
  "tools": {
    "nmap":    { "status": "running", "timeout_s": 75,  "findings_count": 0, "message": "" , "...": "..." },
    "httpx":   { "status": "ok",      "duration_s": 1.0, "findings_count": 1, "message": "Next.js, Vercel" },
    "nuclei":  { "status": "running", "...": "..." },
    "testssl": { "status": "ok",      "...": "..." },
    "jscheck": { "status": "ok",      "duration_s": 0.4, "findings_count": 9, "message": "checked 6 scripts, 2 secrets" }
  },
  "summary": { "total": 10, "by_severity": { "critical": 2, "high": 1, "medium": 2, "low": 3, "info": 2 }, "...": "..." },
  "created_at": "...", "started_at": "...", "finished_at": null, "duration_s": null, "error": ""
}
```

Stop polling when `status` is `completed`, `partial`, `failed` or `cancelled`. `progress` is the share of the five tools that have finished (0, 20, 40, 60, 80, 100), and `summary` updates live as each tool finishes, so the UI can show findings counts climbing.

### `GET /api/v1/scans/{scan_id}/results`: the full report

The complete `ScanResult` (schema in [SCHEMA.md](SCHEMA.md)). Works while running too (you get the findings so far), but treat it as final only once `status` is terminal. Findings are sorted most severe first.

### `GET /api/v1/scans?limit=50`

List of status objects (same shape as `GET /scans/{id}`), newest first.

### `DELETE /api/v1/scans/{scan_id}`

Cancels a queued or running scan (tool processes are killed). `{"scan_id": "...", "cancelled": true}`.

### `GET /api/v1/scans/{scan_id}/raw` and `/raw/{file}`

Lists and downloads raw tool output (`nmap.xml`, `nuclei.jsonl`, `httpx.jsonl`, `testssl.json`, `jscheck.log.txt`) for debugging. Raw files may contain **unmasked** secrets, so don't show them in the frontend.

---

## Meta

| Call | Auth | Returns |
| --- | --- | --- |
| `GET /api/v1/health` | no | `ok`, whether each tool is installed, fake mode, queue length |
| `GET /api/v1/profiles` | yes | Profiles with descriptions, deadlines, per-tool timeouts |
| `GET /api/v1/schema` | no | JSON Schema of `ScanResult` (same as [scan-result.schema.json](scan-result.schema.json)) |

---

## Quick copy-paste (JavaScript)

```js
const API = "http://192.168.1.42:8000/api/v1";
const H = { "Content-Type": "application/json", "X-API-Key": import.meta.env.VITE_ACHILLES_KEY };

const { scan_id } = await (await fetch(`${API}/scans`, {
  method: "POST", headers: H, body: JSON.stringify({ target: url, profile: "demo" }),
})).json();

let s;
do {
  await new Promise(r => setTimeout(r, 1500));
  s = await (await fetch(`${API}/scans/${scan_id}`, { headers: H })).json();
  onProgress(s.progress, s.tools);              // update the progress UI
} while (s.status === "queued" || s.status === "running");

const result = await (await fetch(`${API}/scans/${scan_id}/results`, { headers: H })).json();
```

## Quick copy-paste (Python, for Backend B)

```python
import time, httpx
API = "http://192.168.1.42:8000/api/v1"; H = {"X-API-Key": KEY}
sid = httpx.post(f"{API}/scans", json={"target": url}, headers=H).json()["scan_id"]
while (s := httpx.get(f"{API}/scans/{sid}", headers=H).json())["status"] in ("queued", "running"):
    time.sleep(1.5)
result = httpx.get(f"{API}/scans/{sid}/results", headers=H).json()
```
