---
name: s-new-agent
description: Build a new agent end-to-end as one autonomous capability: brief, stack, role, tools/skills, scaffold/runtime, verification, and runnable handoff. Use whenever the user asks to create, build, scaffold, configure, or make an agent.
---

# S/New-Agent Capability

Create and verify an agent as **one continuous capability**. Do not split creation and verification into separate user-facing workflows, and do not pause for routine confirmations.

## Core contract

Run this sequence autonomously:

`intent/brief -> stack selection -> agent role -> capabilities/tools/skills -> scaffold/runtime setup -> verification/QA -> runnable output`

Only ask the user when a missing decision would materially change the final outcome and cannot be safely inferred from project context, existing preferences, repository conventions, or available tools.

## 1. Resolve the brief

Infer as much as possible from the request and current project context:

- agent purpose and success condition
- expected inputs and outputs
- execution environment
- consequential actions and approval boundaries
- persistence/memory needs
- expected UI or interface, if any

Do not re-ask information already available.

## 2. Select the stack

Choose the smallest suitable stack from the current environment and repo conventions. Prefer existing infrastructure before introducing new dependencies.

When building a Claude Agent SDK application, check current official documentation and package versions before installation. Support TypeScript or Python according to the strongest available signal; if neither is specified, choose the repo-native option.

Record the chosen stack internally and continue without waiting unless the choice materially changes the product outcome.

## 3. Define the agent role

Create one crisp role contract containing:

- mission
- allowed actions
- required tools/skills
- memory/context boundaries
- approval gates for consequential actions
- completion criteria

Avoid decorative personas unless they serve execution.

## 4. Attach capabilities, tools, and skills

Reuse existing tools and skills before creating new ones. Add only what the brief requires.

For each capability, ensure the agent can answer:

- what it does
- when it is invoked
- what it depends on
- what output proves success

Do not create a separate verifier capability when verification can be part of this flow.

## 5. Scaffold and runtime

Create the minimum runnable structure required by the chosen stack.

Typical requirements include:

- dependency/config files
- entrypoint
- environment example with placeholders only
- `.gitignore` protection for secrets
- runtime/start command
- basic error handling
- tool/MCP wiring only when required

Never commit secrets. Preserve S/AgentOS safety defaults: `dry_run`, `draft`, or `read_only` for consequential operations until explicit authorization exists.

## 6. Verification is part of creation

Before calling the agent complete, verify the same artifact you just created.

At minimum check:

- dependency/version correctness
- syntax/type validity
- imports and configuration
- required environment variables
- tool/skill references
- safety and approval boundaries
- startup command
- one representative happy-path execution or the closest available static verification

For TypeScript, run the repo-appropriate typecheck (for Claude Agent SDK apps, normally `npx tsc --noEmit`).

For Python, run syntax/import validation and the repo's tests or smoke check when available.

If verification fails, fix the implementation and repeat verification automatically. Do not hand the failure back to the user as another task unless blocked by an external credential, permission, unavailable service, or genuinely outcome-changing decision.

## 7. Runnable handoff

Return a compact completion handoff with:

- what was created
- where it lives
- exact run command
- verification result
- any real external blocker, if one remains

Do not end with a list of optional setup questions. The default state is **built + checked + runnable**.

## Autonomy rule

Normal implementation decisions are yours to resolve. Do not keep waiting for the user between brief, stack, scaffold, tooling, and verification. Escalate only decisions that materially change scope, cost, security, ownership, or the product's intended behavior.

## Compatibility note

This capability incorporates the useful behavior of Anthropic's `new-sdk-app` flow while removing its repeated question/confirmation pattern. Creation and verification are treated as a single atomic S/SkillOS capability.
