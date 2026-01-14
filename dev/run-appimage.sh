#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
APPIMAGE_SRC="${ROOT_DIR}/build-artifacts/bundle/appimage/Daniels Dirty Game Pack_0.1.0_amd64.AppImage"
APPIMAGE_DST="${ROOT_DIR}/dev/Daniels_Dirty_Game_Pack.AppImage"
LOG_DIR="$ROOT_DIR/dev/logs"
mkdir -p "$LOG_DIR"
mkdir -p "$ROOT_DIR/dev"

if [ ! -f "$APPIMAGE_SRC" ]; then
  echo "AppImage not found at $APPIMAGE_SRC"
  exit 1
fi

cp "$APPIMAGE_SRC" "$APPIMAGE_DST"
chmod +x "$APPIMAGE_DST"

echo "Running AppImage: $APPIMAGE_DST"
nohup "$APPIMAGE_DST" > "$LOG_DIR/appimage.log" 2>&1 &
PID=$!
echo $PID > "$LOG_DIR/appimage.pid"

echo "AppImage started (pid: $PID). Tail of log:"
tail -n 40 "$LOG_DIR/appimage.log" || true

echo "To stop: kill $PID"
