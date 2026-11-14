# Achilles Backend A: scanner service (Fedora)

A small API that runs on Fedora Linux (a VM or your own machine). You give it a URL you own, it runs **Nmap, httpx, Nuclei, testssl.sh and a leaked-key/header checker** in parallel, and it returns one JSON report. Backend B and the frontend only ever talk to this API.

- API reference: [docs/API.md](docs/API.md)
- Result format (the JSON everyone builds against): [docs/SCHEMA.md](docs/SCHEMA.md)
- Real example output: [docs/examples/lab-scan-result.json](docs/examples/lab-scan-result.json)

---

## Step-by-step: set it up on Fedora

### Step 1. Network (only if you use a VM)

Running directly on a Fedora machine? Skip this step. For a VM, set the adapter to **Bridged** (VirtualBox: Settings → Network → Adapter 1 → Bridged Adapter; VMware: Bridged; UTM: Bridged (Advanced)) so teammates can reach it, and give it at least 2 CPUs and 4 GB RAM.

> If your Wi-Fi blocks laptop-to-laptop traffic (common at hackathons), use the tunnel in Step 9, option B.

### Step 2. Get the code

```bash
git clone https://github.com/<you>/achilles.git ~/achilles
cd ~/achilles/backend-a
```

(or copy the folder over with `scp -r backend-a <user>@<host>:~/achilles/`).

### Step 3. Run the setup script (installs everything)

```bash
cd ~/achilles/backend-a
chmod +x setup_fedora.sh run.sh scripts/*.sh lab/vuln_app.py
./setup_fedora.sh
```

It runs `dnf install` for `nmap testssl bind-utils util-linux python3 golang jq curl openssl`, installs ProjectDiscovery **httpx** and **Nuclei** with `go install` (into `~/go/bin`, since Fedora doesn't package them), creates a Python virtualenv in `.venv`, downloads the Nuclei templates and creates `.env`. At the end it prints a tool check; every line should show a path, none should say `MISSING`.

`run.sh` adds `~/go/bin` to `PATH` itself. To use httpx/nuclei in your own shell too:

```bash
echo 'export PATH="$PATH:$HOME/go/bin"' >> ~/.zshrc   # or ~/.bashrc
```

<details><summary>Doing it by hand instead</summary>

```bash
sudo dnf install -y nmap testssl bind-utils util-linux python3 python3-pip golang curl jq openssl
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest
export PATH="$PATH:$HOME/go/bin"
nuclei -update-templates
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Notes:
- Fedora's `testssl` package provides the `testssl` command (found automatically). `hexdump` comes from `util-linux`, `dig` from `bind-utils`.
- ProjectDiscovery's httpx installs as plain `httpx`. The service checks that `httpx` really is the ProjectDiscovery one. If `which httpx` points at the Python `httpx` CLI instead, set `ACHILLES_HTTPX_BIN=$HOME/go/bin/httpx` in `.env`.
- Need a newer Go than Fedora ships? `go install` downloads the toolchain it needs automatically (Go 1.21+).
- SELinux does not get in the way of any of this; no policy changes are needed.
</details>

### Step 4. Set an API key

```bash
nano .env
```

Change `ACHILLES_API_KEY=change-me-to-something-long` to a random string (e.g. output of `openssl rand -hex 16`) and share it with your team. Leave the rest as is for now.

### Step 5. Start the API

```bash
./run.sh
```

You should see `Achilles scanner API on http://0.0.0.0:8000`. Leave this terminal open. Open a second terminal for the next steps.

Check it from inside the VM:

```bash
curl -s localhost:8000/api/v1/health | jq
```

All five tools should show `"installed": true`. The interactive docs are at `http://localhost:8000/docs`.

### Step 6. Test a scan against the seeded vulnerable app (safe, local)

The repo includes a fake "vibe-coded" app with planted (fake) leaked keys, an exposed `.env`, an exposed `.git`, bad CORS and no security headers.

```bash
# terminal 2: start the test app
python3 lab/vuln_app.py --port 8088
```

```bash
# terminal 1: stop run.sh (Ctrl+C), allow the lab app as a target, restart
echo "ACHILLES_LAB_TARGETS=127.0.0.1,localhost" >> .env
./run.sh
```

```bash
# terminal 3: run a demo-profile scan
export ACHILLES_API_KEY=<your key>
./scripts/scan.sh http://127.0.0.1:8088
```

You'll see live per-tool progress, then a summary like:

```
status: completed  duration: 12.3s  grade: F  risk: 100
  [critical] .env file is publicly downloadable  @ http://127.0.0.1:8088/.env
  [critical] OpenAI API key in client code  @ http://127.0.0.1:8088/assets/chat-def456.js
  [critical] Supabase service_role key in client code  @ ...
  [high] CORS reflects any origin with credentials  @ http://127.0.0.1:8088/
  [high] .git folder is publicly downloadable  @ http://127.0.0.1:8088/.git/config
  ...
```

Want TLS findings too? Serve the lab app over HTTPS with a self-signed cert:

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 7 -subj "/CN=wrong-name.test" -keyout lab.key -out lab.crt
python3 lab/vuln_app.py --port 8443 --cert lab.crt --key lab.key
./scripts/scan.sh https://127.0.0.1:8443
```

### Step 7. Scan a real app you own (ownership check)

The API refuses to scan a public host until you prove you own it.

```bash
./scripts/verify.sh challenge myapp.yourdomain.xyz
```

It returns a token. Publish it **one** of two ways:

- **DNS TXT** (e.g. in GoDaddy DNS): name `myapp` (or `_achilles.myapp`), type `TXT`, value `achilles-verify=<token>`
- **File**: put the bare token in `https://myapp.yourdomain.xyz/.well-known/achilles.txt` (in a Vite/Next app, that's `public/.well-known/achilles.txt`)

Then:

```bash
./scripts/verify.sh check myapp.yourdomain.xyz      # -> "verified": true
./scripts/scan.sh https://myapp.yourdomain.xyz
```

Verification lasts 24 hours. Private, loopback and cloud-metadata IPs are always blocked unless listed in `ACHILLES_LAB_TARGETS`.

### Step 8. Find the VM's IP

```bash
ip -4 -br addr        # e.g. enp1s0 192.168.1.42/24
```

Fedora runs `firewalld`, which blocks port 8000 from other machines. Open it:

```bash
sudo firewall-cmd --add-port=8000/tcp --permanent
sudo firewall-cmd --reload
```

(Not needed for `localhost` use or when going through the tunnel in Step 9.)

### Step 9. Let teammates use it

**Option A: same network (bridged VM).** Teammates use `http://<vm-ip>:8000` with header `X-API-Key: <key>`. Test from a teammate's laptop:

```bash
curl -s http://192.168.1.42:8000/api/v1/health
```

Set `ACHILLES_CORS_ORIGINS` in `.env` to the frontend's origin(s) (e.g. `http://localhost:3000,https://achilles.yourdomain.xyz`) or keep `*`.

**Option B: different networks, or the Wi-Fi blocks peer traffic.** Open a free tunnel from the Fedora host:

```bash
# x86_64; on ARM use cloudflared-linux-aarch64.rpm
sudo dnf install -y https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm
cloudflared tunnel --url http://localhost:8000
```

It prints a `https://<random>.trycloudflare.com` URL that works from anywhere. Because it's public, **keep the API key set**. Tailscale works too if the team already uses it.

**Option C: VM on NAT instead of bridged.** VirtualBox → Settings → Network → Advanced → Port Forwarding: host port 8000 → guest port 8000. Teammates then use your laptop's IP.

### Step 10. Run the tests (optional)

```bash
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

They run without any tools installed (parsers use sample output; the API tests use fake mode).

---

## Demo-day checklist

- [ ] Host/VM up, `./run.sh` running, `/api/v1/health` shows all five tools installed.
- [ ] Demo target is an app **you own**, verified in the last 24 h (re-run `verify.sh check` that morning). The seeded `lab/vuln_app.py` deployed on your demo domain makes a great target: guaranteed critical findings.
- [ ] Run one full demo scan 10 minutes before you present (warms DNS and Nuclei's template cache). Demo profile finishes well under 2 minutes; the hard cap is 110 s.
- [ ] **Backup plan:** if Wi-Fi dies, set `ACHILLES_FAKE_TOOLS=1` in `.env` and restart. The API returns realistic canned results (~10 s) in the exact same format, so the frontend works unchanged.
- [ ] Teammates' frontend points at the right base URL and API key.

## Profiles

| Profile | Nmap | Nuclei | testssl | Hard deadline |
| --- | --- | --- | --- | --- |
| `demo` (default) | 40 focused ports (DBs, dev servers, admin panels) + the app's port | curated tags + `templates/achilles` | protocols + certificate | **110 s** |
| `web` | **skipped** (never port-scans) | curated tags, gentle rate (50 req/s) | protocols + certificate | **110 s** |
| `standard` | top 1000 ports | all templates, low+ | + ciphers, vulnerabilities | 15 min |
| `deep` | all 65535 ports | all templates, incl. info | full | 60 min |

Use `web` for apps on shared hosting (Railway, Vercel, Render...): ports on those hosts belong to the platform, not you, so Nmap is skipped and reported as `skipped` in `tools.nmap`. Start it with `./scripts/scan.sh https://myapp.up.railway.app web` (second argument = profile) or `"profile": "web"` in the API body.

Each tool has its own timeout too (see `app/profiles.py`). When a tool hits its limit it's killed, whatever it already found is kept, it's marked `timeout`, and the scan ends as `partial` instead of failing.

## Safety rules built in

- Scans only hosts that passed the DNS TXT / well-known file check (or are explicitly listed lab hosts).
- Blocks private, loopback, link-local, CGNAT and cloud-metadata addresses.
- Non-destructive: Nmap TCP connect scan with no NSE scripts; Nuclei excludes `intrusive,dos,fuzz,bruteforce,rce,sqli,xss,lfi,ssrf,default-login` tags and runs with interactsh off; the key checker only sends GETs to the target's own host.
- Leaked secrets are masked (`sk-pro…9xQa`) in every result. Raw tool output (under `data/raw/`, readable via the API with the key) is deleted after 7 days.

## Configuration

All settings are environment variables, usually set in `.env`. See [.env.example](.env.example) for the full list with comments.

## Layout

```
app/
  main.py          FastAPI routes
  scanner.py       job queue, parallel tool runs, timeouts, merging
  models.py        the ScanResult / Finding schema (pydantic)
  profiles.py      demo / web / standard / deep settings
  ownership.py     DNS TXT + well-known file verification
  targets.py       URL parsing, private-IP blocking
  runner.py        subprocess runner with hard kill on timeout
  fake.py          canned results for ACHILLES_FAKE_TOOLS=1
  tools/           one module per tool: build command, run, parse into Findings
templates/achilles curated Nuclei templates (.env, .git, Vite dev server, debug pages, Firebase)
lab/vuln_app.py    seeded vulnerable test app (fake secrets)
scripts/           scan.sh and verify.sh command-line helpers
docs/              API.md, SCHEMA.md, JSON Schema, example outputs
tests/             pytest suite
```
