# S-CLI persistent server agent

## Goal

Run the existing S/ worker permanently on the server rather than depending on an interactive ChatGPT, Work, SSH, or Codex session.

The server-side execution identity is **S-CLI**.

```
authorized client/agent
        |
        v
Tailscale private network
        |
        v
S/ Bridge or Minis MCP
        |
        v
S-CLI persistent worker on the server
        |
        +--> server filesystem / server tools / approved MCPs
        +--> configured model provider when inference is required
```

ChatGPT and Work are optional clients. They are not the runtime.

## What "server-grounded" means

S-CLI is server-grounded for **execution**:

- the S-CLI process runs on the server;
- its working directory and filesystem access are on the server;
- bridge/MCP connectivity is initiated from the server-side worker;
- credentials remain server-side;
- disconnecting an SSH or ChatGPT session does not stop it.

This does **not** mean that model inference is automatically local. The underlying Codex CLI is an implementation dependency and may send model requests to its configured model provider. If a provider is OpenAI, inference traffic goes to OpenAI. If Minis/OpenRouter is configured, inference follows that provider configuration. The PR deliberately does not claim local-only inference unless a local model endpoint is explicitly configured.

To avoid identity confusion, operators and other agents should refer to the server worker as **S-CLI**, not "Codex". The installed `codex` binary remains an internal engine dependency.

## Bridge accessibility for other agents

The bridge is a **private agent-to-agent boundary**, not a public web endpoint.

Other agents may use it when all of the following are true:

1. the agent is on the approved Tailscale/private service fabric;
2. it has the bridge endpoint configured server-side;
3. it has the required bridge/MCP authentication;
4. the requested capability is exposed by the bridge;
5. the action passes the existing S/ authorization/approval policy.

The expected client configuration is kept outside Git:

```dotenv
S_BRIDGE_URL=<private tailscale/mcp endpoint>
S_BRIDGE_AUTH_TOKEN=<server-side secret>
```

The bridge itself is not newly implemented by this PR. This PR makes the already-working bridge/worker path persistent. If the bridge offers MCP tools such as task claim/dispatch/result operations, any approved agent can invoke those tools through the same authenticated private endpoint. No agent should require an interactive SSH session.

### Agent usability contract

For an agent to be considered bridge-ready it must be able to:

- discover the bridge or be given its private endpoint;
- authenticate without embedding secrets in prompts or browser bundles;
- submit/claim a task through the bridge's existing interface;
- receive a structured result/receipt;
- distinguish execution failure from model/provider failure;
- retry idempotently where supported.

A successful TCP connection alone is not proof of readiness. One end-to-end task receipt is required.

## Existing assumptions

This procedure is intentionally narrow. It does not redesign the stack.

- the server is already running;
- the Codex CLI engine is already installed;
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

The installer also creates `/usr/local/bin/s-cli`. That wrapper invokes the installed Codex CLI engine while keeping the operator-facing identity as S-CLI.

## Verification

```bash
tailscale status
s-cli --version
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
- secrets live in `/etc/s-agent/runtime.env` with mode `0640`, owned by `root:s-agent` inside a `0750` directory;
- the service runs as `s-agent`, not root;
- no provider token is added to browser code;
- no public Funnel exposure is required.

## Rollback

```bash
sudo systemctl disable --now s-agent.service
sudo rm -f /etc/systemd/system/s-agent.service
sudo rm -f /usr/local/bin/s-cli
sudo systemctl daemon-reload
```

This stops persistence without removing the Codex CLI engine, Minis, Tailscale, S-OS, or existing bridge files.
