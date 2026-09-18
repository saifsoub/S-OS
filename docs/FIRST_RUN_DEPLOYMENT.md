# First-Run Deployment — S/ AgentOS Kernel v0.1.3

This is an isolated first-run procedure. For an existing company installation,
inventory deployed versions, workflows, migrations and durable volumes first;
do not reapply the initial schema or replace an existing encryption key.

## 0. Security first

Rotate any token or API key that has ever appeared in a browser tab, screenshot, chat, terminal output, or shared file.

## 1. Prepare environment

```bash
cp .env.example .env
openssl rand -base64 32
openssl rand -base64 24
```

## 2. Start n8n

The Compose management port binds to `127.0.0.1` by default. Establish the
existing authenticated private proxy or SSH tunnel before changing a live
installation. `N8N_BIND_ADDRESS` controls the host binding and `N8N_PORT` its
port; n8n still listens on port 5678 inside the container. These settings do not
install or verify Tailscale.

```bash
docker compose up -d
docker compose ps
docker compose logs --tail 100 n8n
```

## 3. Prepare Supabase

Open Supabase SQL Editor and execute `supabase/schema.sql`.
Then create a credential named exactly **"Supabase API"** in n8n.

## 4. Import workflows

Import in this order:
```
workflows/s-agentos-telemetry-logger.json
workflows/s-agentos-evolution-planner.json
workflows/s-agentos-agent-registry-service.json
workflows/s-agentos-command-gateway.json
```
Review each workflow's credentials and authorization before activation.

## 5. Test gateway

```bash
export WEBHOOK_URL="https://YOUR_DOMAIN/webhook/s-agentos-command"
export AGENTOS_KEY="<same-as-S_AGENTOS_OPERATOR_KEY>"
bash tests/curl-tests.sh
```

The gateway currently plans routes without persisting or dispatching commands.
`health_check` confirms only `gateway_available`, with company readiness
`not_verified`. Draft responses have `accepted: false` and
`execution_status: not_dispatched`; live requests return HTTP 503. A caller's
`approval_status: approved` does not establish a durable authorization grant.
Bind the existing executor, authorization, intent, idempotency and audit path
before changing this behavior. A curl response is not a verified mission receipt.

Authentication output contains the normalized command, without copying raw
headers and cookies downstream. The original Webhook node can still retain its
input in n8n execution history: inspect execution-data retention and credential
handling before production activation. This patch does not provide a complete
execution-log redaction policy.

## 6. Connect the existing control room

This repository has no `dashboard/` directory. Use the existing company control
room and its canonical state projection; do not create a second dashboard here.

## Local validation

Run `node --test tests/command-gateway.test.cjs` and
`python3 scripts/static-qa.py`. These checks validate the route/auth contract and
workflow code syntax; they do not import the workflow into a running n8n server.
