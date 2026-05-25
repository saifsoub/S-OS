# Workflow Man Upgrade Notes — S/ AgentOS Kernel v0.1.3

## What Workflow Man patched

1. **Command gateway auth fixed** — validates against `S_AGENTOS_OPERATOR_KEY`
2. **Command gateway body propagation fixed** — auth node preserves original body/headers
3. **Auth header support normalized** — all workflows accept `X-AgentOS-Key` or `Authorization: Bearer`
4. **Docker Compose runtime env fixed** — operator key and Supabase values passed into n8n
5. **Priority enum expanded** — low, normal, medium, high, urgent, critical
6. **Version alignment** — aligned to v0.1.3
7. **GPT Actions contract added**
8. **Machine-readable schemas added**
9. **Static QA regenerated**

## Recommended import order

1. Run `supabase/schema.sql` in Supabase.
2. Deploy Docker Compose.
3. Create n8n Supabase credentials named `Supabase API`.
4. Import and activate workflows in order.
5. Run `tests/curl-tests.sh`.
