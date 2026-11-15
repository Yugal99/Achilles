# AGENTS.md

Guidance for AI coding agents working in this repo. Read [README.md](README.md) for the product pitch; this file is about how the code is laid out and how to work on it safely.

## What this is

Achilles scans an app the user has proven they own, using Nmap, httpx, Nuclei, testssl.sh and a custom JS/header checker. It normalizes the output into one `Finding` format and turns it into plain-English fixes. The repo has two parts:

| Folder | What it is | Stack |
|---|---|---|
| [backend-a/](backend-a/) | Scanner API. Runs the tools, normalizes findings, writes tips | Python 3.11+, FastAPI, Pydantic v2 |
| [frontend/](frontend/) | Site: URL entry, ownership check, live progress, report | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/base-ui |

The browser never talks to backend-a directly. It calls the Next.js proxy at `frontend/app/api/achilles/[...path]/route.ts`, which adds the API key on the server side.

## Layout

```
backend-a/
  app/main.py          FastAPI routes, all under /api/v1
  app/config.py        Settings from ACHILLES_* env vars
  app/scanner.py       Runs one scan: tools in parallel, then normalizes
  app/runner.py        Subprocess runner with timeouts
  app/tools/*.py       One module per tool: build the command and parse its output into Findings
  app/models.py        Pydantic models (Finding, ScanResult, ...). This is the shared contract
  app/ownership.py     DNS TXT and /.well-known/achilles.txt verification
  app/targets.py       Target validation; blocks private, loopback and metadata addresses
  app/tips.py          Fix writer chain: Grok -> Gemini -> Claude -> built-in rule table
  app/fake.py          Canned results for ACHILLES_FAKE_TOOLS=1
  app/profiles.py      Scan profiles (e.g. demo)
  docs/API.md, docs/SCHEMA.md, docs/scan-result.schema.json   API and result contract
  lab/vuln_app.py      Deliberately vulnerable local test target
  templates/achilles/  Curated Nuclei templates
  tests/               pytest (parsers, API in fake mode, tips)
frontend/
  app/page.tsx, app/layout.tsx
  app/api/achilles/[...path]/route.ts   Allow-listed proxy to backend-a
  components/achilles/  App screens (verify-step, scan-step, results-dashboard, security-report, ...)
  components/ui/        shadcn primitives. Don't hand-edit these unless you have to
  lib/api.ts            Browser client (talks only to /api/achilles)
  lib/scan-types.ts     TS mirror of backend-a/app/models.py
  lib/demo-scan.ts, lib/achilles-data.ts   Sample data for demo mode
```

## Running locally

**Backend.** Real scans need Linux with the tools installed (see `backend-a/setup_kali.sh`). On Windows or macOS, or without the tools, use fake mode.

```bash
cd backend-a
python -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt   # Windows: .venv/Scripts/...
ACHILLES_FAKE_TOOLS=1 .venv/bin/python -m uvicorn app.main:app --port 8000
# or on Linux: ./run.sh   (reads backend-a/.env; copy it from .env.example)
```

**Frontend.** The repo uses pnpm (`pnpm-lock.yaml`). Don't commit a `package-lock.json`.

```bash
cd frontend
cp .env.example .env.local   # set ACHILLES_API_URL (must include /api/v1) and ACHILLES_API_KEY
pnpm install
pnpm dev                     # add -p 3001 if 3000 is taken
```

If ports 3000 and 8000 are taken (e.g. by another local project), run the backend on another port and point `ACHILLES_API_URL` in `frontend/.env.local` at it.

## Tests and checks

```bash
cd backend-a && .venv/bin/python -m pytest -q   # no scanner tools needed
cd frontend && pnpm build                       # type-checks and builds
```

Run the backend tests after any change in `backend-a/`. Parser tests use saved sample tool output, so add a sample to them whenever you change a parser.

## Conventions

- **The result schema is a contract.** If you change `app/models.py`, update `docs/SCHEMA.md`, `docs/scan-result.schema.json`, `docs/examples/`, `frontend/lib/scan-types.ts` and `app/fake.py` in the same change.
- **New tool:** add a module in `app/tools/` (see `base.py`) that returns `Finding`s. Wire it into `scanner.py` with a hard timeout, add a fake-mode result, and add a parser test.
- **Settings:** add new ones to `app/config.py` as `ACHILLES_*` env vars, and document them in `backend-a/.env.example`.
- **Proxy allow-list:** a new backend route is unreachable from the UI until you add it to `ALLOWED` in the proxy route. Never proxy `/scans/{id}/raw`, because raw output can contain unmasked secrets.
- **Partial results beat errors.** If one tool fails or times out, the scan still finishes and the report says which checks were cut short.

## Safety rules (do not weaken)

This is a security tool, so these rules are part of the product:

- **No scans without proven ownership.** Don't bypass `ownership.py`, except for hosts in `ACHILLES_LAB_TARGETS` or with `ACHILLES_SKIP_OWNERSHIP` for local dev.
- **Keep `targets.py` blocking** private, loopback, link-local and cloud-metadata addresses.
- **Non-destructive checks only.** No brute force, exploit payloads or writes to the target. Nuclei runs only the curated templates.
- **Mask secrets.** Leaked keys must be masked in findings and reports.
- **Tips explain only real findings.** `tips.py` validates AI output against the findings the tools produced. Keep that check, and keep the offline rule-table fallback.
- **Keep keys server-side.** Never put API keys in client code or behind a `NEXT_PUBLIC_` variable. Never commit `.env` or `.env.local`.
- **Test targets:** only `lab/vuln_app.py`, OWASP Juice Shop, or hosts the developer owns. Never a third-party site.
