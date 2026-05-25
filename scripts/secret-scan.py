#!/usr/bin/env python3
"""
S/ AgentOS — Secret Scanner
Detects common secret patterns in repository files before commit or CI.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

SKIP_DIRS = {".git", "node_modules", ".venv", "__pycache__"}
SKIP_FILES = {".env"}
TEXT_EXTS = {
    ".py", ".js", ".ts", ".json", ".yaml", ".yml", ".sh", ".md",
    ".html", ".sql", ".example", ".txt", ".env",
}

SECRET_PATTERNS = [
    (re.compile(r"sk-[A-Za-z0-9]{20,}"), "OpenAI API key"),
    (re.compile(r"sk-ant-[A-Za-z0-9\-_]{20,}"), "Anthropic API key"),
    (re.compile(r"gsk_[A-Za-z0-9]{20,}"), "Groq API key"),
    (re.compile(r"eyJ[A-Za-z0-9+/=]{100,}"), "Supabase/JWT service-role key"),
    (re.compile(r"\d{8,12}:[A-Za-z0-9\-_]{35,}"), "Telegram bot token"),
    (re.compile(r'(?<![a-z_])(password|secret|key|token)\s*[=:]\s*["\'](?!change-me|your-|<|CHANGE|sk-\.\.\.|eyJ\.\.\.)[A-Za-z0-9+/=_\-]{32,}["\']', re.IGNORECASE), "Hardcoded credential"),
    (re.compile(r"AKIA[A-Z0-9]{16}"), "AWS access key"),
    (re.compile(r"sk_live_[A-Za-z0-9]{24,}"), "Stripe live key"),
    (re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"), "Private key"),
]

PLACEHOLDER_ALLOWLIST = re.compile(
    r"(change-me|your-|<your|YOUR_|sk-\.\.\.|sk-ant-\.\.\.|gsk_\.\.\.|eyJ\.\.\.|\.\.\.|PLACEHOLDER|example\.com|yourdomain\.com|your-project|your-service|your-operator-key|change-me-operator|change-me-strong|change-me-postgres)",
    re.IGNORECASE
)

findings = []


def scan_file(path: pathlib.Path):
    try:
        text = path.read_text(errors="ignore")
    except Exception:
        return
    for lineno, line in enumerate(text.splitlines(), 1):
        if PLACEHOLDER_ALLOWLIST.search(line):
            continue
        for pattern, label in SECRET_PATTERNS:
            if pattern.search(line):
                findings.append((str(path.relative_to(ROOT)), lineno, label, line.strip()[:120]))


def main():
    for path in ROOT.rglob("*"):
        if path.is_file() and not any(d in path.parts for d in SKIP_DIRS):
            if path.suffix.lower() in TEXT_EXTS or path.name in SKIP_FILES:
                scan_file(path)

    if findings:
        print(f"SECRET SCAN: {len(findings)} potential secret(s) found:\n")
        for file, line, label, snippet in findings:
            print(f"  {file}:{line} — [{label}]")
            print(f"    {snippet}\n")
        sys.exit(1)
    else:
        print("SECRET SCAN: No secrets detected.")
        sys.exit(0)


if __name__ == "__main__":
    main()
