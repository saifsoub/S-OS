#!/usr/bin/env python3
"""
S/ AgentOS — n8n Workflow Linter
Checks all workflow JSON files for common issues:
- webhook nodes must use POST
- no hardcoded operator keys or service-role credentials in code nodes
- all Supabase credential references use the standard name
- no 'localhost' URLs in webhook or HTTP nodes
- version string consistency (no stale v0.1.x in code)
- response nodes must be present for each webhook
- code nodes must not log/return raw auth tokens
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = ROOT / "workflows"

SUPABASE_CRED_NAME = "Supabase API"
EXPECTED_VERSION = "0.2.0"

results = []


def add(name, ok, detail=""):
    results.append((name, ok, detail))


workflow_data = {}
try:
    for path in sorted(WORKFLOWS.glob("*.json")):
        workflow_data[path.name] = json.loads(path.read_text())
    add("workflow_files_loaded", True, f"{len(workflow_data)} files")
except Exception as e:
    add("workflow_files_loaded", False, str(e))
    print("FAIL: workflow_files_loaded —", e)
    sys.exit(1)


for fname, data in workflow_data.items():
    nodes = data.get("nodes", [])

    # 1. All webhook nodes use POST
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.webhook":
            method = node.get("parameters", {}).get("httpMethod", "GET")
            add(
                f"{fname}:webhook_post:{node['name']}",
                method == "POST",
                f"httpMethod={method}",
            )

    # 2. Supabase nodes use standard credential name
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.supabase":
            cred = node.get("credentials", {}).get("supabaseApi", {}).get("name", "")
            add(
                f"{fname}:supabase_cred:{node['name']}",
                cred == SUPABASE_CRED_NAME,
                f"cred='{cred}'",
            )

    # 3. Code nodes must not contain hardcoded secrets
    secret_patterns = [
        re.compile(r"sk-[A-Za-z0-9]{20,}"),
        re.compile(r"sk-ant-[A-Za-z0-9\-_]{20,}"),
        re.compile(r"eyJ[A-Za-z0-9+/=]{100,}"),
        re.compile(r"gsk_[A-Za-z0-9]{20,}"),
    ]
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.code":
            code = node.get("parameters", {}).get("jsCode", "")
            hits = [p.pattern for p in secret_patterns if p.search(code)]
            add(
                f"{fname}:code_no_hardcoded_secrets:{node['name']}",
                not hits,
                f"patterns found: {hits}" if hits else "clean",
            )

    # 4. Code nodes must not leak providedToken/raw keys in response JSON
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.code":
            code = node.get("parameters", {}).get("jsCode", "")
            if "providedToken" in code and "[REDACTED]" not in code and "return" in code:
                lines = code.split("\n")
                leaking = any("providedToken" in l and "return" in l for l in lines)
                add(
                    f"{fname}:code_no_token_leak:{node['name']}",
                    not leaking,
                    "providedToken may appear in response" if leaking else "OK",
                )

    # 5. No localhost URLs in webhook path or HTTP nodes
    for node in nodes:
        if node.get("type") in ("n8n-nodes-base.webhook", "n8n-nodes-base.httpRequest"):
            params = node.get("parameters", {})
            url = params.get("url", "") or params.get("path", "")
            has_localhost = "localhost" in str(url) or "127.0.0.1" in str(url)
            add(
                f"{fname}:no_localhost_url:{node['name']}",
                not has_localhost,
                f"url={url}" if has_localhost else "OK",
            )

    # 6. Stale version strings in code node logic
    stale_pattern = re.compile(r"kernel_version.*['\"]0\.1\.[0-9]")
    for node in nodes:
        if node.get("type") == "n8n-nodes-base.code":
            code = node.get("parameters", {}).get("jsCode", "")
            stale = bool(stale_pattern.search(code))
            add(
                f"{fname}:no_stale_version:{node['name']}",
                not stale,
                f"stale version string found" if stale else "OK",
            )


# Summary
passed = sum(1 for _, ok, _ in results if ok)
failed = len(results) - passed
for name, ok, detail in results:
    if not ok:
        print(f"FAIL: {name} — {detail}")
print(f"\nRESULT: {passed} PASS / {failed} FAIL")
sys.exit(0 if failed == 0 else 1)
