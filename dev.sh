#!/usr/bin/env bash
# Start QISTAS locally: backend API (port 8000) + website (port 3000).
# Usage:  ./dev.sh        then open http://localhost:3000   (Ctrl+C stops both)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
UV="${UV:-$HOME/.local/bin/uv}"

sudo systemctl start postgresql 2>/dev/null || true

for port in 8000 3000; do
  if (exec 3<>/dev/tcp/127.0.0.1/$port) 2>/dev/null; then
    echo "Port $port is already in use (QISTAS may already be running in another terminal)."
    echo "Close that terminal or stop it with Ctrl+C, then run ./dev.sh again."
    exit 1
  fi
done

(cd "$ROOT/backend" && "$UV" run uvicorn app.api:app --port 8000) &
BACKEND=$!
trap 'kill $BACKEND 2>/dev/null' EXIT
for _ in $(seq 1 30); do (exec 3<>/dev/tcp/127.0.0.1/8000) 2>/dev/null && break; sleep 1; done
echo "Backend ready: http://127.0.0.1:8000/docs"
echo "Website:       http://localhost:3000"

cd "$ROOT/frontend"
[ -d node_modules ] || npm install
npm run dev
