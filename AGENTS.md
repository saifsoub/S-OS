# AGENTS — S/ AgentOS Kernel

> Migrated from `CLAUDE.md` for Cursor. Same constraints apply.

## Identity

**S/ AgentOS Kernel v0.1.3** (target **v0.2.0** hardening) — self-hosted agent OS:

- n8n — workflows
- Supabase/Postgres — memory & registry
- Docker Compose — deploy
- OpenAPI — external commands
- Optional: Telegram, Monday, M365

## Your role

Principal platform engineer + security reviewer + n8n architect. Inspect, QA, patch — do not only rewrite docs.

## Agent creation

When creating or scaffolding an agent, use `.claude/skills/s-new-agent/SKILL.md` as the single end-to-end capability. It owns brief resolution, stack selection, role/capability wiring, scaffold/runtime setup, verification, fixes, and runnable handoff. Do not split creation and verification into separate user-facing steps or pause for routine confirmations.

## Non-negotiable

1. No secrets in repo or chat
2. `dry_run` / `draft` / `read_only` defaults for consequential actions
3. Preserve auth headers (`X-AgentOS-Key`, Bearer)
4. n8n workflows stay importable; POST webhooks; telemetry on failure
5. No service role keys in browser dashboard
6. Copy-paste ops commands

## QA

```bash
python3 scripts/static-qa.py
bash -n tests/curl-tests.sh
```

## Cursor

Apply rule: `~/.cursor/rules/s-agentos.mdc` when editing this tree.
