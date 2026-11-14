#!/usr/bin/env bash
# Start a scan and poll until it finishes, then print a summary.
#   ./scripts/scan.sh https://myapp.example.com [demo|web|standard|deep]
# Env: API (default http://localhost:8000), ACHILLES_API_KEY
set -euo pipefail
TARGET="${1:?usage: scan.sh <url> [profile]}"; PROFILE="${2:-demo}"
API="${API:-http://localhost:8000}"; KEY="${ACHILLES_API_KEY:-}"
H=(-H "content-type: application/json"); [ -n "$KEY" ] && H+=(-H "X-API-Key: $KEY")
R=$(curl -sS "${H[@]}" -X POST "$API/api/v1/scans" -d "{\"target\":\"$TARGET\",\"profile\":\"$PROFILE\"}")
ID=$(echo "$R" | jq -r '.scan_id // empty')
[ -n "$ID" ] || { echo "$R" | jq .; exit 1; }
echo "scan $ID started"
while :; do
  S=$(curl -sS "${H[@]}" "$API/api/v1/scans/$ID")
  ST=$(echo "$S" | jq -r .status)
  printf "\r%-10s %3s%%  %s" "$ST" "$(echo "$S" | jq -r .progress)" \
    "$(echo "$S" | jq -r '[.tools|to_entries[]|"\(.key):\(.value.status)"]|join(" ")')"
  case "$ST" in queued|running) sleep 2;; *) echo; break;; esac
done
curl -sS "${H[@]}" "$API/api/v1/scans/$ID/results" | jq -r '
  "status: \(.status)  duration: \(.duration_s)s  grade: \(.summary.grade)  risk: \(.summary.risk_score)",
  (.findings[] | select(.severity != "info") | "  [\(.severity)] \(.title)  @ \(.location)")'
