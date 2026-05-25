# S/ AgentOS Kernel v0.2.0 — Runbook

## Fresh Deployment (v0.2.0)

### Prerequisites

- VPS: Ubuntu 22.04+, 2 vCPU, 4GB RAM, 20GB SSD
- Docker Engine 24.0+ and Docker Compose v2
- A domain name with DNS pointed to your VPS
- A Supabase account (free tier sufficient)

### Step 1 — Clone and configure

```bash
git clone https://github.com/saifsoub/S-OS.git && cd S-OS
cp .env.example .env
nano .env
```

Fill in `.env`:

```bash
N8N_HOST=agentos.yourdomain.com
N8N_PROTOCOL=https
N8N_PORT=5678
N8N_ENCRYPTION_KEY=$(openssl rand -base64 24)
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=$(openssl rand -base64 16)
N8N_WEBHOOK_URL=https://agentos.yourdomain.com/

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

S_AGENTOS_KERNEL_VERSION=0.2.0
S_AGENTOS_OPERATOR_KEY=$(openssl rand -base64 32)
S_AGENTOS_API_TOKEN=<same as S_AGENTOS_OPERATOR_KEY>
```

### Step 2 — Apply Supabase schema

1. Open Supabase → SQL Editor
2. Run `supabase/schema.sql`
3. Run `supabase/migrations/001_v0.2.0_idempotency_approval.sql`
4. Verify tables: `os_commands`, `os_events`, `agent_registry`, `idempotency_keys`, `approval_requests`, `audit_log`

### Step 3 — Start Docker services

```bash
docker compose up -d
docker compose logs -f n8n   # Wait for "Editor is now accessible"
```

### Step 4 — Configure n8n Supabase credential

1. Open `https://agentos.yourdomain.com:5678`
2. Settings → Credentials → Add Credential → Supabase API
3. Save as **"Supabase API"** (exact name required)

### Step 5 — Import workflows (in order)

| Order | File |
|-------|------|
| 1 | `s-agentos-command-gateway.json` |
| 2 | `s-agentos-agent-registry-service.json` |
| 3 | `s-agentos-telemetry-logger.json` |
| 4 | `s-agentos-evolution-planner.json` |

### Step 6 — Run curl tests

```bash
export WEBHOOK_URL="https://agentos.yourdomain.com/webhook/s-agentos-command"
export AGENTOS_KEY="$(grep S_AGENTOS_OPERATOR_KEY .env | cut -d= -f2)"
bash tests/curl-tests.sh
```

Expected: **24 passed, 0 failed**

### Step 7 — Open dashboard

```bash
cd dashboard && python3 -m http.server 8080
# Open http://localhost:8080
```
