#!/usr/bin/env python3
import json
import pathlib
import re
import subprocess
import sys
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / "workflows"
SCHEMA = ROOT / "supabase" / "schema.sql"
DASHBOARD = ROOT / "dashboard" / "index.html"
CURL_TESTS = ROOT / "tests" / "curl-tests.sh"
DOCKER = ROOT / "docker-compose.yml"

results = []

def add(name, ok, detail=""):
    results.append((name, ok, detail))

def parse_tables(sql_text):
    sql_text = re.sub(r"--.*", "", sql_text)
    tables = {}
    for m in re.finditer(r"CREATE\s+TABLE\s+([A-Za-z_][\w]*)\s*\((.*?)\);", sql_text, flags=re.S | re.I):
        table = m.group(1)
        body = m.group(2)
        parts, current, depth = [], "", 0
        for ch in body:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == "," and depth == 0:
                if current.strip():
                    parts.append(current.strip())
                current = ""
            else:
                current += ch
        if current.strip():
            parts.append(current.strip())
        cols = []
        for part in parts:
            first = part.split()[0].strip('"')
            if first.upper() not in {"PRIMARY", "FOREIGN", "UNIQUE", "CHECK", "CONSTRAINT"}:
                cols.append(first)
        tables[table] = set(cols)
    return tables

# 1. JSON parseability
workflow_data = {}
try:
    for path in sorted(WORKFLOWS.glob("*.json")):
        workflow_data[path.name] = json.loads(path.read_text())
    add("workflow_json_parseability", True, f"{len(workflow_data)} workflow JSON files parsed")
except Exception as e:
    add("workflow_json_parseability", False, str(e))

# 2. Webhook nodes use httpMethod
try:
    bad = []
    for fname, data in workflow_data.items():
        for node in data.get("nodes", []):
            if node.get("type") == "n8n-nodes-base.webhook":
                params = node.get("parameters", {})
                if params.get("httpMethod") != "POST":
                    bad.append(f"{fname}:{node.get('name')}")
    add("webhook_http_method", not bad, "bad=" + ",".join(bad) if bad else "all webhook nodes use httpMethod=POST")
except Exception as e:
    add("webhook_http_method", False, str(e))

# 3. Supabase field/table references align with schema
try:
    tables = parse_tables(SCHEMA.read_text())
    missing = []
    for fname, data in workflow_data.items():
        for node in data.get("nodes", []):
            if node.get("type") == "n8n-nodes-base.supabase":
                params = node.get("parameters", {})
                table = params.get("tableId")
                if table not in tables:
                    missing.append(f"{fname}:{node.get('name')}:table:{table}")
                    continue
                for fv in params.get("fieldsUi", {}).get("fieldValues", []):
                    col = fv.get("fieldId")
                    if col and col not in tables[table]:
                        missing.append(f"{fname}:{node.get('name')}:field:{table}.{col}")
                for cond in params.get("filters", {}).get("conditions", []):
                    col = cond.get("column")
                    if col and col not in tables[table]:
                        missing.append(f"{fname}:{node.get('name')}:filter:{table}.{col}")
    add("supabase_schema_alignment", not missing, "missing=" + "; ".join(missing[:10]) if missing else "all referenced Supabase tables/columns exist")
except Exception as e:
    add("supabase_schema_alignment", False, str(e))

# 4. Command gateway preserves body after auth and uses canonical operator key
try:
    gateway = workflow_data["s-agentos-command-gateway.json"]
    auth_node = next(n for n in gateway["nodes"] if n.get("name") == "Code — Extract & Validate Auth")
    code = auth_node.get("parameters", {}).get("jsCode", "")
    checks = [
        "S_AGENTOS_OPERATOR_KEY" in code,
        "S_AGENTOS_API_TOKEN" in code,
        "x-agentos-key" in code.lower(),
        "authorization" in code.lower(),
        "...incoming" in code,
        "body" in code and "headers" in code,
    ]
    add("command_gateway_auth_patch", all(checks), "operator key + bearer/X header + body propagation present" if all(checks) else "one or more auth patch checks failed")
except Exception as e:
    add("command_gateway_auth_patch", False, str(e))

# 5. Docker Compose passes operator key into n8n
try:
    docker = DOCKER.read_text()
    add("docker_env_operator_key", "S_AGENTOS_OPERATOR_KEY=${S_AGENTOS_OPERATOR_KEY}" in docker, "S_AGENTOS_OPERATOR_KEY is passed to n8n")
except Exception as e:
    add("docker_env_operator_key", False, str(e))

# 6. Curl script syntax
try:
    if shutil.which("bash"):
        proc = subprocess.run(["bash", "-n", str(CURL_TESTS)], capture_output=True, text=True)
        add("curl_tests_bash_syntax", proc.returncode == 0, proc.stderr.strip())
    else:
        add("curl_tests_bash_syntax", True, "bash unavailable; skipped")
except Exception as e:
    add("curl_tests_bash_syntax", False, str(e))

# 7. Dashboard JS syntax
try:
    html = DASHBOARD.read_text()
    scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, flags=re.S | re.I)
    if shutil.which("node") and scripts:
        tmp = ROOT / ".dashboard.syntaxcheck.tmp.js"
        tmp.write_text("\n".join(scripts))
        proc = subprocess.run(["node", "--check", str(tmp)], capture_output=True, text=True)
        tmp.unlink(missing_ok=True)
        add("dashboard_js_syntax", proc.returncode == 0, proc.stderr.strip())
    else:
        add("dashboard_js_syntax", True, "node unavailable or no script; skipped")
except Exception as e:
    add("dashboard_js_syntax", False, str(e))

# 8. Version alignment
try:
    stale = []
    for path in ROOT.rglob("*"):
        if path.is_file() and path.name not in {"qa-validation-report.md"} and path.suffix.lower() in {".md", ".json", ".sql", ".yml", ".yaml", ".example", ".html", ".sh"}:
            txt = path.read_text(errors="ignore")
            if "0.1.1" in txt or "0.1.2" in txt:
                stale.append(str(path.relative_to(ROOT)))
    add("version_alignment", not stale, "stale=" + ", ".join(stale) if stale else "no stale 0.1.1/0.1.2 strings outside QA report")
except Exception as e:
    add("version_alignment", False, str(e))

# 9. OpenAPI present
try:
    add("openapi_present", (ROOT / "openapi" / "s-agentos-kernel-v0.1.3.openapi.yaml").exists(), "OpenAPI file present")
except Exception as e:
    add("openapi_present", False, str(e))

passed = sum(1 for _, ok, _ in results if ok)
failed = len(results) - passed
for name, ok, detail in results:
    icon = "PASS" if ok else "FAIL"
    print(f"{icon}: {name} — {detail}")
print(f"\nRESULT: {passed} PASS / {failed} FAIL")

sys.exit(0 if failed == 0 else 1)
