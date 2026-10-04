# S-OS — plain-language README

## What this is
The behind-the-scenes hub for Seif's AI helpers and automations. It receives commands, keeps a list of the helpers, logs what happens and holds back anything risky until someone approves it. It is built from n8n, a visual automation tool, and Supabase, a hosted database.

## Who it's for
One person running several businesses, AI helpers and automations, who wants every command to go through one checked entry point.

## What it does today
- **Command entry point.** Accepts a command in a fixed format: what to do, why, which mode and whether it's approved. It checks the command, sends it to the right place, logs it and replies. It only accepts requests that carry the secret access key.
- **Safe by default.** Commands start as a draft, a practice run or read-only. Nothing real happens until it is explicitly approved to go live.
- **Helper list.** Add, list, review and improve helpers, with a history of every change.
- **Memory.** Commands, events and approval requests are saved in Supabase. Repeated identical commands are not run twice.
- **Four ready-made n8n workflows** you can import:
  - the command entry point
  - the helper list
  - logging
  - improvement planning
- **Quality checks** that run before each push and on GitHub. They check the data formats, look for leaked secrets and check the workflow files.
- **An API description** (`openapi/`) so other tools, such as ChatGPT custom actions, can send commands.
- **A separate design** (`docs/OPENHUMAN_INTENT_LOOP.md`) for splitting work between several helpers without any of them changing what the owner originally asked for. Whether it is live is not yet confirmed.

People only, never the system: placing calls, sending emails, signing contracts.

## How to run it
1. Copy the settings file and fill it in:
   ```bash
   cp .env.example .env
   # Fill in the N8N_* and SUPABASE_* values.
   # Make an access key with: openssl rand -base64 32
   ```
2. Start it. Use the `saifsoub/n8n` repo's setup, or run just this hub:
   ```bash
   docker compose up -d
   ```
3. In the Supabase SQL editor, run `supabase/schema.sql`, then `supabase/migrations/001_v0.2.0_idempotency_approval.sql`. In n8n, create a connection named "Supabase API".
4. Import these into n8n in this order, then switch them all on:
   1. `workflows/s-agentos-telemetry-logger.json`
   2. `workflows/s-agentos-evolution-planner.json`
   3. `workflows/s-agentos-agent-registry-service.json`
   4. `workflows/s-agentos-command-gateway.json`
5. Do a quick test:
   ```bash
   export WEBHOOK_URL="https://YOUR_DOMAIN/webhook/s-agentos-command"
   export AGENTOS_KEY="<your access key>"
   bash tests/curl-tests.sh
   ```

Run the checks before pushing changes:
```bash
python3 scripts/static-qa.py
python3 scripts/validate-schemas.py
python3 scripts/secret-scan.py
```
Full steps: `docs/FIRST_RUN_DEPLOYMENT.md` and `RUNBOOK.md`.

## Current status and known gaps
- Version 0.2.0 (see `MANIFEST.json`). The latest automatic checks on the main branch passed.
- Whether a live copy is running, and where: not yet confirmed.
- It is designed to work with the AgentEmpire dashboard and the `saifsoub/n8n` setup.

## Where things live
| Folder | What's in it |
|---|---|
| `workflows/` | n8n workflows to import |
| `schemas/` | Data format definitions |
| `supabase/` | Database setup and updates |
| `openapi/` | API description for outside tools |
| `scripts/` | Quality-check scripts |
| `tests/` | Quick test script |
| `docs/` | Setup guides and background |
| `registry/`, `plugins/` | Helper-team list and ChatGPT add-on notes |

How to undo a release: `ROLLBACK.md`. License: MIT.
