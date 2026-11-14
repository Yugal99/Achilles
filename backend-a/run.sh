#!/usr/bin/env bash
# Start the Achilles scanner API.  Usage: ./run.sh   (reads settings from .env)
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
HOST="${ACHILLES_HOST:-0.0.0.0}"
PORT="${ACHILLES_PORT:-8000}"
PY=./.venv/bin/python
[ -x "$PY" ] || PY=python3
echo "Achilles scanner API on http://$HOST:$PORT  (docs at /docs)"
exec "$PY" -m uvicorn app.main:app --host "$HOST" --port "$PORT" --log-level info
