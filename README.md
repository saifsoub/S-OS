# S-OS — S/ AgentOS Control Plane

[![Kernel](https://img.shields.io/badge/kernel-v0.2.0-blue)](MANIFEST.json)
[![Stack](https://img.shields.io/badge/stack-n8n%20%2B%20Supabase%20%2B%20Docker-0f766e)](docs/ECOSYSTEM.md)

**S-OS** is the governed control plane for a solo operator running multiple agents, businesses, and automations. It is not a chat UI — it is the **command gateway**, **agent registry**, **telemetry**, and **evolution loop** that everything else plugs into.

Part of the **S/ Operator Stack**:

| Repo | Role |
|------|------|
| **[S-OS](https://github.com/saifsoub/S-OS)** (this repo) | Commands, registry, approvals, memory |
| **[n8n](https://github.com/saifsoub/n8n)** | Workflow runtime, Docker ops, integration templates |
| **[AgentEmpire](https://github.com/saifsoub/AgentEmpire)** | Operator cockpit (dashboard, opportunities, briefings) |

See [docs/ECOSYSTEM.md](docs/ECOSYSTEM.md) for how the three fit together.

---

## What you get

- **Command gateway** — normalized JSON envelope (`action`, `objective`, `run_mode`, `approval_status`)
- **Safe defaults** — `draft`, `dry_run`, `read_only` until you explicitly approve `live`
- **Agent registry** — create, list, evaluate, evolve agents with audit trail
- **Supabase memory** — `os_commands`, `os_events`, idempotency, approval requests
- **n8n workflows** — importable POST webhooks (gateway, registry, telemetry, evolution)
- **Static QA** — schema validation, secret scan, workflow lint, GitHub Actions CI
- **OpenAPI** — GPT Actions / external clients (`openapi/s-agentos-kernel-v0.2.0.openapi.yaml`)

---

## Quick start (15 minutes)

### 1. Configure

```bash
cp .env.example .env
# Set: N8N_*, SUPABASE_*, S_AGENTOS_OPERATOR_KEY (openssl rand -base64 32)
```

### 2. Start runtime

Use [saifsoub/n8n](https://github.com/saifsoub/n8n) for the Docker stack, **or** this repo’s `docker-compose.yml` if you run kernel-only:

```bash
docker compose up -d
```

### 3. Apply database schema

In Supabase SQL Editor, run in order:

1. `supabase/schema.sql`
2. `supabase/migrations/001_v0.2.0_idempotency_approval.sql`

Create an n8n credential named **Supabase API**.

### 4. Import workflows (order matters)

```
workflows/s-agentos-telemetry-logger.json
workflows/s-agentos-evolution-planner.json
workflows/s-agentos-agent-registry-service.json
workflows/s-agentos-command-gateway.json
```

Activate all four. Set `S_AGENTOS_OPERATOR_KEY` in n8n environment.

### 5. Smoke test

```bash
export WEBHOOK_URL="https://YOUR_DOMAIN/webhook/s-agentos-command"
export AGENTOS_KEY="<your-operator-key>"
bash tests/curl-tests.sh
```

Full steps: [docs/FIRST_RUN_DEPLOYMENT.md](docs/FIRST_RUN_DEPLOYMENT.md) · Operator runbook: [RUNBOOK.md](RUNBOOK.md)

---

## Architecture

```
Operator (curl / GPT / AgentEmpire / Telegram)
        │  HTTPS + X-AgentOS-Key
        ▼
┌───────────────────────────────────┐
│  Command Gateway (n8n workflow)   │
│  validate → route → log → respond │
└───────────────┬───────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
 Registry   Telemetry   Evolution
                │
                ▼
         Supabase (Postgres)
```

Deep dive: [ARCHITECTURE.md](ARCHITECTURE.md) · Security: [SECURITY_MODEL.md](SECURITY_MODEL.md)

---

## Repo map

| Path | Purpose |
|------|---------|
| `workflows/` | n8n workflow exports (gateway, registry, telemetry, evolution) |
| `schemas/` | JSON Schema for commands, agents, telemetry |
| `supabase/` | Schema + migrations |
| `openapi/` | External API contract |
| `scripts/` | `static-qa.py`, `secret-scan.py`, `validate-schemas.py` |
| `tests/curl-tests.sh` | Gateway acceptance tests |
| `docs/` | Deployment, import order, ecosystem |

---

## QA (run before every push)

```bash
python3 scripts/static-qa.py
python3 scripts/validate-schemas.py
python3 scripts/secret-scan.py
bash -n tests/curl-tests.sh
```

CI: `.github/workflows/static-qa.yml`

---

## Version & changelog

Current line: **v0.2.0** — see [MANIFEST.json](MANIFEST.json) and [CHANGELOG-v0.2.0.md](CHANGELOG-v0.2.0.md).

Rollback: [ROLLBACK.md](ROLLBACK.md)

---

## For AI agents (Cursor / Claude)

Read [AGENTS.md](AGENTS.md). Rule: `~/.cursor/rules/s-agentos.mdc`.

**Human-only:** placing calls, sending emails, signing contracts. Kernel defaults to draft/dry-run for consequential actions.

---

## License

MIT — see [LICENSE](LICENSE).


---

## OpenHuman × Intent-Preserving Execution Loop

OpenHuman is now wired into S-OS as the governed multi-agent execution layer.

Canonical resources:
- [Intent-preserving execution architecture](docs/OPENHUMAN_INTENT_LOOP.md)
- [OpenHuman crew registry](registry/openhuman-crew.yaml)
- [Execution run schema](schemas/intent-preserving-loop.schema.json)
- [ChatGPT plugin binding](plugins/openhuman/PLUGIN_BINDING.md)

The invariant is simple: workers may specialize the work, but they may not rewrite the operator's original intent.
