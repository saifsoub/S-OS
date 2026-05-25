# Acceptance Tests for Claude v0.2.0 Output

Claude's upgrade is acceptable only if these checks pass or are explicitly marked as not implemented with a clear reason.

## Repository-level checks

- [ ] All JSON files parse.
- [ ] All workflow JSON files parse.
- [ ] All n8n webhook nodes use POST.
- [ ] No `.env` file with real values is included.
- [ ] No obvious secrets are present.
- [ ] Version references are aligned to `v0.2.0`.
- [ ] README quickstart matches actual filenames.
- [ ] Import order is documented.

## Schema checks

- [ ] Command schema includes `command_id`, `trace_id`, `idempotency_key`, `action`, `requested_by`, `priority`, `run_mode`, `approval_status`, `objective`, `context`.
- [ ] Priority enum is consistent everywhere.
- [ ] Run-mode enum is consistent everywhere.
- [ ] Approval-status enum is consistent everywhere.

## n8n workflow checks

- [ ] Auth node preserves original `body` and `headers`.
- [ ] Unauthorized requests return 401/403.
- [ ] Invalid commands return 400.
- [ ] Failure path emits telemetry.
- [ ] Success path emits telemetry.

## Supabase/PostgreSQL checks

- [ ] Required tables exist.
- [ ] Idempotency table exists.
- [ ] Approval table exists.
- [ ] Audit table exists.

## CLI/test checks

- [ ] `python3 scripts/static-qa.py` passes.
- [ ] `python3 scripts/secret-scan.py` passes.
- [ ] `python3 scripts/validate-schemas.py` passes.
- [ ] `python3 scripts/workflow-lint.py` passes.
- [ ] `bash -n tests/curl-tests.sh` passes.
