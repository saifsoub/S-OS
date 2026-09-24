# OpenHuman × S/ Intent-Preserving Execution Loop

This document is the canonical binding between the OpenHuman-style agent fleet and the S-OS control plane.

## Canonical execution spine

```
TRIGGER
  ↓
GOAL CONTRACT
  ↓
CLASSIFY
  ↓
ROUTE
  ↓
SKILLS
  ↓
EXECUTORS
  ↓
ARTIFACT / TASK REPORT
  ↓
INDEPENDENT CHECKER
  ↓
EVIDENCE
  ↓
PASS? ── no ──> DIAGNOSE → REPAIR → LEARN → RE-RUN
  │
 yes
  ↓
RECLASSIFY AGAINST ORIGINAL INTENT
  ↓
MEMORY / STATE
  ↓
NEXT ACTION OR CLOSED OUTCOME
```

## Non-negotiable invariant

The original operator intent is the root source of truth. No router, worker, summary, checker, or memory update may silently redefine it.

## Runtime responsibilities

### 1. Trigger
Accept a user command, event, schedule, webhook, upstream completion, or agent request.

### 2. Goal contract
Normalize the request into:
- objective
- user-visible deliverable
- constraints
- protected boundaries
- required evidence
- success criteria
- stop / hold conditions

### 3. Classify
Classify only to determine routing, permissions, data boundaries, and control-plane policy. Classification must not rewrite the task.

### 4. Route
Select the smallest capable combination of skills, agents, runtimes, APIs, and tools. Parallelize only independent branches.

### 5. Skills
Prefer systematic skills when a reusable method exists. Skills constrain execution quality but do not replace the goal contract.

### 6. Executors
Every worker receives a bounded contract containing:
- assigned subtask
- allowed tools
- permissions
- relevant state
- forbidden actions
- expected output
- evidence requirement
- closure condition

### 7. Artifact / task report
Workers return:
- result
- evidence
- changed state
- blockers
- uncertainty
- side effects performed

### 8. Independent checker
The checker validates against the original goal contract, not the worker self-report. It checks:
- completeness
- factual support
- requested artifact or action actually exists
- permissions respected
- consequential writes match authorization
- output still matches original intent

### 9. Failure branch
A failure is not hidden behind generic retry.

```
FAIL → DIAGNOSE → REPAIR → LEARN → RE-RUN smallest failed branch
```

Successful branches are preserved.

### 10. Intent revalidation
Before closure, re-evaluate the final result against the original request. A technically correct but intent-drifted result is a failure.

### 11. Memory / state
Persist only durable material:
- decisions
- evidence
- canonical artifacts
- constraints
- learned repair rules
- unresolved blockers
- next executable action

Do not persist secrets or noisy transcript history when a compact state model is sufficient.

## Closure states

Every branch must end as exactly one of:
1. completed with evidence
2. rerouted and completed
3. held with explicit trigger / deadline
4. blocked by unavoidable external boundary

Silent limbo is not a valid state.

## OpenHuman role inside S-OS

OpenHuman is the agent-fleet orchestration layer. S-OS remains the control plane and source of policy, approvals, registry, telemetry, and state.

```
S-OS Goal Contract
      ↓
OpenHuman Fleet
      ↓
Specialized Workers / Skills
      ↓
Checker
      ↓
Evidence + State
      ↓
S-OS Closure / Next Action
```

## ChatGPT plugin binding

Private plugin:
- display name: OpenHuman
- plugin id: `plugins_6ab4f3f9d2908191978d519313872628`
- current line: `0.2.x`
- canonical orchestration skill: `intent-preserving-execution-loop`

The plugin is one execution surface. This repository is the canonical architecture source.
