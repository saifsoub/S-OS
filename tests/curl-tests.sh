#!/bin/bash
# =============================================================
# S/ AgentOS Kernel v0.2.0 — Curl Test Suite
# =============================================================
#
# USAGE:
#   export WEBHOOK_URL="https://your-domain.com/webhook/s-agentos-command"
#   export AGENTOS_KEY="your-operator-key"
#   export REGISTRY_URL="https://your-domain.com/webhook/s-agentos-registry"
#   export TELEMETRY_URL="https://your-domain.com/webhook/s-agentos-telemetry"
#   export EVOLUTION_URL="https://your-domain.com/webhook/s-agentos-evolution"
#   bash curl-tests.sh
#
# VERBOSE output:
#   VERBOSE=1 bash curl-tests.sh
# =============================================================

set -uo pipefail

WEBHOOK_URL="${WEBHOOK_URL:-https://your-domain.com/webhook/s-agentos-command}"
AGENTOS_KEY="${AGENTOS_KEY:-change-me}"
REGISTRY_URL="${REGISTRY_URL:-https://your-domain.com/webhook/s-agentos-registry}"
TELEMETRY_URL="${TELEMETRY_URL:-https://your-domain.com/webhook/s-agentos-telemetry}"
EVOLUTION_URL="${EVOLUTION_URL:-https://your-domain.com/webhook/s-agentos-evolution}"
VERBOSE="${VERBOSE:-0}"

PASS=0
FAIL=0
TEST_NUM=0

test_start() { TEST_NUM=$((TEST_NUM + 1)); echo ""; echo "▶ TEST $TEST_NUM: $1"; }
test_pass()  { echo "  ✅ PASS: $1"; PASS=$((PASS + 1)); }
test_fail()  { echo "  ❌ FAIL: $1"; [[ -n "${2:-}" ]] && echo "  Response: $2"; FAIL=$((FAIL + 1)); }
section()    { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }
has_jq()     { command -v jq &>/dev/null; }

json_field() {
  local json="$1" field="$2"
  echo "$json" | tr -d '\n' | grep -oP "\"$field\"\s*:\s*\"?[^\",\\}]*\"?" | sed 's/.*://' | sed 's/^ *"//;s/" *$//' | head -1
}
json_has_field_value() {
  local json="$1" field="$2" expected="$3"
  if has_jq; then
    [[  "$(echo "$json" | jq -r ".$field // empty" 2>/dev/null)" == "$expected" ]]
  else
    [[ "$(json_field "$json" "$field")" == "$expected" ]]
  fi
}
json_has_field() {
  local json="$1" field="$2"
  has_jq && echo "$json" | jq -e ".$field" &>/dev/null || echo "$json" | grep -q "\"$field\""
}
json_contains() { echo "$1" | grep -iq "$2"; }
is_valid_json() {
  has_jq && echo "$1" | jq -e . &>/dev/null || [[ "$1" == \{*\} ]]
}

echo "=========================================="
echo "  S/ AgentOS Kernel v0.2.0 — Curl Tests"
echo "=========================================="
echo ""
echo "  WEBHOOK_URL : $WEBHOOK_URL"
echo "  AGENTOS_KEY : ${AGENTOS_KEY:0:4}****"
echo ""
has_jq || echo "⚠  jq not found — using basic grep assertions"
sleep 1

section "CORE ACTIONS — COMMAND GATEWAY"

test_start "health_check — X-AgentOS-Key auth"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"Check kernel status"}' 2>&1)
if json_has_field_value "$RESPONSE" "ok" "true" && json_has_field_value "$RESPONSE" "system" "S/ AgentOS"; then
  test_pass "ok:true, system:S/ AgentOS"
else
  test_fail "missing expected fields" "$RESPONSE"
fi

test_start "health_check — Bearer auth"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"Bearer auth test"}' 2>&1)
if json_has_field_value "$RESPONSE" "ok" "true"; then
  test_pass "Bearer auth accepted, ok:true"
else
  test_fail "Bearer auth failed" "$RESPONSE"
fi

test_start "health_check — v0.2.0 kernel_version in response"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"Version check"}' 2>&1)
if json_contains "$RESPONSE" "v0.2.0" || json_contains "$RESPONSE" "0.2.0"; then
  test_pass "kernel_version contains 0.2.0"
else
  test_fail "kernel_version does not contain 0.2.0" "$RESPONSE"
fi

test_start "evolve_agent — route must be evolution_engine"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"evolve_agent","objective":"Propose improvements","agent_id":"ag_ops","context":{"detected_gap":"latency","risk_level":"low"}}' 2>&1)
if json_has_field_value "$RESPONSE" "ok" "true" && json_has_field_value "$RESPONSE" "route" "evolution_engine"; then
  test_pass "ok:true, route:evolution_engine"
else
  test_fail "evolve_agent wrong route" "$RESPONSE"
fi

section "v0.2.0 ENVELOPE"

test_start "trace_id present in response"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"Trace ID check"}' 2>&1)
if json_has_field "$RESPONSE" "trace_id"; then
  test_pass "trace_id field present"
else
  test_fail "trace_id field missing" "$RESPONSE"
fi

test_start "command_id present in response"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check","objective":"Command ID test"}' 2>&1)
if json_has_field "$RESPONSE" "command_id"; then
  test_pass "command_id present"
else
  test_fail "command_id missing" "$RESPONSE"
fi

section "ERROR HANDLING"

test_start "No auth key returns Unauthorized"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"action":"health_check","objective":"No auth test"}' 2>&1)
if json_has_field_value "$RESPONSE" "ok" "false" && json_contains "$RESPONSE" "nauthorized"; then
  test_pass "ok:false with Unauthorized error"
else
  test_fail "Expected Unauthorized response" "$RESPONSE"
fi

test_start "Missing objective returns Validation Failed"
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"action":"health_check"}' 2>&1)
if json_has_field_value "$RESPONSE" "ok" "false" && (json_contains "$RESPONSE" "alidation" || json_contains "$RESPONSE" "objective"); then
  test_pass "ok:false with validation error about objective"
else
  test_fail "Expected validation error for missing objective" "$RESPONSE"
fi

section "AUXILIARY WEBHOOK SERVICES"

test_start "Telemetry service — log event"
RESPONSE=$(curl -s -X POST "$TELEMETRY_URL" \
  -H "Content-Type: application/json" \
  -H "X-AgentOS-Key: $AGENTOS_KEY" \
  -d '{"event_type":"test_suite_run","source":"curl-tests.sh","severity":"info","payload":{"test_suite":"v0.2.0"}}' 2>&1)
if is_valid_json "$RESPONSE" && (json_has_field_value "$RESPONSE" "ok" "true" || json_has_field_value "$RESPONSE" "status" "accepted"); then
  test_pass "Telemetry service accepted event"
else
  test_fail "Telemetry service unexpected response" "$RESPONSE"
fi

echo ""
echo "========================================"
echo "  TEST SUMMARY"
echo "========================================"
echo "  Total  : $((PASS + FAIL))"
echo "  Passed : $PASS"
echo "  Failed : $FAIL"
echo "========================================"

if [[ $FAIL -eq 0 ]]; then
  echo "  All tests passed."
  exit 0
else
  echo "  $FAIL test(s) failed."
  exit $FAIL
fi
