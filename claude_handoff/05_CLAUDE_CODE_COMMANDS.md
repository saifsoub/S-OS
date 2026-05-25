# Claude Code Path — Terminal Flow

## 1. Unzip

```bash
unzip s-agentos-claude-next-level-handoff.zip
cd s-agentos-claude-next-level-handoff
```

## 2. Start Claude Code

```bash
claude
```

## 3. Give Claude the mission

Paste the contents of `claude_handoff/01_CLAUDE_MASTER_PROMPT.md`.

## 4. Ask it to run baseline QA

```text
Run baseline QA using scripts/static-qa.py, shell syntax checks, JSON parsing, and your own workflow/schema linting. Then propose a v0.2.0 patch plan before editing.
```

## 5. After Claude finishes, run local checks

```bash
python3 scripts/static-qa.py
bash -n tests/curl-tests.sh
find workflows schemas -name '*.json' -print0 | xargs -0 -n1 python3 -m json.tool >/dev/null
python3 scripts/secret-scan.py
python3 scripts/validate-schemas.py
python3 scripts/workflow-lint.py
```
