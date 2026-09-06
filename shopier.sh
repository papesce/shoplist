#!/bin/bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Colors (no-op if not tty)
if [[ -t 1 ]]; then
  BOLD="\033[1m"; DIM="\033[2m"; GREEN="\033[32m"; YELLOW="\033[33m"; RED="\033[31m"; RESET="\033[0m"
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi

info()  { echo -e "${DIM}→${RESET} $*"; }
ok()    { echo -e "${GREEN}✔${RESET} $*"; }
warn()  { echo -e "${YELLOW}⚠${RESET} $*"; }
die()   { echo -e "${RED}✘${RESET} $*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Falta '$1'. Instalá Node.js 18+ (https://nodejs.org) y reintentá."
}

ensure_deps() {
  if [[ ! -d node_modules ]]; then
    warn "node_modules no encontrado — instalando dependencias..."
    npm install
    ok "Dependencias instaladas."
  fi
}

# Exclusive-mode guards (dev :5173 vs preview/server :4173 share base/shoplist.db)
is_preview_running() {
  [[ -f /tmp/shoplist-preview.pid ]] && kill -0 "$(cat /tmp/shoplist-preview.pid 2>/dev/null)" 2>/dev/null && return 0
  lsof -ti :4173 >/dev/null 2>&1 && return 0
  curl -sf http://127.0.0.1:4173/api/health >/dev/null 2>&1 && return 0
  return 1
}
is_dev_running() {
  lsof -ti :5173 >/dev/null 2>&1 && return 0
  return 1
}
require_no_preview() {
  if is_preview_running; then
    die "Preview está corriendo en :4173. Detenelo antes de iniciar dev.\n  → ./shopier.sh stop  (preview should be stopped to launch dev mode)"
  fi
}
require_no_dev() {
  if is_dev_running; then
    die "Dev está corriendo en :5173. Detenelo (Ctrl+C) antes de iniciar preview.\n  → lsof -ti :5173 | xargs kill -9  (preview only can run if dev mode is stopped)"
  fi
}

usage() {
  cat <<EOF
${BOLD}Shoplist — dev starter${RESET}

Uso: ./shopier.sh <comando> [opciones]

Comandos:
  dev [--open]     Inicia Vite en http://localhost:5173 (instala deps si faltan)
  build            Compila TS + genera dist/ (tsc -b && vite build)
  preview [--open] Sirve el build de producción (vite preview)
  stop             Detiene el preview en :4173 (usado por Shoplist.app)
  install          Instala dependencias (npm install)
  parse            Ejecuta scripts/parsear.mjs → base/productos.json
  clean            Borra dist/ y node_modules/
  path             Imprime ruta del proyecto
  help             Muestra esta ayuda

Ejemplos:
  ./shopier.sh dev          # desarrollo
  ./shopier.sh dev --open   # desarrollo + abre navegador
  ./shopier.sh build        # build producción
  ./shopier.sh preview      # previsualizar build

Requiere: node >=18, npm
EOF
}

CMD="${1:-help}"
shift || true

case "$CMD" in
  dev)
    need_cmd node; need_cmd npm
    ensure_deps
    require_no_preview
    # Auto-start API server for dev (shares base/shoplist.db); reused if already on :4173 from previous dev run
    if ! lsof -ti :4173 >/dev/null 2>&1 && ! curl -sf http://127.0.0.1:4173/api/health >/dev/null 2>&1; then
      info "Iniciando API server en :4173 (base/shoplist.db)..."
      PORT=4173 nohup node server/index.mjs > /tmp/shoplist-dev-server.log 2>&1 &
      echo $! > /tmp/shoplist-dev-server.pid
      # wait for health
      for i in $(seq 1 20); do curl -sf http://127.0.0.1:4173/api/health >/dev/null 2>&1 && break; sleep 0.3; done
      # cleanup on exit (only if we started it)
      trap '[[ -f /tmp/shoplist-dev-server.pid ]] && kill $(cat /tmp/shoplist-dev-server.pid) 2>/dev/null || true; rm -f /tmp/shoplist-dev-server.pid' EXIT INT TERM
    else
      info "API server ya está en :4173 — reutilizando."
    fi
    info "Iniciando dev server en :5173..."
    if [[ "${1:-}" == "--open" ]]; then
      npm run dev -- --open
    else
      npm run dev
    fi
    ;;
  build)
    need_cmd node; need_cmd npm
    ensure_deps
    info "Compilando..."
    npm run build
    ok "Build en dist/"
    ;;
  preview)
    need_cmd node; need_cmd npm
    ensure_deps
    require_no_dev
    if is_preview_running; then
      die "Preview/server ya está corriendo en :4173. Detenelo primero:\n  → ./shopier.sh stop"
    fi
    if [[ ! -d dist ]]; then
      warn "dist/ no existe — ejecutando build primero..."
      npm run build
    fi
    info "Sirviendo con SQLite en :4173 (node server/index.mjs)..."
    if [[ "${1:-}" == "--open" ]]; then
      PORT=4173 node server/index.mjs &
      sleep 1; open http://127.0.0.1:4173/
      wait
    else
      PORT=4173 node server/index.mjs
    fi
    ;;
  server)
    need_cmd node; need_cmd npm
    ensure_deps
    require_no_dev
    if is_preview_running; then
      die "Preview/server ya está corriendo en :4173. Detenelo primero:\n  → ./shopier.sh stop"
    fi
    info "Iniciando server SQLite en :4173..."
    PORT=4173 node server/index.mjs
    ;;
  stop)
    stopped=0
    if lsof -ti :4173 >/dev/null 2>&1; then
      info "Deteniendo preview/server en :4173..."
      lsof -ti :4173 | xargs kill -9 2>/dev/null || true
      stopped=1
    fi
    if [[ -f /tmp/shoplist-preview.pid ]]; then
      PID=$(cat /tmp/shoplist-preview.pid 2>/dev/null || true)
      [[ -n "${PID:-}" ]] && kill -9 "$PID" 2>/dev/null || true
      rm -f /tmp/shoplist-preview.pid
      stopped=1
    fi
    if [[ -f /tmp/shoplist-dev-server.pid ]]; then
      PID=$(cat /tmp/shoplist-dev-server.pid 2>/dev/null || true)
      [[ -n "${PID:-}" ]] && kill -9 "$PID" 2>/dev/null || true
      rm -f /tmp/shoplist-dev-server.pid
      stopped=1
    fi
    # Also remove log hints
    if [[ $stopped -eq 1 ]]; then ok "Detenido."; else info "No hay preview corriendo en :4173."; fi
    if lsof -ti :5173 >/dev/null 2>&1; then
      warn "Dev todavía está en :5173 — cerrá la terminal de dev (Ctrl+C) o: lsof -ti :5173 | xargs kill -9"
    fi
    ;;
  install|i)
    need_cmd npm
    npm install
    ok "Listo."
    ;;
  parse)
    need_cmd node
    npm run parse
    ;;
  clean)
    info "Limpiando..."
    rm -rf dist/ node_modules/
    ok "Limpio. Corré ./shopier.sh install para reinstalar."
    ;;
  path)
    echo "$DIR"
    ;;
  help|--help|-h|"")
    usage
    ;;
  open|edit)
    warn "'$CMD' es del starter viejo (abría index.html estático)."
    echo "Usá './shopier.sh dev --open' para desarrollo o './shopier.sh build && ./shopier.sh preview --open' para el build."
    echo ""
    usage
    exit 1
    ;;
  *)
    die "Comando desconocido: $CMD\n$(usage)"
    ;;
esac
