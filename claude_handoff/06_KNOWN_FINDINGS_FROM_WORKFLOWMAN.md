# Known Findings from WorkflowMan Before Claude Review

## High priority

1. **Live validation gap** — no proof workflows import and run correctly in live n8n + Supabase
2. **Version drift likely remains** — README references `v0.1.3.3`
3. **No robust idempotency layer** — duplicate webhook calls could trigger duplicate actions
4. **No replay protection** — operator-key auth does not stop captured request replay
5. **Approval gates need formalization**
6. **Dashboard security should be reviewed**
7. **Supabase security needs review** — validate RLS/policy choices

## Medium priority

8. **OpenAPI/schema/workflow alignment** — command payload model should be canonical
9. **Error telemetry** — every failure path should emit a telemetry event with trace ID
10. **CI missing or incomplete** — add GitHub Actions static QA
11. **Secret scanner missing**
12. **Rollback process unclear**
