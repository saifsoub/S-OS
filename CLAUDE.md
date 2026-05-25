# CLAUDE.md — S/ AgentOS Kernel Project Memory

## Project identity

This repository is **S/ AgentOS Kernel v0.1.3 WorkflowMan patch line**.

S/ AgentOS is a self-hosted agentic operating-system kernel for a solo executive/operator. It uses:

- n8n as the workflow orchestration layer
- Supabase/PostgreSQL as operating memory and registry storage
- Docker Compose for deployment
- GPT Actions/OpenAPI as the external command interface
- Telegram/Groq/Monday/M365-style integrations as optional execution and notification layers
- A lightweight browser dashboard for command/control and telemetry visibility

The target upgrade is **v0.2.0 Claude hardening line**.

## Mission for Claude

Act as a principal platform engineer, security reviewer, and n8n workflow architect.

Do **not** merely rewrite prose. Inspect the repository, run or simulate QA, then produce a production-grade patch set that hardens the kernel while preserving the current architecture.

## Non-negotiable rules

1. **No secrets**
   - Never ask the user to paste live tokens.
   - Never include real Telegram, Groq, Supabase, n8n, OpenAI, Anthropic, Ziina, Stripe, Monday, Microsoft, or S/Drive keys.
   - Use clear placeholders only.

2. **Preserve safe defaults**
   - `dry_run`, `draft`, or `read_only` must remain the default for consequential actions.
   - No irreversible production action should run without explicit approval gates.

3. **Do not weaken auth**
   - Keep support for both:
     - `X-AgentOS-Key: <operator-key>`
     - `Authorization: Bearer <operator-key>`
   - Add stronger options if useful: HMAC signatures, timestamp/replay protection, idempotency keys.
   - Do not remove existing auth unless replacing it with something stronger and backwards compatible.

4. **n8n compatibility matters**
   - Workflow JSON must remain importable.
   - Webhook nodes must use POST.
   - Auth/filter/function nodes must preserve the original body and headers.
   - Failures must emit telemetry.

5. **Supabase safety**
   - Service role keys must never appear in client-side dashboard code.
   - Browser dashboard should use anon/public-safe access patterns only, or no direct Supabase access.
   - Add RLS/policies/migrations only if the implementation is coherent and documented.

6. **Beginner-friendly operations**
   - Any commands must be copy-paste-ready.
   - Deployment steps must be ordered and explicit.
   - Avoid paid services unless optional.

## Current known state from WorkflowMan

- Static QA previously passed: 9 PASS / 0 FAIL.
- The package was not live-tested against a running n8n/Supabase deployment.
- Kimi's earlier package had auth/body propagation issues; WorkflowMan patched them.
- Remaining likely gaps:
  - Version string drift may still exist (`v0.1.3.3`, `v0.1`, and `v0.1.3` appear in different places).
  - No live import validation.
  - No robust replay/idempotency layer.
  - No full CI pipeline.
  - Dashboard security deserves review.
  - Supabase RLS/policies and indexes deserve review.
  - Error telemetry should be stress-tested.
  - OpenAPI examples and workflow schemas should be cross-validated.

## Suggested test commands

Run these from the repository root when possible:

```bash
python3 scripts/static-qa.py
bash -n tests/curl-tests.sh
python3 -m json.tool schemas/command.schema.json >/dev/null
python3 -m json.tool schemas/agent-registry-record.schema.json >/dev/null
python3 -m json.tool schemas/telemetry-event.schema.json >/dev/null
python3 -m json.tool schemas/evolution-plan.schema.json >/dev/null
```

Add stronger tests if missing:

```bash
python3 scripts/validate-schemas.py
python3 scripts/secret-scan.py
python3 scripts/workflow-lint.py
```

## Desired output

Return a complete v0.2.0 patch package or diff-style instructions containing:

1. Audit findings with severity.
2. Exact files changed.
3. Code/workflow/schema patches.
4. Updated docs.
5. Updated QA report.
6. Copy-paste deployment and rollback steps.
7. Remaining risks.
