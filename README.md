# Achilles

**Find your app's Achilles' heel before someone else does.**

Achilles is a security recon tool for vibe-coded apps. Paste in the URL of an app you built with an AI builder
(Lovable, Bolt, Replit, Cursor and others). Achilles runs a safe, non-destructive scan with eight security tools.
It then gives you a slide-style report: what it found, why each finding matters, and a fix prompt you can paste
straight back into your AI builder.

Built for **HackUTA 2026**. Live at **[cyberachilles.surf](http://cyberachilles.surf)**.

---

## Contents

- [The problem](#the-problem)
- [How it works](#how-it-works)
- [The toolkit](#the-toolkit)
- [Architecture](#architecture)
- [Installation](#installation)
  - [Option A: Docker (recommended)](#option-a-docker-recommended)
  - [Option B: Local development without Docker](#option-b-local-development-without-docker)
  - [Option C: Production server (Ubuntu VPS)](#option-c-production-server-ubuntu-vps)
- [Configuration](#configuration)
- [CI/CD pipeline](#cicd-pipeline)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Ethics and responsible use](#ethics-and-responsible-use)
- [Roadmap](#roadmap)

---

## The problem

AI builders let anyone ship a full-stack app in an afternoon, and most of those apps never get a security review.
The same mistakes show up again and again:

- `.env` files and `.git` folders exposed to the internet
- Supabase service keys or OpenAI keys shipped in client-side JavaScript
- Wildcard CORS, debug pages left on, missing security headers
- Dev servers and database ports left open
- Front-end libraries with known vulnerabilities

Pentest tools like Nmap and Nuclei can find these issues, but their output is written for security professionals.
Vibe coders need answers they can act on.

## How it works

1. **Verify:** you prove you own the app with a DNS TXT record or a file at `/.well-known/achilles.txt`.
   Achilles never scans a host whose ownership isn't proven.
2. **Scan:** the scanner runs its tools in parallel, each with a hard timeout.
3. **Normalize:** every tool's output is parsed into one common `Finding` format with a severity, a risk score and a grade.
4. **Explain:** an AI fix writer (Grok, then Gemini, then Claude, whichever has a key) turns findings into plain-English fixes and paste-ready prompts.
   Its output is checked against the real findings, so it can't invent issues.
   With no AI key, a built-in rule table writes the fixes.
5. **Report:** a slide-style report (Overview, The Heel, High Risk, Hardening). You can export it as **PDF**, **Markdown** or **JSON**.
   Earlier scans of the same host are kept, so you can rescan and compare.

**Scan profiles**

| Profile | What it does | Time |
|---|---|---|
| `demo` | Focused ports, curated Nuclei templates, quick TLS check | under 2 min |
| `standard` | Top 1000 ports, broader template set, TLS vulnerabilities | ~5–10 min |
| `deep` | All 65,535 ports, full template set, full TLS test, no time limits | long |

## The toolkit

| Tool | What it catches |
|---|---|
| **Nmap** | Open database ports, admin panels, dev servers left running |
| **httpx** (ProjectDiscovery) | The tech stack (Next.js, Supabase, Firebase, Vercel…) |
| **Nuclei** (curated templates) | Exposed `.env` and `.git` files, debug pages, Firebase config, Vite dev servers |
| **testssl.sh** | Weak TLS, and expired or mismatched certificates |
| **JS and header checker** (custom) | API keys in client JavaScript, missing security headers, CORS issues |
| **TruffleHog** | Secrets in the JS bundle, reported only when verified live |
| **Retire.js** | Known-vulnerable front-end libraries (jQuery, lodash, Angular…) |
| **Arjun** | Undocumented query parameters (`debug`, `admin`, `role`…) |

If a tool is missing or times out, the scan still finishes and the report says which checks were cut short.
Partial results beat error pages.

## Architecture

```
 Browser ──HTTPS──► nginx ──► Frontend (Next.js) ──/api/achilles proxy──► Scanner API (FastAPI) ──► Target app
                              site + report UI       adds the API key        ownership gate          (owner-verified)
                                                     server-side             scan queue + tools
                                                                             normalizer, tips
                                                                                   │
                                                                                   ▼
                                                                   MongoDB Atlas (optional) or JSON files
```

| Part | Job |
|---|---|
| **Frontend** (`frontend/`) | URL entry, ownership check, live progress, report and exports. The browser only talks to the Next.js proxy, which adds the API key server-side. |
| **Scanner API** (`backend-a/`) | Checks ownership and blocks private, loopback and cloud-metadata addresses. Queues scans in-process, runs the tools in parallel, normalizes findings and writes tips. |
| **Storage** | Scan history in MongoDB Atlas when `ACHILLES_MONGODB_URI` is set, otherwise JSON files in the data volume |
| **Hosting** | Docker Compose on a Vultr Ubuntu VPS, with nginx + Let's Encrypt in front |

## Installation

### Prerequisites

| For | You need |
|---|---|
| Docker install | Docker and Docker Compose v2 (Docker Desktop on Windows/macOS) |
| Local dev | Python 3.11+, Node.js 22, pnpm 12 |
| Real scans without Docker | Linux with the scanner tools (installed by the setup scripts below) |

### Option A: Docker (recommended)

The backend image ships every scanner tool, so real scans work on any OS.

```bash
git clone https://github.com/Yugal99/Achilles.git
cd Achilles
cp .env.example .env
```

Edit `.env`: set `ACHILLES_API_KEY` to a long random string, and set `DOCKERHUB_USER` if you pull prebuilt images.
Then use one of these:

```bash
# build from source
docker compose up -d --build

# or pull the prebuilt images from Docker Hub
docker compose pull && docker compose up -d
```

Open **http://localhost:3000** (or the port set in `ACHILLES_WEB_PORT`).

Useful commands:

```bash
docker compose logs -f          # follow logs
docker compose down             # stop (scan history stays in the achilles-data volume)
```

### Option B: Local development without Docker

**1. Scanner API**

```bash
cd backend-a
python -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt      # Windows: .venv\Scripts\pip
cp .env.example .env
```

- **Ubuntu/Debian with real tools:** run `./setup_ubuntu.sh`, which installs all scanner tools.
- **Fedora:** use `./setup_fedora.sh`.
- **Windows/macOS without the tools:** set `ACHILLES_FAKE_TOOLS=1` in `.env` to get canned results for UI work.
  Never use fake mode for a real report.

```bash
./run.sh                                                    # Linux; reads .env, port 8000
# or: .venv/bin/python -m uvicorn app.main:app --port 8000
```

API docs are at http://localhost:8000/docs.

**2. Frontend**

```bash
cd frontend
cp .env.example .env.local   # ACHILLES_API_URL=http://localhost:8000/api/v1, ACHILLES_API_KEY=<same as backend>
pnpm install
pnpm dev                     # http://localhost:3000 (add -p 3001 if 3000 is taken)
```

### Option C: Production server (Ubuntu VPS)

Full guide: [`deploy/README.md`](deploy/README.md). In short:

```bash
# 1. one-time server setup: Docker, deploy user, firewall (22/80/443), key-only SSH
scp deploy/setup-server.sh root@SERVER:/root/
ssh root@SERVER "bash /root/setup-server.sh '$(cat ~/.ssh/id_ed25519.pub)'"

# 2. add the GitHub secrets (see CI/CD below) and push to main: CI deploys the app

# 3. HTTPS: nginx + Let's Encrypt, HTTP -> HTTPS, auto-renewal
scp -r deploy root@SERVER:/root/achilles-deploy
ssh root@SERVER 'bash /root/achilles-deploy/setup-https.sh your-domain.com'
```

## Configuration

All settings are environment variables. For Docker, they go in the root `.env` (template: [`.env.example`](.env.example)).
For local dev, use `backend-a/.env` and `frontend/.env.local`.

| Variable | Required | Purpose |
|---|---|---|
| `ACHILLES_API_KEY` | yes | Shared secret between the frontend proxy and the scanner API |
| `DOCKERHUB_USER` | for pulling images | Docker Hub namespace of the prebuilt images |
| `ACHILLES_WEB_BIND` / `ACHILLES_WEB_PORT` | no | Where the site listens. Use `127.0.0.1` + `3000` behind nginx. |
| `ACHILLES_MONGODB_URI` | no | MongoDB Atlas connection string for durable scan history. Also allow the server IP in Atlas → Network Access. |
| `ACHILLES_XAI_API_KEY`, `ACHILLES_GEMINI_API_KEY`, `ACHILLES_ANTHROPIC_API_KEY` | no | AI fix writer, tried in `ACHILLES_AI_ORDER`. Without keys, the rule table is used. |
| `ACHILLES_LAB_TARGETS` | no | Hosts you run yourself that skip ownership checks. Never list a third-party host. |
| `ACHILLES_FAKE_TOOLS` | no | `1` returns canned results (UI development only) |
| `ACHILLES_MAX_CONCURRENT_SCANS` | no | Scans that run at once (default 1) |

Never commit `.env` or `.env.local`, and never put keys in a `NEXT_PUBLIC_` variable.

## CI/CD pipeline

Every push runs [`.github/workflows/docker.yml`](.github/workflows/docker.yml) on GitHub Actions. Nobody has to
build, upload or SSH anything by hand. Each change is tested, packaged into versioned images and, on `main`,
deployed to the server automatically.

```
 push ──► 1. Backend tests ──► 2. Build images (backend, frontend) ──► 3. Deploy to Vultr
           pytest                 push to Docker Hub                     main branch only
```

| Stage | What it does | Why it matters |
|---|---|---|
| **1. Backend tests** | Runs the pytest suite (parsers, API, tips, storage) | A broken change never becomes an image |
| **2. Build images** | Builds `achilles-backend` and `achilles-frontend`. The frontend build type-checks the whole app. Images are tagged `sha-<commit>` and `<branch>`; `main` also gets `latest`. | Every commit has an exact, reproducible image to run or roll back to |
| **3. Deploy** | On `main`: SSH to the server, pull the images built for that exact commit, restart with Docker Compose, wait until healthy | The live site always matches `main`, and a failed health check fails the run |

What runs on each event:

| Event | Tests | Build | Push to Docker Hub | Deploy |
|---|---|---|---|---|
| Push to `main` | ✅ | ✅ | ✅ (`latest`, `main`, `sha-…`) | ✅ |
| Push to any other branch | ✅ | ✅ | ✅ (`<branch>`, `sha-…`) | ❌ |
| Pull request to `main` | ✅ | ✅ | ❌ | ❌ |
| Manual run (Actions → Run workflow) | ✅ | ✅ | ✅ | ✅ |

A newer push to the same branch cancels the older run, so only the newest commit lands.

**Rolling back:** in `/opt/achilles` on the server, run
`DOCKERHUB_USER=<user> ACHILLES_TAG=sha-<older-commit> docker compose up -d`, or re-run an older workflow from the Actions tab.

**Required GitHub secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username (not your email) |
| `DOCKERHUB_TOKEN` | Docker Hub personal access token with **Read, Write, Delete** |
| `VULTR_HOST` | Server IP or hostname |
| `VULTR_USER` | SSH user on the server |
| `VULTR_SSH_KEY` | Private SSH key for that user (the whole file) |

Runtime keys (API key, MongoDB URI, AI keys) live only in the server's `/opt/achilles/.env`, never in GitHub or the images.

## Testing

```bash
cd backend-a && .venv/bin/python -m pytest -q    # no scanner tools needed
cd frontend && pnpm build                        # type-checks and builds
```

Safe test targets: `backend-a/lab/vuln_app.py` (a deliberately vulnerable local app), OWASP Juice Shop, or hosts you own.

## Project structure

```
Achilles/
├── backend-a/                  Scanner API (FastAPI)
│   ├── app/                    routes, scanner, ownership, tips, storage
│   │   └── tools/              one module per scanner tool
│   ├── templates/achilles/     curated Nuclei templates
│   ├── lab/vuln_app.py         deliberately vulnerable test target
│   ├── docs/                   API and result schema
│   ├── tests/                  pytest suite
│   ├── setup_ubuntu.sh         native install on Ubuntu/Debian
│   └── Dockerfile              image with all scanner tools
├── frontend/                   Next.js site (App Router, React 19, Tailwind v4)
│   └── Dockerfile
├── deploy/                     server setup, HTTPS (nginx + Let's Encrypt), deployment guide
├── .github/workflows/          CI/CD pipeline
├── docker-compose.yml          production stack (images from Docker Hub)
└── docker-compose.override.yml local builds from source
```

## Ethics and responsible use

- Achilles only scans targets you have **proven you control**.
- It never exploits what it finds: no brute force, no exploit payloads, no writes to the target.
  Nuclei runs only the curated templates.
- Private, loopback, link-local and cloud-metadata addresses are blocked.
- Leaked secrets are masked in findings and reports. Raw tool output is deleted after 7 days and is never served to the browser.

Scanning systems without permission is illegal in most places. Don't point Achilles, or the tools it uses,
at anything you don't own.

## Roadmap

- OWASP ZAP baseline scans
- More stack-specific checks (Supabase row-level security, Firebase rules)
- Solana proof of testing: anchor a SHA-256 hash of each report on-chain

## Built with

| | |
|---|---|
| **Vultr** | Hosts the production server (Ubuntu VPS) |
| **Grok (xAI)** | First choice for writing the plain-English fixes, with Gemini and Claude as backups |
| **Cursor** | Used to build Achilles |
| **MongoDB Atlas** | Optional durable scan history |
| **Docker Hub + GitHub Actions** | Image registry and CI/CD |
