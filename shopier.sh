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

usage() {
  cat <<EOF
${BOLD}Shoplist — dev starter${RESET}

Uso: ./shopier.sh <comando> [opciones]

Comandos:
  dev [--open]     Inicia Vite en http://localhost:5173 (instala deps si faltan)
  build            Compila TS + genera dist/ (tsc -b && vite build)
  preview [--open] Sirve el build de producción (vite preview)
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
    info "Iniciando dev server..."
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
    if [[ ! -d dist ]]; then
      warn "dist/ no existe — ejecutando build primero..."
      npm run build
    fi
    info "Sirviendo preview..."
    if [[ "${1:-}" == "--open" ]]; then
      npm run preview -- --open
    else
      npm run preview
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
