#!/bin/bash
set -euo pipefail

# Builds Shoplist.app — one-click launcher (preview, hidden Terminal, .icns)
# Usage: ./scripts/make-app.sh [--open]

DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP="$DIR/Shoplist.app"
RESOURCES="$APP/Contents/Resources"
MACOS="$APP/Contents/MacOS"
ICON_SRC="/tmp/AppIcon.icns"
ICONSET_TMP="/tmp/AppIcon.iconset"
VERSION="$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")"

# --- 0. Ensure icon exists (generate if missing) ---
if [[ ! -f "$ICON_SRC" ]]; then
  echo "→ Generating AppIcon.icns from public/logo.svg ..."
  if ! python3 -c "import cairosvg, PIL" 2>/dev/null; then
    echo "  Installing Python deps (cairosvg/Pillow)..."
    pip3 install --break-system-packages --quiet cairosvg Pillow 2>&1 | tail -3
  fi
  # Ensure cairo lib
  if ! python3 -c "import cairosvg" 2>/dev/null; then
    echo "  Installing cairo via brew..."
    brew install cairo --quiet 2>&1 | tail -3
  fi
  python3 << 'PY'
import cairosvg, pathlib
from PIL import Image
svg = pathlib.Path("public/logo.svg")
tmp = pathlib.Path("/tmp/shoplist-iconset-gen")
tmp.mkdir(parents=True, exist_ok=True)
png1024 = tmp / "icon_1024.png"
cairosvg.svg2png(url=str(svg), write_to=str(png1024), output_width=1024, output_height=1024)
iconset = pathlib.Path("/tmp/AppIcon.iconset")
iconset.mkdir(parents=True, exist_ok=True)
for f in iconset.glob("*"): f.unlink()
im = Image.open(png1024).convert("RGBA")
for base, scale in [(16,1),(16,2),(32,1),(32,2),(128,1),(128,2),(256,1),(256,2),(512,1),(512,2)]:
    sz = base*scale
    name = f"icon_{base}x{base}{'@2x' if scale==2 else ''}.png"
    im.resize((sz,sz), Image.LANCZOS).save(iconset/name, "PNG")
PY
  iconutil -c icns "$ICONSET_TMP" -o "$ICON_SRC"
  echo "  ✔ Icon at $ICON_SRC ($(du -h "$ICON_SRC" | cut -f1))"
fi

# --- 1. Clean previous bundle (osacompile needs non-existing or empty path) ---
echo "→ Creating Shoplist.app bundle ..."
rm -rf "$APP"

# --- 2. Write AppleScript source ---
# Embed absolute project path so app works when moved (re-run script to update)
cat > /tmp/shoplist-applet.applescript <<APPLESCRIPT
on run
  -- launch preview hidden; path embedded at build time
  do shell script quoted form of POSIX path of "${DIR}/scripts/launch-preview.sh" & " 2>&1 &"
  delay 1
  do shell script "sleep 1.5; open http://127.0.0.1:4173/ &> /dev/null &"
end run
on quit
  -- stop preview when app is quit (Cmd+Q or Quit from Dock)
  try
    do shell script quoted form of POSIX path of "${DIR}/scripts/stop-preview.sh" & " &> /dev/null"
  end try
  continue quit
end quit
on open location f
  run
end open
APPLESCRIPT

# --- 6. Compile applet ---
echo "→ Compiling AppleScript applet ..."
osacompile -o "$APP" /tmp/shoplist-applet.applescript 2>&1
# osacompile creates its own structure; ensure our icon/plist merged
# osacompile -o $APP will overwrite Contents; so re-apply our plist/icon after
# Actually osacompile creates Shoplist.app with its own Info.plist; merge LSUIElement/icon

# osacompile behavior: it creates $APP as applet bundle. We need to inject our plist values.
/usr/libexec/PlistBuddy -c "Set :CFBundleName Shoplist" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Shoplist" "$APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Shoplist" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.shoplist.app" "$APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.shoplist.app" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile AppIcon" "$APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string AppIcon" "$APP/Contents/Info.plist"
# LSUIElement = show in Dock so Quit (Cmd+Q / right-click) is discoverable
/usr/libexec/PlistBuddy -c "Delete :LSUIElement" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool false" "$APP/Contents/Info.plist"
# Fix icon name (osacompile sets applet)
/usr/libexec/PlistBuddy -c "Set :CFBundleIconName AppIcon" "$APP/Contents/Info.plist" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :CFBundleIconName string AppIcon" "$APP/Contents/Info.plist" 2>/dev/null || true

# Restore icon (osacompile wipes Resources)
cp "$ICON_SRC" "$APP/Contents/Resources/AppIcon.icns"

# Fix executable permissions
chmod +x "$APP/Contents/MacOS/applet" 2>/dev/null || true

# --- 7. Clear quarantine, touch ---
xattr -cr "$APP" 2>/dev/null || true
touch "$APP"

echo "✔ Shoplist.app created at $APP"
echo "  Version: $VERSION  Icon: AppIcon.icns  LSUIElement: hidden"
plutil -lint "$APP/Contents/Info.plist" && echo "  ✔ Info.plist valid"
ls -lh "$APP/Contents/Resources/AppIcon.icns" | awk '{print "  Icon size:", $5}'

if [[ "${1:-}" == "--open" ]]; then
  echo "→ Opening Shoplist.app ..."
  open "$APP"
fi

echo ""
echo "Done. Double-click Shoplist.app or drag it to Dock/Applications."
echo "To rebuild after moving project: ./scripts/make-app.sh"
