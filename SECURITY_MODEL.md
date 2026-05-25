# S/ AgentOS Kernel v0.2.0 — Security Model

## Threat Model Summary

S/ AgentOS is a single-operator, self-hosted kernel. The primary threat surface is:

1. **Unauthorized webhook access** — someone calling the command gateway without a valid operator key
2. **Credential leakage** — secrets appearing in logs, responses, or dashboard code
3. **Replay attacks** — resubmitting captured requests to trigger duplicate live actions
4. **Consequential action abuse** — triggering `live` write actions without proper approval
5. **Supabase over-exposure** — service-role key appearing in client-side code

---

## Authentication

Every webhook request must include the operator key:

```http
X-AgentOS-Key: <S_AGENTOS_OPERATOR_KEY>
Authorization: Bearer <S_AGENTOS_OPERATOR_KEY>
```

Key requirements: Minimum 32 chars, randomly generated: `openssl rand -base64 32`

---

## Approval Gates

| Mode | Description | Live Writes? |
|------|-------------|-------------|
| `draft` | Design/plan only | No |
| `dry_run` | Simulate, no side effects | No |
| `read_only` | Read Supabase, no mutations | No |
| `live` | Full execution | Yes — requires `approval_status=approved` |

---

## Security Checklist — Pre-Production

- [ ] `S_AGENTOS_OPERATOR_KEY` is 32+ chars, randomly generated
- [ ] `.env` is in `.gitignore` and never committed
- [ ] HTTPS enabled with valid certificate
- [ ] Port 5678 bound to `127.0.0.1` only
- [ ] n8n basic auth enabled with strong password
- [ ] Supabase service-role key stored only in n8n credentials
- [ ] `python3 scripts/secret-scan.py` passes
- [ ] Firewall: only 22/80/443 open
- [ ] RLS enabled on Supabase tables after initial setup

---

## Incident Response

If `S_AGENTOS_OPERATOR_KEY` is compromised:
1. Generate new key: `openssl rand -base64 32`
2. Update `.env` on VPS
3. Restart n8n: `docker compose restart n8n`
4. Update GPT Actions / dashboard with new key
5. Audit `os_commands` and `audit_log` for unauthorized requests
