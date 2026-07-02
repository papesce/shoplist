#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"

case "${1:-}" in
  open)
    open "$DIR/index.html"
    ;;
  edit)
    open "$DIR" -a TextEdit
    ;;
  path)
    echo "$DIR/index.html"
    ;;
  *)
    echo "Uso: shopier.sh {open|edit|path}"
    ;;
esac
