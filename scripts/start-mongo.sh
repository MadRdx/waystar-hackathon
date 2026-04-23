#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if command -v mongosh >/dev/null 2>&1; then
  if mongosh --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
    echo "MongoDB is already running on localhost:27017."
    exit 0
  fi
fi

if command -v brew >/dev/null 2>&1 && brew services list | grep -q 'mongodb/brew/mongodb-community@7.0'; then
  echo "Starting MongoDB with Homebrew services..."
  brew services start mongodb/brew/mongodb-community@7.0 >/dev/null
elif command -v docker >/dev/null 2>&1; then
  echo "Starting MongoDB with Docker Compose..."
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d mongo >/dev/null
else
  echo "MongoDB could not be started automatically."
  echo "Install MongoDB via Homebrew or run Docker, then try again."
  exit 1
fi

if command -v mongosh >/dev/null 2>&1; then
  for _ in {1..15}; do
    if mongosh --quiet --eval 'db.runCommand({ ping: 1 })' >/dev/null 2>&1; then
      echo "MongoDB is ready."
      exit 0
    fi
    sleep 1
  done
fi

echo "MongoDB start command completed."
