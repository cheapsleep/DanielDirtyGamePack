#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CLIENT_DIR="$ROOT_DIR/client"
LOG_DIR="$ROOT_DIR/dev/logs"
mkdir -p "$LOG_DIR"

# Ensure node deps
if [ ! -d "$CLIENT_DIR/node_modules" ]; then
  echo "Installing client dependencies..."
  (cd "$CLIENT_DIR" && npm ci)
else
  echo "node_modules already present";
fi

# Start dev server with default server URL
export VITE_SERVER_URL="https://server.danielsdgp.com"
export VITE_PUBLIC_SERVER_URL="$VITE_SERVER_URL"

echo "Starting client dev server (Vite) with VITE_SERVER_URL=$VITE_SERVER_URL"
(cd "$CLIENT_DIR" && nohup npm run dev > "$LOG_DIR/client.log" 2>&1 & echo $! > "$LOG_DIR/client.pid")

sleep 1
PID=$(cat "$LOG_DIR/client.pid")
echo "Client dev server started (pid: $PID). Tail of log:"
tail -n 30 "$LOG_DIR/client.log" || true

echo "If you want to stop it: kill "+$(cat "$LOG_DIR/client.pid")
