# Copy/Paste Prompt for Claude Chat

Upload the ZIP, then paste this:

---

Take this repository to the next level.

You are my principal engineer for **S/ AgentOS Kernel**. Inspect the uploaded ZIP and produce a **v0.2.0 release candidate**.

Focus on:

1. Security: auth, HMAC/replay protection, idempotency, approval gates, no secrets.
2. n8n: importable JSON, POST webhooks, body/header propagation, safe error paths, telemetry.
3. Supabase: command log, idempotency keys, approval requests, audit log, indexes, RLS notes.
4. GPT Actions/OpenAPI: aligned schema, examples, auth, consequential markers.
5. Dashboard: no service-role key, safer operator-key handling, dry-run/live indicators.
6. QA: static QA, schema validation, workflow linting, secret scan, curl tests, CI.
7. Docs: exact deployment, rollback, runbook, security model, changelog.

Hard rules:

- No real secrets.
- Preserve `X-AgentOS-Key` and `Authorization: Bearer`.
- Default to `dry_run`, `draft`, or `read_only`.
- Live actions require explicit approval.
- Return patch files, not just advice.
