# GPT Actions Setup

Use `openapi/s-agentos-kernel-v0.2.0.openapi.yaml` for S/ Operations GPT.

## Server URL

Replace `https://YOUR_N8N_PUBLIC_DOMAIN` with your public n8n domain.

## Authentication

Preferred: `X-AgentOS-Key: <S_AGENTOS_OPERATOR_KEY>`

Alternative: `Authorization: Bearer <S_AGENTOS_OPERATOR_KEY>`

## Suggested GPT behavior

- Use `health_check` before first operational command.
- Use `run_mode: draft` unless the user explicitly asks to execute.
- Escalate to the user before destructive actions.
