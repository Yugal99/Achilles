#!/usr/bin/env bash
# One-time setup on Fedora. Run from the backend-a folder:  ./setup_fedora.sh
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$PATH:$HOME/go/bin"

echo "[1/7] Installing scanner tools and build deps from dnf (needs sudo)..."
sudo dnf install -y nmap testssl bind-utils util-linux python3 python3-pip golang curl jq openssl nodejs npm

echo "[2/7] Installing ProjectDiscovery httpx and Nuclei with Go (to ~/go/bin) ..."
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

echo "[2b] Installing TruffleHog (verified secret detection) ..."
if ! command -v trufflehog >/dev/null; then
  go install github.com/trufflesecurity/trufflehog/v3@latest 2>/dev/null \
    || { curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh | sh -s -- -b "$HOME/go/bin"; } \
    || echo "  ! trufflehog install failed; download a release from github.com/trufflesecurity/trufflehog/releases into ~/go/bin"
fi

echo "[2c] Installing Retire.js (vulnerable JS libraries) ..."
if ! command -v retire >/dev/null; then
  npm install -g retire 2>/dev/null || sudo npm install -g retire || echo "  ! retire install failed (npm install -g retire)"
fi

echo "[3/7] Creating Python virtualenv in .venv ..."
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip >/dev/null
./.venv/bin/pip install -r requirements.txt
./.venv/bin/pip install arjun   # hidden-parameter discovery; run.sh finds it in .venv/bin

echo "[4/7] Downloading Nuclei community templates (to ~/nuclei-templates) ..."
nuclei -update-templates || echo "  ! template download failed; the curated templates in templates/achilles still work"

echo "[5/7] Creating .env from .env.example (if missing) ..."
[ -f .env ] || cp .env.example .env

echo
echo "Tool check:"
for b in nmap httpx nuclei testssl trufflehog retire dig hexdump; do
  printf "  %-10s %s\n" "$b" "$(command -v "$b" || echo MISSING)"
done
printf "  %-10s %s\n" arjun "$(command -v arjun || ls ./.venv/bin/arjun 2>/dev/null || echo MISSING)"
echo
echo "Make ~/go/bin permanent:  echo 'export PATH=\"\$PATH:\$HOME/go/bin\"' >> ~/.zshrc"
echo "If port 8000 isn't reachable from other machines:  sudo firewall-cmd --add-port=8000/tcp --permanent && sudo firewall-cmd --reload"
echo "Done. Next: edit .env (set ACHILLES_API_KEY), then ./run.sh"
