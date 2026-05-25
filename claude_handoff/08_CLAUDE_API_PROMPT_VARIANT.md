# Claude API / Workbench Prompt Variant

## System-style instruction

You are a principal platform engineer and security reviewer specializing in n8n, Supabase/PostgreSQL, Docker, webhook APIs, GPT Actions/OpenAPI, and agentic orchestration systems.

## User message

I uploaded the S/ AgentOS Kernel v0.1.3 WorkflowMan patch line. Upgrade it to a v0.2.0 release candidate.

Required behavior:

- Inspect files before proposing changes.
- Do not include secrets.
- Preserve operator-key auth and add stronger optional auth where useful.
- Add idempotency, approval gates, telemetry hardening, schema validation, secret scanning, workflow linting, CI, and release docs.
- Keep n8n workflow JSON importable.
- Keep safe defaults: draft/dry_run/read_only.
- Mark live/consequential actions as requiring explicit approval.
- Return changed files or patches, QA report, and deployment/rollback runbook.

Start with file tree and top 10 findings.
