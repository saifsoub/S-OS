-- ============================================================================
-- S/ AgentOS Kernel v0.1 — Complete Supabase/PostgreSQL Schema
-- ============================================================================
-- Description: Core operating memory schema for the AgentOS kernel.
--              Stores commands, events, agent registry, execution runs,
--              evaluation results, evolution plans, workflow registry,
--              and model registry.
--
-- Usage:       Execute this SQL in the Supabase SQL Editor (or psql).
-- Version:     0.1.3
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TRIGGER FUNCTION: Auto-update updated_at column
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TABLE: os_commands
-- ============================================================================
CREATE TABLE os_commands (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id      text NOT NULL UNIQUE,
  action          text NOT NULL,
  objective       text NOT NULL,
  requested_by    text DEFAULT 'operator',
  priority        text DEFAULT 'normal',
  agent_id        text,
  run_mode        text DEFAULT 'draft',
  context         jsonb DEFAULT '{}',
  status          text DEFAULT 'received',
  response        jsonb DEFAULT '{}',
  metadata        jsonb DEFAULT '{}',
  parameters      jsonb DEFAULT '{}',
  received_at     timestamptz,
  kernel_version  text DEFAULT '0.1.3',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE os_commands IS 'Stores all commands received by the command gateway. Primary ingestion table for operator directives and system control signals.';
COMMENT ON COLUMN os_commands.received_at IS 'Timestamp when the command was received by the n8n Command Gateway workflow';
COMMENT ON COLUMN os_commands.kernel_version IS 'AgentOS kernel version that processed this command, for tracking schema/API compatibility';
COMMENT ON COLUMN os_commands.parameters IS 'Additional command parameters as flexible key-value store for extensibility.';

CREATE INDEX idx_os_commands_command_id ON os_commands (command_id);
CREATE INDEX idx_os_commands_action ON os_commands (action);
CREATE INDEX idx_os_commands_status ON os_commands (status);
CREATE INDEX idx_os_commands_kernel_version ON os_commands (kernel_version);
CREATE INDEX idx_os_commands_created_at ON os_commands (created_at DESC);

CREATE TRIGGER trg_os_commands_updated_at
  BEFORE UPDATE ON os_commands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: os_events
-- ============================================================================
CREATE TABLE os_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,
  source          text DEFAULT 'unknown',
  severity        text DEFAULT 'info' CHECK (severity IN ('critical', 'error', 'warning', 'info', 'debug')),
  agent_id        text,
  command_id      text,
  payload         jsonb DEFAULT '{}',
  metadata        jsonb DEFAULT '{}',
  action          text,
  status          text DEFAULT 'logged',
  kernel_version  text DEFAULT '0.1.3',
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE os_events IS 'Stores OS events and telemetry. Captures system-wide happenings, agent lifecycle events, errors, warnings, and debug info for observability.';

CREATE INDEX idx_os_events_event_type ON os_events (event_type);
CREATE INDEX idx_os_events_source ON os_events (source);
CREATE INDEX idx_os_events_severity ON os_events (severity);
CREATE INDEX idx_os_events_agent_id ON os_events (agent_id);
CREATE INDEX idx_os_events_command_id ON os_events (command_id);
CREATE INDEX idx_os_events_action ON os_events (action);
CREATE INDEX idx_os_events_status ON os_events (status);
CREATE INDEX idx_os_events_kernel_version ON os_events (kernel_version);
CREATE INDEX idx_os_events_created_at ON os_events (created_at DESC);

-- ============================================================================
-- TABLE: agent_registry
-- ============================================================================
CREATE TABLE agent_registry (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_code            text NOT NULL UNIQUE,
  agent_name            text,
  agent_type            text,
  purpose               text,
  responsibilities      jsonb DEFAULT '[]',
  inputs                jsonb DEFAULT '[]',
  outputs               jsonb DEFAULT '[]',
  tools_required        jsonb DEFAULT '[]',
  memory_required       jsonb DEFAULT '[]',
  evaluation_metrics    jsonb DEFAULT '[]',
  capabilities          jsonb DEFAULT '[]',
  deployment_status     text DEFAULT 'draft',
  lifecycle_status      text DEFAULT 'active',
  version               text DEFAULT '0.1',
  owner                 text DEFAULT 'operator',
  last_run_at           timestamptz,
  performance_metadata  jsonb DEFAULT '{}',
  metadata              jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE agent_registry IS 'Stores all registered agents with their full specifications. The authoritative catalog of all agents, their capabilities, and lifecycle metadata.';

CREATE INDEX idx_agent_registry_agent_code ON agent_registry (agent_code);
CREATE INDEX idx_agent_registry_agent_type ON agent_registry (agent_type);
CREATE INDEX idx_agent_registry_deployment_status ON agent_registry (deployment_status);
CREATE INDEX idx_agent_registry_lifecycle_status ON agent_registry (lifecycle_status);
CREATE INDEX idx_agent_registry_owner ON agent_registry (owner);
CREATE INDEX idx_agent_registry_created_at ON agent_registry (created_at DESC);

CREATE TRIGGER trg_agent_registry_updated_at
  BEFORE UPDATE ON agent_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: agent_runs
-- ============================================================================
CREATE TABLE agent_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        text,
  command_id      text,
  run_type        text DEFAULT 'task',
  input           jsonb DEFAULT '{}',
  output          jsonb DEFAULT '{}',
  status          text DEFAULT 'pending',
  started_at      timestamptz,
  completed_at    timestamptz,
  duration_ms     integer,
  error_message   text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE agent_runs IS 'Stores execution runs of agents. Each row is a single agent invocation with input/output, timing, status, and errors for performance tracking.';

CREATE INDEX idx_agent_runs_agent_id ON agent_runs (agent_id);
CREATE INDEX idx_agent_runs_command_id ON agent_runs (command_id);
CREATE INDEX idx_agent_runs_status ON agent_runs (status);
CREATE INDEX idx_agent_runs_created_at ON agent_runs (created_at DESC);

-- ============================================================================
-- TABLE: eval_results
-- ============================================================================
CREATE TABLE eval_results (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                text,
  command_id              text,
  evaluation_name         text,
  score                   numeric,
  passed                  boolean,
  evaluation_dimensions   jsonb DEFAULT '{}',
  test_cases              jsonb DEFAULT '[]',
  result                  jsonb DEFAULT '{}',
  evaluator               text DEFAULT 'system',
  status                  text DEFAULT 'completed',
  metadata                jsonb DEFAULT '{}',
  created_at              timestamptz DEFAULT now()
);

COMMENT ON TABLE eval_results IS 'Stores evaluation results for agent performance assessment. Drives quality assurance and evolution loops with measurable feedback on agent outputs.';

CREATE INDEX idx_eval_results_agent_id ON eval_results (agent_id);
CREATE INDEX idx_eval_results_evaluation_name ON eval_results (evaluation_name);
CREATE INDEX idx_eval_results_passed ON eval_results (passed);
CREATE INDEX idx_eval_results_score ON eval_results (score);
CREATE INDEX idx_eval_results_created_at ON eval_results (created_at DESC);

-- ============================================================================
-- TABLE: evolution_plans
-- ============================================================================
CREATE TABLE evolution_plans (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                  text,
  command_id                text,
  detected_gap              text,
  proposed_improvement      text,
  data_needed               jsonb DEFAULT '[]',
  workflow_changes_needed   jsonb DEFAULT '[]',
  risk_level                text DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  rollback_plan             text,
  approval_status           text DEFAULT 'pending',
  status                    text DEFAULT 'draft',
  metadata                  jsonb DEFAULT '{}',
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

COMMENT ON TABLE evolution_plans IS 'Stores agent evolution and improvement plans. Captures proposed improvements, data needs, workflow changes, risk levels, and approval status for systematic agent improvement.';

CREATE INDEX idx_evolution_plans_agent_id ON evolution_plans (agent_id);
CREATE INDEX idx_evolution_plans_risk_level ON evolution_plans (risk_level);
CREATE INDEX idx_evolution_plans_approval_status ON evolution_plans (approval_status);
CREATE INDEX idx_evolution_plans_status ON evolution_plans (status);
CREATE INDEX idx_evolution_plans_created_at ON evolution_plans (created_at DESC);

CREATE TRIGGER trg_evolution_plans_updated_at
  BEFORE UPDATE ON evolution_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: workflow_registry
-- ============================================================================
CREATE TABLE workflow_registry (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_code         text NOT NULL UNIQUE,
  workflow_name         text,
  workflow_version      text DEFAULT '0.1',
  n8n_workflow_id       text,
  active                boolean DEFAULT false,
  status                text DEFAULT 'draft',
  rollback_workflow_id  text,
  deployment_notes      text,
  metadata              jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE workflow_registry IS 'Stores n8n workflow registry entries. Maps workflow codes to n8n workflow IDs, tracks versions, active status, rollback targets, and deployment notes.';

CREATE INDEX idx_workflow_registry_workflow_code ON workflow_registry (workflow_code);
CREATE INDEX idx_workflow_registry_n8n_workflow_id ON workflow_registry (n8n_workflow_id);
CREATE INDEX idx_workflow_registry_active ON workflow_registry (active);
CREATE INDEX idx_workflow_registry_status ON workflow_registry (status);

CREATE TRIGGER trg_workflow_registry_updated_at
  BEFORE UPDATE ON workflow_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TABLE: model_registry
-- ============================================================================
CREATE TABLE model_registry (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              text,
  model_name            text,
  model_type            text,
  use_case              text,
  priority              integer DEFAULT 1,
  active                boolean DEFAULT true,
  cost_metadata         jsonb DEFAULT '{}',
  performance_metadata  jsonb DEFAULT '{}',
  metadata              jsonb DEFAULT '{}',
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

COMMENT ON TABLE model_registry IS 'Stores LLM model registry. Tracks available models from providers with use cases, priorities, cost metadata, and performance metrics for dynamic model selection.';

CREATE INDEX idx_model_registry_provider ON model_registry (provider);
CREATE INDEX idx_model_registry_model_name ON model_registry (model_name);
CREATE INDEX idx_model_registry_active ON model_registry (active);
CREATE INDEX idx_model_registry_priority ON model_registry (priority);

CREATE TRIGGER trg_model_registry_updated_at
  BEFORE UPDATE ON model_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS RECOMMENDATIONS
-- ============================================================================
-- Enable RLS after initial setup:
--   ALTER TABLE os_commands ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE os_events ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE agent_registry ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE eval_results ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE evolution_plans ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE workflow_registry ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE model_registry ENABLE ROW LEVEL SECURITY;
--
-- Example policy:
--   CREATE POLICY "Allow authenticated users full access" ON os_commands
--     FOR ALL USING (auth.role() = 'authenticated');
--
-- SECURITY NOTE: service_role key bypasses RLS. Keep it server-side only.
-- ============================================================================

-- Tables: 8 | Indexes: 37 | Triggers: 5 | Extensions: pgcrypto
