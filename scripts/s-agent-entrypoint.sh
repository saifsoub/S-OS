#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${S_AGENT_ENV_FILE:-/etc/s-agent/runtime.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${S_AGENT_COMMAND:?S_AGENT_COMMAND is required in $ENV_FILE}"

exec /usr/bin/env bash -lc "$S_AGENT_COMMAND"
