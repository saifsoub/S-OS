# First-Run Deployment — S/ AgentOS Kernel v0.1.3

## 0. Security first

Rotate any token or API key that has ever appeared in a browser tab, screenshot, chat, terminal output, or shared file.

## 1. Prepare environment

```bash
cp .env.example .env
openssl rand -base64 32
openssl rand -base64 24
```

## 2. Start n8n

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
Activate all workflows.

## 5. Test gateway

```bash
export WEBHOOK_URL="https://YOUR_DOMAIN/webhook/s-agentos-command"
export AGENTOS_KEY="<same-as-S_AGENTOS_OPERATOR_KEY>"
bash tests/curl-tests.sh
```

## 6. Launch dashboard

```bash
cd dashboard && python3 -m http.server 8080
```
