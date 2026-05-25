# S/ Operator Stack — Ecosystem

Three public repos form one operating model for **Seif / S/** — running DoneAi revenue, Shopify, and agent automation without losing control.

```
                    ┌─────────────────────┐
                    │    AgentEmpire      │
                    │  (operator cockpit) │
                    │  dashboard · deals  │
                    │  briefings · agents │
                    └──────────┬──────────┘
                               │ objectives, tasks, approvals (UI)
                               ▼
                    ┌─────────────────────┐
                    │       S-OS          │
                    │   (control plane)   │
                    │  gateway · registry │
                    │  telemetry · evolve │
                    └──────────┬──────────┘
                               │ commands (X-AgentOS-Key)
                               ▼
                    ┌─────────────────────┐
                    │        n8n          │
                    │  (automation runtime)│
                    │  Docker · workflows │
                    │  Telegram · Monday  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
         Supabase          Telegram          Gmail / Monday
         (memory)          (approvals)       (integrations)
```

---

## Repo roles

### [S-OS](https://github.com/saifsoub/S-OS) — Control plane

**When:** You need governed agent execution — not ad-hoc API calls.

- Command envelope + routing
- Agent registry + evolution loop
- Idempotency + approval records
- OpenAPI for external clients

**Deploy:** Supabase schema + import kernel workflows into n8n.

### [n8n](https://github.com/saifsoub/n8n) — Automation runtime

**When:** Something must run on triggers, schedules, or queues.

- Docker Compose (Postgres + Redis + n8n)
- Telegram approval workflow
- Templates: Monday sync, Gmail approval, AI router
- CI validation for workflow JSON

**Deploy:** `docker compose -f docker-compose.local.yml up -d` then import workflows.

**Relationship to S-OS:** n8n is the **engine**; S-OS workflows are the **kernel** imported into that engine. Use the n8n repo for ops/runbooks; use S-OS for gateway contracts and schemas.

### [AgentEmpire](https://github.com/saifsoub/AgentEmpire) — Operator cockpit

**When:** You want a human-facing command center, not only webhooks.

- Dashboard, opportunities, offers, decisions
- Weekly briefings, lifestyle OS, content engine
- Agent definitions with tool routing (Composio, MCP, native)
- File-backed demo DB (upgrade path to Supabase / S-OS)

**Deploy:** `npm install && npm run dev` (port 7483).

**Relationship to S-OS:** AgentEmpire is the **face**; S-OS is the **spine**. Wire cockpit actions to `POST /webhook/s-agentos-command` when ready for live kernel execution.

---

## Recommended bootstrap order

1. **n8n** — Get Docker stack healthy locally.
2. **S-OS** — Schema + kernel workflow import + `curl-tests.sh` green.
3. **AgentEmpire** — Run cockpit; use for planning and internal work while kernel stays in `dry_run`.
4. **Integrate** — Point AgentEmpire agent runs at S-OS gateway with `run_mode: dry_run`, then `approved` + `live` for consequential tools.

---

## Safety model (all three)

| Mode | Who can trigger | Side effects |
|------|-----------------|--------------|
| `draft` / `dry_run` / `read_only` | Operator, agents | None / logged only |
| `live` | Operator-approved only | External systems |

Human-only forever: phone calls, **sent** emails, signed contracts.

---

## Business mapping

| Business | Primary repo | Typical flow |
|----------|--------------|--------------|
| DoneAi revenue | AgentEmpire + n8n | Monday templates → Telegram approval |
| S/ Shopify | AgentEmpire agents | Composio shopify-store tools |
| AgentOS / S/ kernel | S-OS + n8n | Command gateway + registry |

---

## Links

- S-OS: https://github.com/saifsoub/S-OS
- n8n stack: https://github.com/saifsoub/n8n
- AgentEmpire: https://github.com/saifsoub/AgentEmpire

Maintainer: [@saifsoub](https://github.com/saifsoub)
