# v0.2.0 Upgrade Specification — S/ AgentOS Kernel

## Minimum viable v0.2.0

### 1. Version alignment
All references should consistently say `S/ AgentOS Kernel v0.2.0`.

### 2. Canonical command envelope

```json
{
  "command_id": "cmd_20260522_...",
  "trace_id": "trace_...",
  "idempotency_key": "idem_...",
  "action": "health_check",
  "objective": "Check kernel status",
  "requested_by": "seif",
  "priority": "low",
  "run_mode": "dry_run",
  "approval_status": "not_required",
  "agent_id": null,
  "context": {},
  "metadata": { "client": "gpt_action" }
}
```

### 3. Response envelope

```json
{
  "ok": true,
  "kernel_version": "v0.2.0",
  "trace_id": "trace_...",
  "command_id": "cmd_...",
  "action": "health_check",
  "run_mode": "dry_run",
  "approval_status": "not_required",
  "result": {}
}
```

### 4. Approval statuses
`not_required | pending | approved | rejected | expired`

### 5. Run modes
`draft | dry_run | read_only | live`

Rules:
- `live` write actions require `approval_status=approved`
- health/read-only/list actions do not need approval

### 6. CI
Add `.github/workflows/static-qa.yml`:
```bash
python3 scripts/static-qa.py
python3 scripts/validate-schemas.py
python3 scripts/secret-scan.py
python3 scripts/workflow-lint.py
bash -n tests/curl-tests.sh
```
