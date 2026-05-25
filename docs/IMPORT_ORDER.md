# n8n Import Order

Use this order for the patched S/ AgentOS Kernel v0.1.3.

## Required

1. `workflows/s-agentos-telemetry-logger.json`
2. `workflows/s-agentos-evolution-planner.json`
3. `workflows/s-agentos-agent-registry-service.json`
4. `workflows/s-agentos-command-gateway.json`

## Required n8n credential

Create this credential before activating workflows:

```text
Supabase API
```

All Supabase nodes reference this credential name.
