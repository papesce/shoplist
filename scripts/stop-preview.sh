#!/bin/bash
set -euo pipefail
PORT=4173
LOG="/tmp/shoplist-preview.log"

if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "→ Stopping Shoplist preview on :$PORT ..."
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 0.5
  echo "✔ Stopped. (log: $LOG)"
else
  echo "No preview running on :$PORT"
fi

# Also kill pidfile if exists
if [[ -f /tmp/shoplist-preview.pid ]]; then
  PID=$(cat /tmp/shoplist-preview.pid 2>/dev/null || true)
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f /tmp/shoplist-preview.pid
fi
