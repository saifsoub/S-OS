# Governed MVP mission execution

The `mission-executor` is the server-side execution boundary for one MVP action,
`execute_task`. It reuses the existing control plane without installing another
gateway. Its loopback bind is intended to be reached through the private
Tailscale bridge on `s-srv-google-001`.

## Contract and safety boundary

1. The caller sends the canonical command to `POST /v1/missions`, authenticated
   with `X-AgentOS-Key` or Bearer auth, plus an `S-Passport` header.
2. The executor requires `run_mode=live`, `approval_status=approved`, and an
   idempotency key. S/Passport's signature, owner, worker subject, exact purpose,
   `execute:mission` scope, expiry and local revocation list are checked before
   dispatch.
3. OpenMinis receives the mission over its configured private URL and selects a
   worker in that worker's own environment. OpenAI and Groq remain router
   configuration, not a hard-coded provider split.
4. Only a worker response containing a receipt ID and terminal `completed` or
   `failed` status is accepted. A heartbeat is never completion evidence.
5. The executor atomically stores the receipt in the `mission_receipts` volume
   and appends a minimal audit event. Repeated idempotency keys return that
   receipt without redispatch. The read-only Control Room can project
   `GET /v1/receipts/{receipt_id}` through its server-side backend; never expose
   the operator key or service-role keys to browser code.

The revocation file is `/data/revoked-passports.json`, a JSON array of Passport
`jti` values. Update it atomically. Router retries apply only to transport/5xx/429
failures and are capped at three retries (`MISSION_MAX_RETRIES` is clamped to
`0..3`). Consequential actions beyond this single mission remain out of scope.

## Existing Google Cloud host deployment

Do not replace `.env` or named volumes. From an authenticated shell on the
existing host:

```bash
cd /opt/s-os
git fetch origin main && git switch main && git pull --ff-only origin main
cp .env .env.pre-sag-26
docker compose config --quiet
docker compose up -d --build mission-executor
docker compose ps n8n mission-executor
curl --fail --silent http://127.0.0.1:5678/healthz >/dev/null
curl --fail --silent http://127.0.0.1:8790/health
tailscale status
```

Submit a bounded approved fixture using shell variables (do not paste keys into
history or issue comments), retain its `receipt_id`, then verify it survives an
independent restart:

```bash
read -rsp 'Operator key: ' AGENTOS_KEY; echo
read -rsp 'Signed S/Passport: ' S_PASSPORT; echo
RECEIPT_ID="$(curl --fail --silent http://127.0.0.1:8790/v1/missions \
  -H "X-AgentOS-Key: $AGENTOS_KEY" -H "S-Passport: $S_PASSPORT" \
  -H 'Content-Type: application/json' --data @mission.json | tee mission-receipt.json \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["receipt_id"])')"
docker compose restart mission-executor
curl --fail --silent "http://127.0.0.1:8790/v1/receipts/$RECEIPT_ID" \
  -H "X-AgentOS-Key: $AGENTOS_KEY"
unset AGENTOS_KEY S_PASSPORT
```

Record sanitized outputs, the receipt ID, deployment commit/PR, n8n readiness,
Tailscale peer state, and the post-restart receipt in SAG-26. Do not claim host
verification until these commands have actually run. Telegram notifications
remain owned by SAG-25 and are not implemented here. Spending or provider quota
changes require separate owner approval.
