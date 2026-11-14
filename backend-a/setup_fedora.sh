#!/usr/bin/env bash
# One-time setup on Fedora. Run from the backend-a folder:  ./setup_fedora.sh
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$PATH:$HOME/go/bin"

echo "[1/5] Installing scanner tools and build deps from dnf (needs sudo)..."
sudo dnf install -y nmap testssl bind-utils util-linux python3 python3-pip golang curl jq openssl

echo "[2/5] Installing ProjectDiscovery httpx and Nuclei with Go (to ~/go/bin) ..."
go install github.com/projectdiscovery/httpx/cmd/httpx@latest
go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest

echo "[3/5] Creating Python virtualenv in .venv ..."
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip >/dev/null
./.venv/bin/pip install -r requirements.txt

echo "[4/5] Downloading Nuclei community templates (to ~/nuclei-templates) ..."
nuclei -update-templates || echo "  ! template download failed; the curated templates in templates/achilles still work"

echo "[5/5] Creating .env from .env.example (if missing) ..."
[ -f .env ] || cp .env.example .env

echo
echo "Tool check:"
for b in nmap httpx nuclei testssl dig hexdump; do
  printf "  %-10s %s\n" "$b" "$(command -v "$b" || echo MISSING)"
done
echo
echo "Make ~/go/bin permanent:  echo 'export PATH=\"\$PATH:\$HOME/go/bin\"' >> ~/.zshrc"
echo "If port 8000 isn't reachable from other machines:  sudo firewall-cmd --add-port=8000/tcp --permanent && sudo firewall-cmd --reload"
echo "Done. Next: edit .env (set ACHILLES_API_KEY), then ./run.sh"
