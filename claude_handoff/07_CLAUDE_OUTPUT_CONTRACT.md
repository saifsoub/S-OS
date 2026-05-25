# Claude Output Contract

Claude should return a release candidate response with this structure.

## 1. Executive summary

- What was changed
- Why it matters
- What remains risky

## 2. Audit findings

| Severity | Area | Finding | Fix |
|---|---|---|---|

## 3. Files changed

| File | Change type | Purpose |
|---|---|---|

## 4. Deployment runbook

```bash
cp .env.example .env
docker compose up -d
python3 scripts/static-qa.py
bash tests/curl-tests.sh
```

## 5. Rollback plan

- Workflow rollback
- Database rollback
- Docker rollback
- Operator-key rotation
