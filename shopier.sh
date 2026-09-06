#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Shoplist — simple dev helper
# All port-conflict checks live in scripts/check-exclusive.mjs (run via npm pre-hooks).
# This script just forwards to npm.

die() { echo "✘ $*" >&2; exit 1; }
info() { echo "→ $*"; }

need() { command -v "$1" >/dev/null 2>&1 || die "Missing '$1'. Install Node.js 18+ (https://nodejs.org)"; }

# auto-install deps if needed (skip for clean/path/help)
case "${1:-help}" in clean|path|help|--help|-h|"") ;;
  *) [[ -d node_modules ]] || { info "Installing dependencies..."; npm install; } ;;
esac

usage() {
  cat <<EOF
Shoplist — dev helper

Usage: ./shopier.sh <command> [options]

Commands:
  dev [vite args]   Start Vite on http://localhost:5173  (npm run dev)
  build             Build for production                  (npm run build)
  preview [args]    Serve production build on :4173       (npm run preview)
  server            Run API server on :4173               (npm run server)
  stop              Stop anything on :4173
  install           Install dependencies                  (npm install)
  parse             Run scripts/parsear.mjs               (npm run parse)
  clean             Remove dist/ and node_modules/
  path              Print project path
  help              Show this help

Examples:
  ./shopier.sh dev -- --open
  ./shopier.sh build && ./shopier.sh preview

Requires: node >=18, npm
Note: Prefer 'npm run <script>' directly. This script is just a shortcut.
EOF
}

cmd="${1:-help}"
[[ "$cmd" == "help" ]] && cmd="--help"
shift 2>/dev/null || true

case "$cmd" in
  dev)
    need node; need npm
    npm run dev -- "$@"
    ;;
  build)
    need node; need npm
    npm run build
    ;;
  preview)
    need node; need npm
    [[ -d dist ]] || { info "dist/ missing — building first..."; npm run build; }
    npm run preview -- "$@"
    ;;
  server)
    need node; need npm
    npm run server
    ;;
  stop)
    if lsof -ti :4173 >/dev/null 2>&1; then
      info "Stopping :4173..."
      lsof -ti :4173 | xargs kill 2>/dev/null || true
      echo "Stopped."
    else
      echo "Nothing running on :4173."
    fi
    rm -f /tmp/shoplist-preview.pid /tmp/shoplist-dev-server.pid
    if lsof -ti :5173 >/dev/null 2>&1; then
      echo "Note: dev still on :5173 — close its terminal (Ctrl+C) or: lsof -ti :5173 | xargs kill"
    fi
    ;;
  install|i)
    need npm
    npm install
    ;;
  parse)
    need node
    npm run parse
    ;;
  clean)
    info "Cleaning dist/ and node_modules/..."
    rm -rf dist/ node_modules/
    echo "Done. Run ./shopier.sh install to reinstall."
    ;;
  path)
    pwd
    ;;
  --help|-h)
    usage
    ;;
  open|edit)
    die "'$cmd' was the old static starter. Use './shopier.sh dev -- --open' instead."
    ;;
  *)
    die "Unknown command: $cmd\n$(usage)"
    ;;
esac
