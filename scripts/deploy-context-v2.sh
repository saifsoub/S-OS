#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERROR: .env is required; do not deploy with example credentials." >&2
  exit 2
fi

required=(S_CONTEXT_OPERATOR_KEY)
for key in "${required[@]}"; do
  if ! grep -qE "^${key}=.+" .env; then
    echo "ERROR: ${key} is missing from .env" >&2
    exit 2
  fi
done

if grep -qE '^S_CONTEXT_OPERATOR_KEY=(change-me|$)' .env; then
  echo "ERROR: S_CONTEXT_OPERATOR_KEY is not production-safe" >&2
  exit 2
fi

docker compose build s-context-v2
docker compose up -d --no-deps s-context-v2

port="$(awk -F= '/^S_CONTEXT_PORT=/{print $2}' .env | tail -1)"
port="${port:-8787}"
for _ in $(seq 1 30); do
  if curl --fail --silent --show-error "http://127.0.0.1:${port}/health" >/tmp/s-context-v2-health.json 2>/dev/null; then
    cat /tmp/s-context-v2-health.json
    echo
    docker compose ps s-context-v2
    exit 0
  fi
  sleep 2
done

echo "ERROR: S/Context v2 failed health check" >&2
docker compose logs --tail=100 s-context-v2 >&2 || true
exit 1
