# Persistent server agent

## Goal

Run the existing S/ agent worker permanently on the server rather than depending on an interactive ChatGPT, Work, SSH, or Codex session.

The control model is:

```
client(s) -> S/ private bridge -> persistent server agent -> Codex / Minis / approved MCP tools
```

ChatGPT is an optional client. It is not the runtime.

## Existing assumptions

This procedure is intentionally narrow. It does not redesign the stack.

- the server is already running;
- Codex CLI is already installed;
- Minis and the S/ bridge already work interactively;
- Tailscale is the private network path;
- S-OS is checked out at `/opt/s-os`.

## Install

From the server:

```bash
cd /opt/s-os
git fetch origin
git checkout codex/persistent-server-agent
git pull
sudo bash scripts/install-persistent-agent.sh
```

On first run the installer creates:

```
/etc/s-agent/runtime.env
```

Put the exact command that currently starts the working Minis/Bridge worker into:

```bash
S_AGENT_COMMAND='...'
```

Do not put that command in GitHub if it contains credentials.

Then:

```bash
sudo systemctl enable --now s-agent.service
```

## Verification

```bash
tailscale status
codex --version
systemctl is-enabled s-agent.service
systemctl is-active s-agent.service
journalctl -u s-agent.service -n 100 --no-pager
```

The service is accepted only when all five checks pass and a real end-to-end task completes through the bridge.

## Restart behavior

The unit uses `Restart=always`, so the worker returns after:

- process crash;
- SSH disconnect;
- user logout;
- server reboot.

## Security boundary

- private exposure remains on Tailscale;
- secrets live in `/etc/s-agent/runtime.env` with mode `0600`;
- the service runs as `s-agent`, not root;
- no provider token is added to browser code;
- no public Funnel exposure is required.

## Rollback

```bash
sudo systemctl disable --now s-agent.service
sudo rm -f /etc/systemd/system/s-agent.service
sudo systemctl daemon-reload
```

This stops persistence without removing Codex, Minis, Tailscale, S-OS, or existing bridge files.
