# Achilles Backend A: Kali scanner service

A small API that runs on a Kali Linux VM. You give it a URL you own, it runs **Nmap, httpx, Nuclei, testssl.sh and a leaked-key/header checker** in parallel, and it returns one JSON report. Backend B and the frontend only ever talk to this API.

- API reference: [docs/API.md](docs/API.md)
- Result format (the JSON everyone builds against): [docs/SCHEMA.md](docs/SCHEMA.md)
- Real example output: [docs/examples/lab-scan-result.json](docs/examples/lab-scan-result.json)

---

## Step-by-step: set it up on your Kali VM

### Step 1. Give the VM a network your teammates can reach

Do this in VirtualBox/VMware **before** booting Kali (VM powered off):

- **VirtualBox:** Settings → Network → Adapter 1 → *Attached to:* **Bridged Adapter** → pick your laptop's Wi-Fi or Ethernet card.
- **VMware:** VM Settings → Network Adapter → **Bridged**.
- **UTM (Mac):** Network → **Bridged (Advanced)**.

Bridged gives the VM its own IP on the same network as your teammates. Give the VM at least 2 CPUs and 4 GB RAM.

> If your hackathon Wi-Fi blocks laptop-to-laptop traffic (common), skip to Step 9, option B (tunnel).

### Step 2. Get the code into the VM

Copy the whole `backend-a` folder into the VM, e.g. to `~/achilles/backend-a`. Either:

```bash
# if it's in your team's GitHub repo
git clone https://github.com/<you>/achilles.git ~/achilles
cd ~/achilles/backend-a
```

or drag the folder in with VirtualBox shared folders / `scp -r backend-a kali@<vm-ip>:~/achilles/`.

### Step 3. Run the setup script (installs everything)

```bash
cd ~/achilles/backend-a
chmod +x setup_kali.sh run.sh scripts/*.sh lab/vuln_app.py
./setup_kali.sh
```

It installs `nmap httpx-toolkit nuclei testssl.sh dnsutils bsdextrautils python3-venv jq`, creates a Python virtualenv in `.venv`, downloads the Nuclei templates and creates `.env`. At the end it prints a tool check; every line should show a path, none should say `MISSING`.

<details><summary>Doing it by hand instead</summary>

```bash
sudo apt update
sudo apt install -y nmap httpx-toolkit nuclei testssl.sh dnsutils bsdextrautils python3-venv python3-pip curl jq
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
nuclei -update-templates
cp .env.example .env
```

Note: on Kali, ProjectDiscovery's httpx is called **`httpx-toolkit`** (plain `httpx` is a Python library). testssl.sh is called **`testssl`**. The service finds both automatically.
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
ip -4 -br addr        # look for eth0, e.g. 192.168.1.42/24
```

Kali has no firewall enabled by default. If you installed `ufw`, run `sudo ufw allow 8000/tcp`.

### Step 9. Let teammates use it

**Option A: same network (bridged VM).** Teammates use `http://<vm-ip>:8000` with header `X-API-Key: <key>`. Test from a teammate's laptop:

```bash
curl -s http://192.168.1.42:8000/api/v1/health
```

Set `ACHILLES_CORS_ORIGINS` in `.env` to the frontend's origin(s) (e.g. `http://localhost:3000,https://achilles.yourdomain.xyz`) or keep `*`.

**Option B: different networks, or the Wi-Fi blocks peer traffic.** Open a free tunnel from the VM:

```bash
# amd64 VM; on an Apple-silicon Mac (UTM) use cloudflared-linux-arm64.deb
curl -LO https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
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

- [ ] VM booted, `./run.sh` running, `/api/v1/health` shows all five tools installed.
- [ ] Demo target is an app **you own**, verified in the last 24 h (re-run `verify.sh check` that morning). The seeded `lab/vuln_app.py` deployed on your demo domain makes a great target: guaranteed critical findings.
- [ ] Run one full demo scan 10 minutes before you present (warms DNS and Nuclei's template cache). Demo profile finishes well under 2 minutes; the hard cap is 110 s.
- [ ] **Backup plan:** if Wi-Fi dies, set `ACHILLES_FAKE_TOOLS=1` in `.env` and restart. The API returns realistic canned results (~10 s) in the exact same format, so the frontend works unchanged.
- [ ] Teammates' frontend points at the right base URL and API key.

## Profiles

| Profile | Nmap | Nuclei | testssl | Hard deadline |
| --- | --- | --- | --- | --- |
| `demo` (default) | 40 focused ports (DBs, dev servers, admin panels) + the app's port | curated tags + `templates/achilles` | protocols + certificate | **110 s** |
| `standard` | top 1000 ports | all templates, low+ | + ciphers, vulnerabilities | 15 min |
| `deep` | all 65535 ports | all templates, incl. info | full | 60 min |

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
  profiles.py      demo / standard / deep settings
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
