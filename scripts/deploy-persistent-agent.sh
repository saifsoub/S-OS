#!/usr/bin/env bash
# Deploy the merged S-CLI service on the server and verify its local readiness.
set -euo pipefail

repo_dir="${S_OS_DIR:-/opt/s-os}"
cd "$repo_dir"
git fetch origin main
git switch main
git pull --ff-only origin main

sudo bash scripts/install-persistent-agent.sh
tailscale status >/dev/null
s-cli --version
test "$(systemctl is-enabled s-agent.service)" = enabled
test "$(systemctl is-active s-agent.service)" = active
sudo systemctl --no-pager --full status s-agent.service
echo "LOCAL SERVICE PASS. Complete deployment acceptance with an authenticated bridge task receipt and a second task after reboot."
