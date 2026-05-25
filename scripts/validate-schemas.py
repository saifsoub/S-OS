#!/usr/bin/env python3
"""
S/ AgentOS — JSON Schema Validator
Validates all JSON schema files and cross-checks command.schema.json
against the canonical command envelope fields.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMAS_DIR = ROOT / "schemas"

REQUIRED_COMMAND_FIELDS = [
    "command_id", "trace_id", "idempotency_key", "action", "objective",
    "requested_by", "priority", "run_mode", "approval_status", "context", "metadata",
]

REQUIRED_SCHEMA_FILES = [
    "command.schema.json",
    "agent-registry-record.schema.json",
    "evolution-plan.schema.json",
    "telemetry-event.schema.json",
]

VALID_PRIORITY_VALUES = ["low", "normal", "medium", "high", "urgent", "critical"]
VALID_RUN_MODES = ["draft", "dry_run", "read_only", "live"]
VALID_APPROVAL_STATUSES = ["not_required", "pending", "approved", "rejected", "expired"]

results = []


def add(name, ok, detail=""):
    results.append((name, ok, detail))


for fname in REQUIRED_SCHEMA_FILES:
    path = SCHEMAS_DIR / fname
    try:
        data = json.loads(path.read_text())
        add(f"schema_parseable:{fname}", True, "OK")
    except FileNotFoundError:
        add(f"schema_parseable:{fname}", False, "File not found")
    except json.JSONDecodeError as e:
        add(f"schema_parseable:{fname}", False, f"JSON error: {e}")

try:
    cmd_schema = json.loads((SCHEMAS_DIR / "command.schema.json").read_text())
    props = cmd_schema.get("properties", {})
    missing = [f for f in REQUIRED_COMMAND_FIELDS if f not in props]
    add(
        "command_schema_v0.2.0_fields",
        not missing,
        f"missing: {missing}" if missing else f"all {len(REQUIRED_COMMAND_FIELDS)} required fields present",
    )
except Exception as e:
    add("command_schema_v0.2.0_fields", False, str(e))

try:
    cmd_schema = json.loads((SCHEMAS_DIR / "command.schema.json").read_text())
    props = cmd_schema.get("properties", {})

    priority_enum = props.get("priority", {}).get("enum", [])
    add("command_schema_priority_enum", set(VALID_PRIORITY_VALUES).issubset(set(priority_enum)), f"enum={priority_enum}")

    run_mode_enum = props.get("run_mode", {}).get("enum", [])
    add("command_schema_run_mode_enum", set(VALID_RUN_MODES).issubset(set(run_mode_enum)), f"enum={run_mode_enum}")

    approval_enum = props.get("approval_status", {}).get("enum", [])
    add("command_schema_approval_status_enum", set(VALID_APPROVAL_STATUSES).issubset(set(approval_enum)), f"enum={approval_enum}")
except Exception as e:
    add("command_schema_enum_checks", False, str(e))

try:
    suspicious = []
    for path in SCHEMAS_DIR.glob("*.json"):
        data = json.loads(path.read_text())
        id_val = data.get("$id", "")
        if "localhost" in id_val or "example.com" in id_val:
            suspicious.append(f"{path.name}: {id_val}")
    add("schema_ids_no_localhost", not suspicious, f"suspicious: {suspicious}" if suspicious else "OK")
except Exception as e:
    add("schema_ids_no_localhost", False, str(e))

passed = sum(1 for _, ok, _ in results if ok)
failed = len(results) - passed
for name, ok, detail in results:
    print(f"{'PASS' if ok else 'FAIL'}: {name} — {detail}")
print(f"\nRESULT: {passed} PASS / {failed} FAIL")
sys.exit(0 if failed == 0 else 1)
