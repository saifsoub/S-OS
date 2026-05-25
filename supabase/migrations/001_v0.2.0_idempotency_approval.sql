-- ============================================================================
-- S/ AgentOS Kernel v0.2.0 — Migration 001
-- Adds idempotency, approval, and audit tables to the v0.1.3 schema.
-- Run AFTER schema.sql has been applied (v0.1.3 baseline).
-- Safe to run multiple times (uses IF NOT EXISTS and CREATE OR REPLACE).
-- ============================================================================

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  command_id      text NOT NULL,
  action          text NOT NULL,
  run_mode        text DEFAULT 'draft',
  result          jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  expires_at      timestamptz DEFAULT (now() + INTERVAL '24 hours')
);

COMMENT ON TABLE idempotency_keys IS
  'Tracks submitted idempotency keys to prevent duplicate live execution. '
  'Rows expire after 24 hours by default.';

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_command_id ON idempotency_keys (command_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS approval_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id      text NOT NULL,
  trace_id        text,
  action          text NOT NULL,
  run_mode        text DEFAULT 'live',
  approval_status text DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'expired')),
  requested_by    text DEFAULT 'operator',
  approved_by     text,
  objective       text,
  context         jsonb DEFAULT '{}',
  notes           text,
  requested_at    timestamptz DEFAULT now(),
  decided_at      timestamptz,
  expires_at      timestamptz DEFAULT (now() + INTERVAL '1 hour'),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE approval_requests IS
  'Operator approval queue for live/consequential actions. '
  'live run_mode write operations check this table before execution.';

CREATE INDEX IF NOT EXISTS idx_approval_requests_command_id ON approval_requests (command_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_approval_status ON approval_requests (approval_status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_created_at ON approval_requests (created_at DESC);

CREATE OR REPLACE TRIGGER trg_approval_requests_updated_at
  BEFORE UPDATE ON approval_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_id      text NOT NULL,
  trace_id        text,
  idempotency_key text,
  action          text NOT NULL,
  objective       text,
  requested_by    text,
  run_mode        text,
  approval_status text,
  agent_id        text,
  outcome         text DEFAULT 'unknown'
    CHECK (outcome IN ('success', 'error', 'rejected', 'duplicate', 'unknown')),
  error_message   text,
  duration_ms     integer,
  kernel_version  text DEFAULT '0.2.0',
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now()
);

COMMENT ON TABLE audit_log IS
  'Immutable audit trail. Every authenticated command is recorded. '
  'Append-only — do not UPDATE or DELETE rows.';

CREATE INDEX IF NOT EXISTS idx_audit_log_command_id ON audit_log (command_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_log_outcome ON audit_log (outcome);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);

-- Add v0.2.0 columns to os_commands
ALTER TABLE os_commands
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'not_required';

CREATE INDEX IF NOT EXISTS idx_os_commands_trace_id ON os_commands (trace_id);
CREATE INDEX IF NOT EXISTS idx_os_commands_idempotency_key ON os_commands (idempotency_key);

-- Update kernel_version default for new rows
ALTER TABLE os_commands ALTER COLUMN kernel_version SET DEFAULT '0.2.0';
ALTER TABLE os_events ALTER COLUMN kernel_version SET DEFAULT '0.2.0';

-- ============================================================================
-- Tables added: 3 (idempotency_keys, approval_requests, audit_log)
-- Columns added: 3 (os_commands.trace_id, .idempotency_key, .approval_status)
-- Indexes added: 9
-- Default updates: 2 (os_commands.kernel_version, os_events.kernel_version)
-- ============================================================================
