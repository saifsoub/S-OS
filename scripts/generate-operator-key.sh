#!/usr/bin/env bash
set -euo pipefail
echo "S_AGENTOS_OPERATOR_KEY=$(openssl rand -base64 32)"
echo "N8N_ENCRYPTION_KEY=$(openssl rand -base64 24)"
