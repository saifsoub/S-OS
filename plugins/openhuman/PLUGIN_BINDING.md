# OpenHuman plugin binding

## Identity

- Display name: **OpenHuman**
- Plugin ID: `plugins_6ab4f3f9d2908191978d519313872628`
- Current version: `0.2.0`
- Release ID: `pluginrel_6ab50091cfa08191a4274ffdeb967058`

## Purpose

The ChatGPT plugin exposes the OpenHuman-style orchestration surface while S-OS remains the canonical control plane.

## Included skills

- `intent-preserving-execution-loop`
- `orchestrate-agent-fleet`
- `memory-state`
- `workflow-builder`
- `approval-gates`
- `deep-research`
- `agent-handoff`

## Binding rule

All non-trivial fleet orchestration must enter through:

```
intent-preserving-execution-loop
        ↓
orchestrate-agent-fleet
        ↓
specialized skills / executors
        ↓
independent checker
        ↓
evidence
        ↓
intent revalidation
        ↓
memory / closure
```

A downstream agent may narrow a subtask but may not redefine the original goal.

## Source-of-truth hierarchy

1. Original operator request / goal contract
2. S-OS control-plane policies and permissions
3. This repository's loop and crew specifications
4. Plugin skill implementation
5. Worker-local prompts and temporary state

If two layers conflict, the higher layer wins.
