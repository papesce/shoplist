#!/bin/bash
set -euo pipefail

# Shoplist preview launcher — called by Shoplist.app (hidden, no Terminal)
# Logs to /tmp/shoplist-preview.log

DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="/tmp/shoplist-preview.log"
PORT=4173

# Ensure PATH includes Homebrew/node for GUI launch (do shell script has minimal PATH)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

exec >>"$LOG" 2>&1
echo "=== Shoplist launch $(date) ==="
echo "DIR=$DIR PORT=$PORT"

cd "$DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node not found in PATH=$PATH"
  osascript -e 'display alert "Shoplist" message "Node.js no encontrado. Instalá Node 18+ desde https://nodejs.org" as critical' || true
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "node_modules missing — running npm install..."
  npm install
fi

if [[ ! -d dist ]]; then
  echo "dist/ missing — running build..."
  npm run build
fi

# Exclusive-mode guard: refuse if dev is running (unless FORCE=1)
if [[ "${FORCE:-0}" != "1" ]] && lsof -ti :5173 >/dev/null 2>&1; then
  echo "ERROR: Dev mode is running on :5173. Stop dev before launching preview."
  echo "  → ./shopier.sh stop  or  lsof -ti :5173 | xargs kill -9"
  echo "  (set FORCE=1 to override)"
  osascript -e 'display alert "Shoplist" message "Dev está corriendo en :5173. Detenelo antes de iniciar preview." as critical' || true
  exit 1
fi

# Kill stale preview on PORT (only if not dev conflict)
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  if [[ "${FORCE:-0}" == "1" ]]; then
    echo "Killing stale process on :$PORT (FORCE=1)"
    lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  else
    # Check if it's a healthy preview - if so, don't auto-kill; tell user to stop
    if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      echo "ERROR: Preview already running on :$PORT. Run ./shopier.sh stop first."
      exit 1
    fi
    echo "Killing stale process on :$PORT"
    lsof -ti :"$PORT" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
fi

echo "Starting Shoplist server (SQLite) on :$PORT ..."
PORT="$PORT" nohup node server/index.mjs >>"$LOG" 2>&1 &
PID=$!
echo "$PID" > /tmp/shoplist-preview.pid
echo "server PID=$PID (pidfile /tmp/shoplist-preview.pid)"

# Wait for server to be ready (up to 10s)
for i in $(seq 1 20); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "Server ready after ${i} tries"
    break
  fi
  sleep 0.5
done

# Open browser (caller also does open, but keep as fallback)
open "http://127.0.0.1:$PORT/" || true
echo "Done."
