# S/Context v2

S/Context v2 is the context operating layer for S/OS. In S/ terminology, the **server** is the operator-owned or operator-leased host where the user's agents are hosted. Individual gateways, context services, workflow engines, and agent processes are services running on or connected through that server; they are not called the server themselves.

It combines five planes:

1. Canonical context — approved, versioned durable truth.
2. Drafts — proposed canonical changes with separation of duties.
3. Live claims — expiring observations with provenance and confidence.
4. Sessions — temporary working state.
5. Capability grants — principal/source/capability/constraint/TTL/max-use authorization.

## Context compiler

`POST /v2/context/compile` accepts an `@context/<id>#<section>` citation and returns a bounded bundle containing canonical context, live claims, conflicts, provenance, freshness, session state, policy metadata and token-budget estimates.

The compiler fails rather than silently truncating canonical context if the requested canonical slice alone exceeds the token budget.

## Identity

Authentication is fail-closed. There is no actor header fallback.

- `S_CONTEXT_OPERATOR_KEY` authenticates `human:owner`.
- `S_CONTEXT_PRINCIPAL_KEYS` is a JSON object mapping principals to dedicated bearer keys, for example `{ "agent:writer": "..." }`.

## Persistence

SQLite (WAL mode) is used for the context service so deployment does not depend on an additional package manager or external database migration. The Docker deployment mounts `/data` on a named volume. PostgreSQL can replace this adapter later without changing the HTTP contract.

## Truthful action boundary

S/Context v2 does not pretend to execute external actions. `/v2/actions/record` validates and consumes an active capability grant, then records the externally executed/resulting action receipt. `/v2/actions/record` does not infer server-level execution or side-effect state. Actual execution occurs through whichever agent/tool/workflow path is configured on the server, and its result must be verified from that path's receipt or observable result.
