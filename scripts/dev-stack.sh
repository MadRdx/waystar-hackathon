#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

"$ROOT_DIR/scripts/start-mongo.sh"

if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]]; then
  echo "Backend virtual environment not found at backend/.venv."
  echo "Run 'uv venv --python 3.12 .venv' and 'uv pip install --python .venv/bin/python -r requirements.txt' inside backend first."
  exit 1
fi

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting FastAPI on http://127.0.0.1:8000 ..."
(
  cd "$BACKEND_DIR"
  ./.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) &
BACKEND_PID=$!

echo "Starting Next.js on http://127.0.0.1:3000 ..."
(
  cd "$ROOT_DIR"
  npm run dev -- --hostname 127.0.0.1 --port 3000
) &
FRONTEND_PID=$!

wait -n "$BACKEND_PID" "$FRONTEND_PID"
