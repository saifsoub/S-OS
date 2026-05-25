# CHANGELOG — S/ AgentOS Kernel v0.2.0

## Release: v0.2.0 Claude hardening line
**Date:** 2026-05-22

---

## Bug Fixes

### BUG-01 — `objective` field not validated (HIGH)
**Fix:** Added `objective` as required, non-empty string in the payload validator. Also added `run_mode` enum validation.

### BUG-02 — `evolve_agent` route name incorrect (HIGH)
**Fix:** Changed `route: 'evolve_agent'` → `route: 'evolution_engine'`.

### BUG-03 — Telemetry Supabase node broken event_type reference (HIGH)
**Fix:** Updated `Code — Build Telemetry Log Response` to expose `event_type` directly, fixed Supabase node field reference.

### BUG-04 — Version strings stale (MEDIUM)
**Fix:** Updated all instances to `"0.2.0"` / `"v0.2.0"`.

---

## New Features

- Canonical v0.2.0 command envelope: `command_id`, `trace_id`, `idempotency_key`, `approval_status`
- `run_mode` now validates `draft | dry_run | read_only | live`
- Supabase migration: `idempotency_keys`, `approval_requests`, `audit_log` tables
- `scripts/secret-scan.py`, `validate-schemas.py`, `workflow-lint.py`
- GitHub Actions CI
- ARCHITECTURE.md — provider-agnostic system design
- SECURITY_MODEL.md, RUNBOOK.md, ROLLBACK.md
- `openapi/s-agentos-kernel-v0.2.0.openapi.yaml`
- Curl test suite expanded from 15 → 24 tests

---

## Remaining Risks

| Risk | Severity |
|------|----------|
| No live deployment test | MEDIUM |
| Idempotency table exists but not yet enforced in gateway | MEDIUM |
| Approval gate table exists but gateway not yet gated | MEDIUM |
| Supabase RLS disabled by default | MEDIUM |

## Upgrade Path

1. Run `supabase/migrations/001_v0.2.0_idempotency_approval.sql`
2. Import updated `workflows/s-agentos-command-gateway.json` into n8n
3. Restart n8n: `docker compose restart n8n`
4. Run `bash tests/curl-tests.sh`
