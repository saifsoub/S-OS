# S/ AgentOS Kernel v0.2.0 — Rollback Guide

## When to roll back

- Health check returns `ok: false` after upgrade
- n8n container crashes after workflow import
- Supabase migration breaks existing queries
- Curl tests fail after deployment

## Roll back n8n workflow (v0.2.0 → v0.1.3)

```bash
# 1. In n8n UI: open the Command Gateway workflow
# 2. Click the three-dot menu → Import from File
# 3. Select the v0.1.3 command gateway JSON
# 4. Save and re-activate
curl -X POST "$WEBHOOK_URL" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"post-rollback check"}' | jq .kernel_version
```

## Roll back Supabase migration

```sql
-- Drop new tables (safe — they are new in v0.2.0)
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS idempotency_keys;

-- Remove new columns from os_commands
ALTER TABLE os_commands
  DROP COLUMN IF EXISTS trace_id,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS approval_status;

-- Restore original default for kernel_version
ALTER TABLE os_commands ALTER COLUMN kernel_version SET DEFAULT '0.1.3';
ALTER TABLE os_events ALTER COLUMN kernel_version SET DEFAULT '0.1.3';
```

## Verify rollback

```bash
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"rollback verification"}' | jq .
```
