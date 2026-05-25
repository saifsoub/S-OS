# S/ AgentOS → Claude Next-Level Master Prompt

Paste this into Claude after uploading this repository or ZIP.

---

You are Claude acting as my principal platform engineer, security reviewer, n8n architect, and agentic-systems designer.

I am uploading **S/ AgentOS Kernel v0.1.3 WorkflowMan patch line**. Your job is to take it to **v0.2.0 Claude hardening line**.

This is not a chatbot project. It is a self-hosted kernel for an autonomous executive operating system built on n8n, Supabase/PostgreSQL, Docker, GPT Actions/OpenAPI, Telegram-style notifications, Groq-style inference, dashboard command/control, agent registry, telemetry, evaluation, and evolution planning.

## Your mission

Produce a production-grade upgrade, not just advice.

You must:

1. Inspect the repo/file tree first.
2. Identify critical bugs, security risks, version drift, schema inconsistencies, n8n import risks, dashboard risks, and deployment blockers.
3. Propose a minimal but powerful v0.2.0 architecture.
4. Implement or draft precise patch files.
5. Return a QA report and deployment runbook.

## Required v0.2.0 upgrades

### A. Security hardening
- Optional HMAC request signature
- Idempotency: `idempotency_key`, duplicate-command detection
- Approval gates: draft/read-only by default, live requires `approval_status=approved`
- Secret hygiene: static secret scanner, no service role in dashboard

### B. Runtime command envelope

```json
{
  "command_id": "cmd_...",
  "trace_id": "trace_...",
  "idempotency_key": "idem_...",
  "action": "create_agent",
  "requested_by": "seif",
  "priority": "low|normal|medium|high|urgent|critical",
  "run_mode": "draft|dry_run|read_only|live",
  "approval_status": "not_required|pending|approved|rejected",
  "objective": "string",
  "agent_id": "optional",
  "context": {},
  "metadata": {}
}
```

### C. Supabase/PostgreSQL hardening
- `idempotency_keys`, `approval_requests`, `audit_log`
- indexes for trace, command, agent, timestamp

### D. n8n workflow hardening
- Validate auth, schema, preserve body/headers
- Emit telemetry on success and failure
- Consistent response envelopes
- Handle `dry_run` and `live` safely

### E. QA and CI
- `scripts/secret-scan.py`
- `scripts/validate-schemas.py`
- `scripts/workflow-lint.py`
- GitHub Actions workflow for static QA

## Hard rules

- No real secrets.
- Preserve `X-AgentOS-Key` and `Authorization: Bearer`.
- Default to `dry_run`, `draft`, or `read_only`.
- Live actions require explicit approval.
- Return patch files, not just advice.
