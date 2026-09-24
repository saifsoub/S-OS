#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/s-os}"
ENV_DIR="/etc/s-agent"
ENV_FILE="$ENV_DIR/runtime.env"
STATE_DIR="/var/lib/s-agent"
LOG_DIR="/var/log/s-agent"
SERVICE_NAME="s-agent.service"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "missing required command: $1" >&2
    exit 1
  }
}

require systemctl
require git
require tailscale
require codex

if ! tailscale status >/dev/null 2>&1; then
  echo "tailscale is installed but not connected" >&2
  exit 1
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "expected S-OS repository at $REPO_DIR" >&2
  exit 1
fi

sudo install -d -m 0750 "$ENV_DIR" "$STATE_DIR" "$LOG_DIR"

if ! id -u s-agent >/dev/null 2>&1; then
  sudo useradd --system --home "$STATE_DIR" --shell /usr/sbin/nologin s-agent
fi

sudo chown -R s-agent:s-agent "$STATE_DIR" "$LOG_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  sudo tee "$ENV_FILE" >/dev/null <<'EOF'
# Command that launches the already-installed server-side agent/bridge worker.
# Keep provider tokens and MCP credentials in this root-owned file only.
#
# Example shape:
# S_AGENT_COMMAND='your-minis-or-bridge worker command here'
S_AGENT_COMMAND=''
EOF
  sudo chmod 0600 "$ENV_FILE"
  echo "created $ENV_FILE"
fi

sudo install -m 0755 "$REPO_DIR/scripts/s-agent-entrypoint.sh" /opt/s-os/scripts/s-agent-entrypoint.sh
sudo install -m 0644 "$REPO_DIR/systemd/s-agent.service" /etc/systemd/system/s-agent.service

sudo systemctl daemon-reload

if ! sudo grep -Eq '^S_AGENT_COMMAND=.+[^'\''"]$|^S_AGENT_COMMAND=['\''"].+['\'']$|^S_AGENT_COMMAND=".+">$' "$ENV_FILE" 2>/dev/null; then
  echo
  echo "Persistent service installed but not started."
  echo "Set S_AGENT_COMMAND in $ENV_FILE to the working Minis/Bridge worker command, then run:"
  echo "  sudo systemctl enable --now $SERVICE_NAME"
  exit 2
fi

sudo systemctl enable --now "$SERVICE_NAME"
sleep 2
sudo systemctl --no-pager --full status "$SERVICE_NAME"
