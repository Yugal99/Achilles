#!/usr/bin/env bash
# One-time setup on Ubuntu/Debian (tested on Ubuntu 26.10) for running the backend WITHOUT Docker.
# Run from the backend-a folder:  ./setup_ubuntu.sh        (the Docker image already contains all of this)
set -euo pipefail
cd "$(dirname "$0")"

HTTPX_VERSION=1.12.0
NUCLEI_VERSION=3.11.1
TRUFFLEHOG_VERSION=3.99.9
RETIRE_VERSION=6.1.1
ARJUN_VERSION=2.2.7
BIN=/usr/local/bin

ARCH=$(dpkg --print-architecture)   # amd64 or arm64; the release assets use the same names
case "$ARCH" in amd64|arm64) ;; *) echo "Unsupported architecture: $ARCH"; exit 1 ;; esac

echo "[1/6] Installing packages with apt (needs sudo) ..."
sudo apt-get update -y
sudo apt-get install -y --no-install-recommends \
  nmap testssl.sh bsdextrautils dnsutils python3 python3-venv python3-pip \
  nodejs npm curl unzip ca-certificates jq openssl

fetch() {  # owner name version asset -> downloads and checksum-verifies into the current dir
  local owner=$1 name=$2 ver=$3 asset=$4
  local base="https://github.com/${owner}/${name}/releases/download/v${ver}"
  curl -fsSLO "${base}/${asset}"
  curl -fsSLO "${base}/${name}_${ver}_checksums.txt"
  grep " ${asset}\$" "${name}_${ver}_checksums.txt" | sha256sum -c -
}

echo "[2/6] Installing ProjectDiscovery httpx + nuclei and TruffleHog to $BIN ..."
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
(
  cd "$TMP"
  fetch projectdiscovery httpx  "$HTTPX_VERSION"  "httpx_${HTTPX_VERSION}_linux_${ARCH}.zip"
  unzip -oq "httpx_${HTTPX_VERSION}_linux_${ARCH}.zip" httpx
  fetch projectdiscovery nuclei "$NUCLEI_VERSION" "nuclei_${NUCLEI_VERSION}_linux_${ARCH}.zip"
  unzip -oq "nuclei_${NUCLEI_VERSION}_linux_${ARCH}.zip" nuclei
  fetch trufflesecurity trufflehog "$TRUFFLEHOG_VERSION" "trufflehog_${TRUFFLEHOG_VERSION}_linux_${ARCH}.tar.gz"
  tar -xzf "trufflehog_${TRUFFLEHOG_VERSION}_linux_${ARCH}.tar.gz" trufflehog
  sudo install -m 755 httpx nuclei trufflehog "$BIN/"
)

echo "[3/6] Installing Retire.js ..."
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$NODE_MAJOR" -ge 20 ]; then
  sudo npm install -g "retire@${RETIRE_VERSION}"
else
  echo "  ! Node $(node -v 2>/dev/null || echo missing) is too old for retire.js (needs >= 20.19). Install Node 22, then: sudo npm install -g retire"
fi

echo "[4/6] Creating Python virtualenv in .venv (+ arjun) ..."
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip >/dev/null
./.venv/bin/pip install -r requirements.txt "arjun==${ARJUN_VERSION}"   # run.sh finds arjun in .venv/bin

echo "[5/6] Creating .env from .env.example (if missing) ..."
[ -f .env ] || cp .env.example .env
# The venv's Python `httpx` package also ships an `httpx` CLI; pin the ProjectDiscovery one explicitly.
grep -q '^ACHILLES_HTTPX_BIN=' .env || echo "ACHILLES_HTTPX_BIN=$BIN/httpx" >> .env

echo "[6/6] Tool check:"
for b in nmap httpx nuclei testssl trufflehog retire dig hexdump; do
  printf "  %-10s %s\n" "$b" "$(command -v "$b" || echo MISSING)"
done
printf "  %-10s %s\n" arjun "$(ls ./.venv/bin/arjun 2>/dev/null || echo MISSING)"
"$BIN/httpx" -version 2>&1 | grep -qi projectdiscovery && echo "  httpx is ProjectDiscovery's: OK" || echo "  ! $BIN/httpx is not ProjectDiscovery httpx"
echo
echo "Done. Next: edit .env (set ACHILLES_API_KEY), then ./run.sh"
echo "If port 8000 must be reachable from other machines:  sudo ufw allow 8000/tcp"
