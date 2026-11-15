# Achilles

Find your app's Achilles' heel before someone else does.

Achilles is a security recon tool for vibe-coded apps. Paste in the URL of an app you built with an AI builder (Lovable, Bolt, Replit, Cursor and others). Achilles runs a safe, non-destructive scan from a Linux backend and hands back a five-slide presentation: what it found, why each finding matters, and a fix prompt you can paste straight back into your AI builder.

Built for HackUTA.

## Contents

- [The problem](#the-problem)
- [What Achilles does](#what-achilles-does)
- [Architecture](#architecture)
- [The toolkit](#the-toolkit)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Tests](#tests)
- [Troubleshooting](#troubleshooting)
- [Ethics and responsible use](#ethics-and-responsible-use)
- [Roadmap](#roadmap)

## The problem

AI builders let anyone ship a full-stack app in an afternoon, and most of those apps never get a security review. The same mistakes show up again and again:

- `.env` files and `.git` folders exposed to the internet
- Supabase service keys or OpenAI keys shipped in client-side JavaScript
- Database tables with no row-level security, and open Firebase rules
- Wildcard CORS, debug pages left on, missing security headers
- Dev servers and database ports left open

Pentest tools like Nmap and Nuclei can find these issues, but their output is written for security professionals. Vibe coders need answers they can act on.

## What Achilles does

1. **Verify.** You prove you own the app with a DNS TXT record or a file at `/.well-known/achilles.txt`.
2. **Scan.** The scanner runs eight tools in parallel, each with its own time limit.
3. **Normalize.** Every tool's output is parsed into one common `Finding` format.
4. **Explain.** Grok turns the findings into plain-English fixes and paste-ready prompts. It may only explain findings the tools produced, never invent new ones.
5. **Present.** You get a five-slide deck covering the stack we saw, the top risks, why each one matters, how to fix it, and what you did well.

The Demo profile finishes in under 2 minutes.

## Architecture

```
Browser ──► Next.js site ──► Next.js proxy ──► Scanner API ──► Scan tools ──► Target app
            (frontend/)     (adds API key)    (backend-a/)    (subprocesses)  (owner-verified)
                                                   │
                                                   ▼
                              Normalizer ──► Tips writer ──► Scan history
                               (Python)     (AI + rules)    (JSON files, optional MongoDB)
```

| Part | Job |
|---|---|
| Site (`frontend/`) | Takes the URL, walks you through the ownership check, shows live progress, renders the report |
| Proxy (`frontend/app/api/achilles`) | Forwards allow-listed requests to the scanner and adds the API key on the server, so the key never reaches the browser |
| Scanner API (`backend-a/`) | Checks ownership, blocks private and internal addresses, queues scans, runs the tools |
| Normalizer | Parses each tool's output (Nmap XML, Nuclei JSON and so on) into Findings |
| Tips writer | Ranks findings and writes the fixes (Grok, then Gemini, then Claude, with a built-in rule table as the last fallback) |
| Scan history | Saved as JSON files under `backend-a/data/`, and in MongoDB if you set a connection string |

## The toolkit

| Tool | What it catches |
|---|---|
| Nmap | Open database ports, admin panels, dev servers left running |
| httpx | The tech stack (Supabase, Firebase, Next.js, Vercel), so later checks know what to look for |
| Nuclei (curated templates) | Exposed `.env` and `.git` files, debug pages, open CORS, known CVEs |
| testssl.sh | Weak TLS, and expired or mismatched certificates |
| JS-bundle and header checker (custom) | API keys in client JavaScript and missing security headers |
| TruffleHog | Leaked secrets in client JavaScript, checked against the provider to see if they still work |
| Retire.js | JavaScript libraries with known vulnerabilities |
| Arjun | Hidden parameters on the app's API endpoints |

## Installation

Achilles has two parts. `backend-a/` is the scanner API and `frontend/` is the site. Install the backend first, because the frontend needs its URL and API key.

### Requirements

| What | Version | Needed for |
|---|---|---|
| Python | 3.11 or newer | Backend |
| Node.js | 20.9 or newer | Frontend |
| pnpm | 9 or newer (`npm install -g pnpm`) | Frontend |
| Fedora Linux | Any current release | Real scans. `setup_fedora.sh` installs the scan tools with `dnf` |

On Windows, macOS or another Linux distro you can still run everything in fake mode, which returns canned results without running any scan tool. See [Option B](#option-b-fake-mode-any-os).

### 1. Clone the repo

```bash
git clone https://github.com/Yugal99/Achilles.git
cd Achilles
```

### 2. Install the backend

#### Option A: real scans (Fedora)

```bash
cd backend-a
chmod +x setup_fedora.sh run.sh scripts/*.sh
./setup_fedora.sh
```

The script asks for `sudo` once. It installs Nmap, testssl.sh, Go and Node.js with `dnf`, installs httpx, Nuclei and TruffleHog into `~/go/bin`, installs Retire.js with `npm`, creates a Python virtualenv in `.venv` with Arjun, downloads the Nuclei templates, and copies `.env.example` to `.env`. It ends with a tool check. Every line should show a path, and none should say `MISSING`.

Then set an API key. Generate one and put it in `.env`:

```bash
openssl rand -hex 16          # copy the output
nano .env                     # set ACHILLES_API_KEY=<the output>
```

Start the API:

```bash
./run.sh
```

You should see `Achilles scanner API on http://0.0.0.0:8000`. Leave that terminal open.

#### Option B: fake mode (any OS)

Fake mode needs only Python. Use it for frontend work, or to try Achilles without installing the scan tools.

```bash
cd backend-a
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
ACHILLES_FAKE_TOOLS=1 .venv/bin/python -m uvicorn app.main:app --port 8000
```

On Windows the virtualenv commands live in `.venv\Scripts\` instead of `.venv/bin/`, and you set the variable with `$env:ACHILLES_FAKE_TOOLS=1` in PowerShell before starting uvicorn.

#### Check the backend

```bash
curl -s localhost:8000/api/v1/health
```

In a real install, every entry under `tools` should show `"installed": true`. The interactive API docs are at `http://localhost:8000/docs`.

### 3. Install the frontend

Open a second terminal.

```bash
cd frontend
cp .env.example .env.local
```

Edit `.env.local`:

```bash
ACHILLES_API_URL=http://localhost:8000/api/v1   # must end in /api/v1
ACHILLES_API_KEY=<same value as ACHILLES_API_KEY in backend-a/.env>
```

Leave `ACHILLES_API_KEY` empty if the backend has no key set, which is the case in fake mode above.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Usage

### Scan an app from the site

1. Open `http://localhost:3000` and enter the URL of an app you own.
2. Achilles gives you a token. Publish it one of two ways:
   - **DNS TXT record.** Type `TXT`, value `achilles-verify=<token>`, on the app's hostname or on `_achilles.<hostname>`.
   - **File.** Put the bare token at `https://<your app>/.well-known/achilles.txt`. In a Vite or Next.js app that is `public/.well-known/achilles.txt`.
3. Click verify. Proof of ownership lasts 24 hours.
4. Pick a scan profile and start the scan. The page shows each tool's progress as it runs.
5. Read the report. Each finding has a plain-English explanation and a fix prompt you can copy into your AI builder. You can export the report as Markdown or print it.

### Scan profiles

| Profile | What it runs | Time |
|---|---|---|
| `demo` (default) | 39 focused ports (databases, dev servers, admin panels), curated Nuclei templates, quick TLS check | Under 2 minutes |
| `web` | Same as `demo` with no port scan and a gentler request rate | Under 2 minutes |
| `standard` | Top 1000 ports, all Nuclei templates, TLS vulnerability checks | 5 to 10 minutes |
| `deep` | All 65535 ports, every template, the full TLS test, no time limits | An hour or more |

Use `web` for apps on shared hosting such as Vercel, Railway or Render. The ports on those hosts belong to the platform, so Achilles skips Nmap.

### Try it on the built-in vulnerable app

The repo ships a fake vibe-coded app with planted fake keys, an exposed `.env`, an exposed `.git`, bad CORS and no security headers. It runs on your machine, so it's safe to scan.

```bash
# terminal 1: start the test app
cd backend-a
python3 lab/vuln_app.py --port 8088
```

```bash
# terminal 2: allow the test app as a target, then restart the API
cd backend-a
echo "ACHILLES_LAB_TARGETS=127.0.0.1,localhost" >> .env
./run.sh
```

```bash
# terminal 3: run a scan
cd backend-a
export ACHILLES_API_KEY=<your key>
./scripts/scan.sh http://127.0.0.1:8088
```

Hosts in `ACHILLES_LAB_TARGETS` skip the ownership check and the private-address block, so only list hosts you run yourself.

### Scan from the command line

The helper scripts need `curl` and `jq`. They read the key from `ACHILLES_API_KEY` and talk to `http://localhost:8000` unless you set `API`.

```bash
cd backend-a
export ACHILLES_API_KEY=<your key>

./scripts/verify.sh challenge myapp.example.com    # prints the token to publish
./scripts/verify.sh check myapp.example.com        # "verified": true once the token is live
./scripts/scan.sh https://myapp.example.com        # demo profile
./scripts/scan.sh https://myapp.example.com web    # second argument picks the profile
```

`scan.sh` prints live per-tool progress, then a summary:

```
status: completed  duration: 12.3s  grade: F  risk: 100
  [critical] .env file is publicly downloadable  @ http://127.0.0.1:8088/.env
  [critical] OpenAI API key in client code  @ http://127.0.0.1:8088/assets/chat-def456.js
  [high] CORS reflects any origin with credentials  @ http://127.0.0.1:8088/
```

### Use the API directly

Every route lives under `/api/v1` and takes the key in an `X-API-Key` header.

```bash
curl -s -X POST localhost:8000/api/v1/scans \
  -H "X-API-Key: $ACHILLES_API_KEY" -H "content-type: application/json" \
  -d '{"target": "https://myapp.example.com", "profile": "demo"}'

curl -s -H "X-API-Key: $ACHILLES_API_KEY" localhost:8000/api/v1/scans/<scan_id>           # status
curl -s -H "X-API-Key: $ACHILLES_API_KEY" localhost:8000/api/v1/scans/<scan_id>/results   # findings
curl -s -H "X-API-Key: $ACHILLES_API_KEY" localhost:8000/api/v1/scans/<scan_id>/tips      # fixes
```

The full reference is in [backend-a/docs/API.md](backend-a/docs/API.md), and the result format is in [backend-a/docs/SCHEMA.md](backend-a/docs/SCHEMA.md).

## Configuration

Backend settings are `ACHILLES_*` variables in `backend-a/.env`. [backend-a/.env.example](backend-a/.env.example) documents all of them. The ones you're most likely to change:

| Variable | What it does |
|---|---|
| `ACHILLES_API_KEY` | Shared secret for the API. Set it before the backend is reachable from another machine |
| `ACHILLES_PORT` | Port the API listens on (default `8000`) |
| `ACHILLES_FAKE_TOOLS` | `1` returns canned results without running any tool |
| `ACHILLES_LAB_TARGETS` | Hosts you run yourself that skip the ownership check |
| `ACHILLES_MONGODB_URI` | Saves scan history to MongoDB. Leave it empty to keep history in local JSON files |
| `ACHILLES_XAI_API_KEY`, `ACHILLES_GEMINI_API_KEY`, `ACHILLES_ANTHROPIC_API_KEY` | Keys for the AI fix writer. With none set, Achilles writes fixes from its built-in rule table |

The frontend reads `ACHILLES_API_URL` and `ACHILLES_API_KEY` from `frontend/.env.local`. Both stay on the server. Never prefix them with `NEXT_PUBLIC_`, and never commit `.env` or `.env.local`.

To put Achilles on your own domain, follow [frontend/DOMAIN.md](frontend/DOMAIN.md). For a VM setup that teammates can reach, see [backend-a/README.md](backend-a/README.md).

## Tests

```bash
cd backend-a
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q        # needs no scan tools

cd ../frontend
pnpm build                           # type-checks and builds
```

## Troubleshooting

| Problem | Fix |
|---|---|
| The tool check prints `MISSING` for httpx, nuclei or trufflehog | Add `~/go/bin` to your `PATH` with `echo 'export PATH="$PATH:$HOME/go/bin"' >> ~/.zshrc` (or `~/.bashrc`), then rerun the script |
| `/health` shows httpx as not installed | `httpx` on your `PATH` is the Python client. Set `ACHILLES_HTTPX_BIN=$HOME/go/bin/httpx` in `.env` |
| Port 3000 or 8000 is taken | Run `pnpm dev -p 3001`, or set `ACHILLES_PORT` in `backend-a/.env` and update `ACHILLES_API_URL` in `frontend/.env.local` to match |
| The site can't reach the scanner | Check that `ACHILLES_API_URL` ends in `/api/v1` and that the two API keys match. Restart `pnpm dev` after editing `.env.local` |
| Other machines can't reach port 8000 on Fedora | `sudo firewall-cmd --add-port=8000/tcp --permanent && sudo firewall-cmd --reload` |
| A scan ends as `partial` | A tool hit its time limit. The report keeps what the tool found and says which checks were cut short |

## Built with (sponsor tech)

| Sponsor | How Achilles uses it |
|---|---|
| Vultr | Hosts the scanner VM, the site and the API |
| GoDaddy Registry | The demo domain |
| SpaceXSI (Cursor + Grok) | Achilles was built with Cursor, and Grok writes the plain-English fixes and prompts |
| Solana (stretch) | Anchors a SHA-256 hash of each report on-chain as tamper-proof proof of testing. Only the hash goes on-chain, never the findings |

## Reliability

- **Partial reports, not error pages.** Each tool has a hard timeout, and if one tool fails the report still ships and says which checks were cut short.
- **AI fallback chain.** Grok, then Gemini, then Claude, then rule-based tips.
- **Tested against known-vulnerable targets.** OWASP Juice Shop, plus a seeded test app with a leaked key and an exposed `.env`.

## Ethics and responsible use

Achilles only scans targets you have proven you control, and it never exploits what it finds. There is no brute force, no payloads and no writes to the target. Private, loopback and cloud-metadata addresses are blocked. Leaked secrets are masked in reports, and raw scan output is deleted after 7 days.

Scanning systems without permission is illegal in most places. Don't point Achilles, or the tools it uses, at anything you don't own.

## Roadmap

- OWASP ZAP baseline scans
- More stack-specific checks (Supabase row-level security, Firebase rules)
- Rescans that show what got fixed
- Solana proof of testing
