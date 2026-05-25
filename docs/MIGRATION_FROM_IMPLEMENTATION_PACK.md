# Migration from the Previous S/ AgentOS Implementation Pack

## Use from Kimi/Workflow Man v0.1.3

- Supabase schema instead of the earlier SQLite/S-Drive schema.
- n8n production workflows in `workflows/`.
- Dashboard in `dashboard/index.html`.
- Curl tests in `tests/curl-tests.sh`.
- GPT Actions contract in `openapi/`.

## Do not import both workflow sets at the same time

Use the patched kernel workflows as the active system.
