# ScanResult schema (v1.0)

Every scan, whatever tools ran, comes back as one `ScanResult` object. Backend B (tips engine / Grok) and the frontend (slide deck) should only depend on this shape.

- Machine-readable JSON Schema: [scan-result.schema.json](scan-result.schema.json) (also served at `GET /api/v1/schema`)
- Real output from the seeded lab app: [examples/lab-scan-result.json](examples/lab-scan-result.json)
- Source of truth in code: `app/models.py`

`schema_version` will change only if a field is renamed or removed; new fields may be added at any time, so ignore fields you don't know.

## ScanResult

| Field | Type | Notes |
| --- | --- | --- |
| `schema_version` | string | `"1.0"` |
| `scan_id` | string | `scn_` + 12 hex chars |
| `status` | enum | `queued` · `running` · `completed` (all tools ok/skipped) · `partial` (finished, but ≥1 tool timed out, errored or isn't installed) · `failed` (nothing usable; see `error`) · `cancelled` |
| `profile` | string | `demo` · `web` · `standard` · `deep` |
| `target` | Target | What was scanned |
| `created_at` / `started_at` / `finished_at` | ISO-8601 UTC string or null | |
| `duration_s` | number or null | Wall-clock scan time |
| `queue_position` | int or null | 1 = next up; null once running |
| `progress` | int 0–100 | Share of tools finished |
| `tools` | object: tool name → ToolRun | Always has all five keys: `nmap`, `httpx`, `nuclei`, `testssl`, `jscheck` |
| `stack` | Stack | Detected tech (mainly from httpx) |
| `findings` | Finding[] | **Sorted most severe first** |
| `summary` | Summary | Counts and score |
| `error` | string | Only set when `status` is `failed` |

## Finding

This is the unit Backend B explains and the deck shows.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | 12-char hash of `tool + check_id + location`. Stable: the same issue on a rescan has the same id (use it for "fixed since last scan") |
| `tool` | enum | `nmap` · `httpx` · `nuclei` · `testssl` · `jscheck` |
| `check_id` | string | Tool-specific check name: nuclei template id, testssl id, `open-port-5432`, `openai-key`, `missing-csp` … |
| `title` | string | Short human title, e.g. "PostgreSQL database exposed to the internet" |
| `severity` | enum | `critical` · `high` · `medium` · `low` · `info` |
| `category` | enum | see below |
| `description` | string | Why it matters (plain English, may be empty for some nuclei templates) |
| `location` | string | Where: a URL, `host:port/proto`, or `host:443` |
| `evidence` | string | Short proof. **Secrets are always masked** (`sk-pro…9xQa`). May be empty |
| `remediation` | string | How to fix, may be empty |
| `references` | string[] | Links (CWE, docs) |
| `tags` | string[] | Free-form tags from the tool |
| `cvss_score` | number or null | CVSS base score, 0.0 to 10.0, as stated by the tool. Today only Nuclei templates carry one, so it is `null` for every other tool and for templates without a score. Achilles never estimates a score, and `severity` does not depend on it |
| `cvss_vector` | string | CVSS vector, e.g. `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N`. Empty when the tool gives none. A template can state a vector without a score |

### `category` values

| Value | Meaning | Typical source |
| --- | --- | --- |
| `exposed_secret` | API keys/tokens in client JS or exposed files | jscheck, nuclei |
| `exposed_file` | `.env`, `.git`, source maps, debug pages, dev server | jscheck, nuclei |
| `open_port` | Database / cache / dev-server / admin ports reachable | nmap |
| `tls` | Certificate and protocol problems, plain HTTP | testssl, jscheck |
| `headers` | Missing security headers, cookie flags, version leaks | jscheck |
| `cors` | Permissive cross-origin policy | jscheck, nuclei |
| `misconfig` | Other misconfiguration | nuclei |
| `vulnerability` | Known CVE / vulnerable component | nuclei |
| `tech` | Informational: what the app is built with (always `info`) | httpx |

### Suggested use of severity in the deck

- **Top risks slide:** `critical` + `high`
- **Also worth fixing:** `medium` + `low`
- **What you did well / stack slide:** `stack`, `tech` findings, and the absence of findings in a category (e.g. no `open_port` above `info` → "No databases exposed").

## ToolRun

| Field | Type | Notes |
| --- | --- | --- |
| `status` | enum | `pending` · `running` · `ok` · `timeout` (hit its time limit; any results it found are still included) · `error` · `skipped` (e.g. testssl on an `http://` target) · `not_installed` |
| `started_at` / `finished_at` | datetime or null | |
| `duration_s` | number or null | |
| `timeout_s` | int | This tool's limit in the chosen profile. `0` means no limit (the `deep` profile) |
| `findings_count` | int | Findings from this tool after de-duplication |
| `message` | string | Human-readable one-liner, e.g. `"3 open ports"`, `"nuclei not found (dnf install ...)"`. Good for "which checks were cut short" in the deck |
| `command` | string | Exact command line that ran (for the "how we tested" slide / Q&A) |

## Target

| Field | Type | Example |
| --- | --- | --- |
| `input` | string | `"myapp.example.com"` (what the user typed) |
| `url` | string | `"https://myapp.example.com/"` (normalized) |
| `scheme` | string | `"https"` |
| `host` | string | `"myapp.example.com"` |
| `port` | int | `443` |
| `ips` | string[] | `["203.0.113.5"]` |

## Stack

| Field | Type | Example |
| --- | --- | --- |
| `technologies` | string[] | `["Next.js", "React", "Supabase", "Vercel"]` (httpx/Wappalyzer names, may include versions like `"Nginx:1.25"`) |
| `webserver` | string | `"Vercel"` |
| `title` | string | Page `<title>` |
| `status_code` | int or null | `200` |
| `final_url` | string | After redirects |
| `content_type` | string | `"text/html"` |
| `cdn` | string | `"cloudflare"` if detected |

## Summary

| Field | Type | Notes |
| --- | --- | --- |
| `total` | int | Number of findings (incl. info) |
| `by_severity` | object | Always has all five keys, e.g. `{"critical":2,"high":1,"medium":2,"low":3,"info":4}` |
| `by_category` | object | Only categories that occur |
| `risk_score` | int 0–100 | Sum of weights (critical 40, high 20, medium 8, low 3, info 0), capped at 100 |
| `grade` | `A`–`F` | A = 0, B < 10, C < 25, D < 50, F ≥ 50 |

## Trimmed example

```json
{
  "schema_version": "1.0",
  "scan_id": "scn_b9b67716f314",
  "status": "completed",
  "profile": "demo",
  "target": { "input": "http://127.0.0.1:8088", "url": "http://127.0.0.1:8088/", "scheme": "http",
              "host": "127.0.0.1", "port": 8088, "ips": ["127.0.0.1"] },
  "duration_s": 12.3,
  "progress": 100,
  "tools": {
    "nmap":    { "status": "ok", "duration_s": 12.3, "timeout_s": 75, "findings_count": 3, "message": "3 open ports", "command": "nmap -Pn -sT -sV ..." },
    "httpx":   { "status": "ok", "duration_s": 1.0, "timeout_s": 25, "findings_count": 1, "message": "Python:3.13.18", "command": "httpx-toolkit -u ..." },
    "nuclei":  { "status": "ok", "duration_s": 0.3, "timeout_s": 100, "findings_count": 0, "message": "2 template matches", "command": "nuclei -u ..." },
    "testssl": { "status": "skipped", "message": "target is http://, no TLS to test" },
    "jscheck": { "status": "ok", "duration_s": 0.2, "timeout_s": 60, "findings_count": 17, "message": "checked 2 scripts, 5 secrets" }
  },
  "stack": { "technologies": ["Python:3.13.18"], "webserver": "Express/4.18.2", "title": "TaskPilot (seeded test app)", "status_code": 200 },
  "findings": [
    {
      "id": "4c1f0e9a2b7d",
      "tool": "jscheck",
      "check_id": "openai-key",
      "title": "OpenAI API key in client code",
      "severity": "critical",
      "category": "exposed_secret",
      "description": "Anyone visiting the site can copy this key and run up your OpenAI bill.",
      "location": "http://127.0.0.1:8088/assets/chat-def456.js",
      "evidence": "sk-pro…stuv",
      "remediation": "Revoke the key at platform.openai.com, move OpenAI calls to a server/edge function, read the key from a server-side env var.",
      "references": [],
      "tags": ["secret", "openai-key"]
    }
  ],
  "summary": { "total": 21, "by_severity": { "critical": 5, "high": 2, "medium": 2, "low": 5, "info": 7 },
               "by_category": { "exposed_secret": 5, "exposed_file": 3, "headers": 7, "cors": 1, "tls": 1, "open_port": 3, "tech": 1 },
               "risk_score": 100, "grade": "F" },
  "error": ""
}
```

Note: when nuclei and jscheck report the same exposed file (e.g. `/.env`) only the more severe copy is kept, so `nuclei.findings_count` can be lower than its `message` count.

## Rules for Backend B (tips engine)

- Only explain findings that are in `findings`. Never invent new ones (README promise).
- `evidence` is already masked; don't try to unmask, and never show raw files from `/raw`.
- Use `tools[*].status` + `message` to say which checks were cut short when `status` is `partial`.
