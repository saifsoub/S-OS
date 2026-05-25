# S/ AgentOS Kernel — Architecture

## What This Is

S/ AgentOS is a **self-hosted agentic operating system kernel** for a solo operator.
It is not a chatbot. It is not a no-code builder. It is the programmable backbone that
lets you run, govern, evaluate, and evolve autonomous agents — while remaining in control.

---

## Design Principles

### 1. Provider-Agnostic at Every Layer

The kernel makes no assumption about which LLM, storage, or notification system you use.

| Layer | Examples Supported |
|-------|-----------------|
| LLM / Inference | OpenAI, Anthropic, Groq, Ollama, any OpenAI-compatible endpoint |
| Workflow Engine | n8n (default), Make, Zapier, custom HTTP |
| Operating Memory | Supabase/PostgreSQL (default), Neon, PlanetScale, any Postgres |
| Notification | Telegram, Slack, WhatsApp, email, webhook |
| Auth | Operator key (default), HMAC signatures, OAuth tokens |

Agent `context.model_preference` lets you specify provider, tier, fallback chain, and
budget per command. The kernel routes accordingly.

### 2. Observable by Default

Every command, event, agent run, and evolution plan is recorded. You can always ask:
- What did agent X do in the last 24 hours?
- Which commands failed and why?
- What's the token cost per agent this week?
- Which evolution plans are pending approval?

Tables: `os_commands`, `os_events`, `agent_runs`, `eval_results`, `audit_log`

### 3. Safe by Default

Safe modes (`draft`, `dry_run`, `read_only`) require no approval.
Consequential modes (`live`) require an explicit `approval_status: approved` record.

No irreversible action executes without operator intent.

### 4. Evolvable

Agents are not static. The evaluation → evolution loop is built into the kernel:

```
Agent runs task
  → Telemetry logged
  → Evaluation scheduled
  → Gap detected
  → Evolution plan proposed (draft)
  → Operator approves
  → Agent updated
  → Re-evaluated
```

### 5. Composable

Commands can chain:
- `parent_command_id` links child commands to their parent
- Agents can spawn commands targeting other agents
- Evolution plans can reference evaluation results

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          OPERATOR INTERFACES                             │
│                                                                          │
│  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐ │
│  │  Dashboard   │  │  curl / SDK │  │ GPT Actions  │  │  Telegram Bot │ │
│  │  (Browser)   │  │  (API)      │  │  (OpenAPI)   │  │  (Optional)   │ │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘ │
│         └────────────────┬┴─────────────────┘                │          │
│                          │ HTTPS POST + X-AgentOS-Key         │          │
└──────────────────────────┼────────────────────────────┼──────────┘
                           │                                    │
┌──────────────────────────┼────────────────────────────┼──────────┐
│                   KERNEL GATEWAY LAYER (n8n)                              │
│                          │                                    │          │
│  ┌───────────────────────▼────────────────────────▼───────┐  │
│  │              S/ AgentOS Command Gateway v0.2.0                     │  │
│  │                                                                    │  │
│  │  1. Auth check (X-AgentOS-Key / Bearer)                           │  │
│  │  2. Schema validation (action + objective required)               │  │
│  │  3. Normalize envelope (command_id, trace_id, idempotency_key)    │  │
│  │  4. Log to os_commands + os_events                                │  │
│  │  5. Route by action →                                             │  │
│  │     health_check | create_agent | execute_task | evaluate_agent   │  │
│  │     evolve_agent | registry_sync | telemetry_log                  │  │
│  │     list_agents | get_agent | update_agent_status                 │  │
│  │  6. Execute route handler                                         │  │
│  │  7. Log outcome event                                             │  │
│  │  8. Return response envelope                                      │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Command Envelope

The command envelope is the universal language of the kernel.
Every operation uses the same JSON structure:

```json
{
  "command_id": "cmd_1748908800000_abc123",
  "trace_id": "trace_1748908800000_def456",
  "idempotency_key": "idem_create_20260522_001",
  "action": "create_agent",
  "objective": "Create a Telegram revenue operations agent",
  "requested_by": "seif",
  "priority": "high",
  "run_mode": "draft",
  "approval_status": "not_required",
  "agent_id": null,
  "context": {
    "domain": "Telegram monetization",
    "output_format": "dashboard + alerts",
    "model_preference": {
      "provider": "auto",
      "tier": "fast",
      "fallback": ["anthropic", "groq", "openai"]
    },
    "output_channels": ["telegram", "supabase"]
  },
  "metadata": {
    "client": "gpt_action",
    "tags": ["revenue", "telegram"]
  }
}
```

## Model Layer (Provider-Agnostic)

```json
{
  "provider": "auto",
  "model_id": null,
  "tier": "fast",
  "temperature": 0.2,
  "max_tokens": 4000,
  "fallback": ["anthropic", "groq", "openai", "ollama"]
}
```

Provider routing in n8n:
- `auto` → use `model_registry` to find the highest-priority available model
- `anthropic` → Anthropic API via ANTHROPIC_API_KEY
- `groq` → Groq API via GROQ_API_KEY (fast, cost-efficient)
- `openai` → OpenAI API via OPENAI_API_KEY
- `ollama` → Local inference via OLLAMA_BASE_URL (zero cost, private)

---

## Future Roadmap

### v0.3 — Live enforcement
- Idempotency check wired into gateway routing
- Approval gate enforced in n8n workflow
- Multi-agent routing (command → capability match → best agent)
- HMAC request signing optional layer

### v0.4 — LLM-powered agent factory
- LLM calls integrated into `create_agent` handler
- Model provider routing per agent capability
- Token cost tracking per command written to `audit_log`

### v1.0 — Production hardening
- Full RLS on all Supabase tables
- CI with live integration tests (mock n8n)
- Auto-scaling worker pool
- Multi-operator support with RBAC
