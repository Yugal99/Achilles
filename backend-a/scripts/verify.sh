#!/usr/bin/env bash
# Ownership: get a token for a host, then check it.
#   ./scripts/verify.sh challenge myapp.example.com
#   ./scripts/verify.sh check     myapp.example.com
set -euo pipefail
API="${API:-http://localhost:8000}"; KEY="${ACHILLES_API_KEY:-}"
H=(-H "content-type: application/json"); [ -n "$KEY" ] && H+=(-H "X-API-Key: $KEY")
case "${1:-}" in
  challenge) curl -sS "${H[@]}" -X POST "$API/api/v1/ownership/challenge" -d "{\"target\":\"$2\"}" | jq . ;;
  check)     curl -sS "${H[@]}" -X POST "$API/api/v1/ownership/verify" -d "{\"target\":\"$2\"}" | jq . ;;
  *) echo "usage: verify.sh challenge|check <host>"; exit 1 ;;
esac
