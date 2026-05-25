#!/usr/bin/env python3
"""Starter secret scanner for S/ AgentOS.

This script is intentionally conservative. Claude should improve it during the v0.2.0 hardening pass.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXCLUDE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv"}
EXCLUDE_FILES = {"secret-scan.py"}

PATTERNS = {
    "telegram_bot_token": re.compile(r"\b\d{6,12}:[A-Za-z0-9_-]{30,}\b"),
    "generic_sk_key": re.compile(r"\bsk-[A-Za-z0-9_\-]{16,}\b"),
    "jwt_like": re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
    "private_key": re.compile(r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----"),
}

def should_skip(path: pathlib.Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDE_DIRS:
        return True
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".gz"}:
        return True
    return False

def main() -> int:
    findings = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or should_skip(path):
            continue
        try:
            text = path.read_text(errors="ignore")
        except Exception:
            continue
        for name, pattern in PATTERNS.items():
            for m in pattern.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                snippet = m.group(0)[:12] + "..."
                findings.append((str(path.relative_to(ROOT)), line, name, snippet))

    if findings:
        print("Potential secrets found:")
        for file, line, name, snippet in findings:
            print(f"- {file}:{line}: {name}: {snippet}")
        return 1

    print("PASS: no obvious secrets detected")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
