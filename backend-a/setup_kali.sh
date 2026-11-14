#!/usr/bin/env bash
# One-time setup on a Kali Linux VM. Run from the backend-a folder:  ./setup_kali.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "[1/4] Installing scanner tools from the Kali repos (needs sudo)..."
sudo apt-get update
sudo apt-get install -y nmap httpx-toolkit nuclei testssl.sh dnsutils bsdextrautils \
                        python3 python3-venv python3-pip curl jq

echo "[2/4] Creating Python virtualenv in .venv ..."
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip >/dev/null
./.venv/bin/pip install -r requirements.txt

echo "[3/4] Downloading Nuclei community templates (to ~/nuclei-templates) ..."
nuclei -update-templates || echo "  ! template download failed; the curated templates in templates/achilles still work"

echo "[4/4] Creating .env from .env.example (if missing) ..."
[ -f .env ] || cp .env.example .env

echo
echo "Tool check:"
for b in nmap httpx-toolkit nuclei testssl dig hexdump; do
  printf "  %-14s %s\n" "$b" "$(command -v "$b" || echo MISSING)"
done
echo
echo "Done. Next: edit .env (set ACHILLES_API_KEY), then ./run.sh"
