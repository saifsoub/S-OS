# S/ private server bridge

Dependency-free Python 3 HTTP bridge for the existing server. It exposes authenticated GET /health and GET /v1/server/verify on port 8791. Verification returns bounded diagnostic results and a request receipt. This receipt is not a mission completion receipt or proof of restart durability. No command execution API, logs, credentials, or Tailscale peer inventory is exposed.

Install on the existing server after reviewing this change:

```bash
cd /opt/s-os
sudo install -d -m 0750 -o root -g s-agent /etc/s-agent
sudo sh -c 'umask 077; printf "S_SERVER_BRIDGE_TOKEN=%s\nS_SERVER_BRIDGE_BIND=127.0.0.1\n" "$(openssl rand -hex 32)" > /etc/s-agent/bridge.env'
sudo install -m 0644 systemd/s-server-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now s-server-bridge
systemctl is-active s-server-bridge
```

Do not overwrite an existing bridge.env. Keep the generated token off GitHub and chat. The default loopback listener needs an existing private tunnel or a separately authorized Tailscale interface binding. Do not expose port 8791 publicly or use Tailscale Funnel. An external client must have an authorized route and secure token binding; this change alone cannot make ChatGPT reach the server.

The s-agent account must already exist from the persistent agent installer. Missing commands and insufficient permissions produce failed checks rather than requiring root execution. n8n readiness assumes the existing loopback port 5678. For another port, change the fixed reviewed command before deployment.

Tests: python3 -m unittest discover -s tests -p test_server_diagnostic_bridge.py -v

Rollback: sudo systemctl disable --now s-server-bridge

Host installation, private routing, credential binding, and live acceptance remain unverified until performed on the server.
