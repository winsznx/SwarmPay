-- ============================================================
-- Phase B schema extension — SwarmPay
-- Safe to re-run. Non-destructive to existing tables/data.
-- Applies AFTER code (with src/lib/supabase.ts 'settled' fix) is
-- deployed green. See migrations/README.md for ordering.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. payment_intents.status normalization
--    Legacy code wrote status='completed'. New contract is one of
--    ('pending','signed','settled','failed'). Code has already been
--    updated to write 'settled'; this migration reconciles existing
--    rows and locks the enum with a CHECK.
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM payment_intents WHERE status = 'completed' LIMIT 1) THEN
    UPDATE payment_intents SET status = 'settled' WHERE status = 'completed';
    RAISE NOTICE 'Migrated legacy completed status to settled';
  END IF;
END $$;

ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN ('pending','signed','settled','failed'));

-- ────────────────────────────────────────────────────────────
-- 2. Augment existing bids table
--    Existing schema is retained. Adds is_winner for clean winner
--    indexing instead of relying on the string-typed status column.
-- ────────────────────────────────────────────────────────────
ALTER TABLE bids ADD COLUMN IF NOT EXISTS is_winner BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_bids_task_submitted ON bids(task_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_bids_winner        ON bids(task_id) WHERE is_winner = TRUE;

-- ────────────────────────────────────────────────────────────
-- 3. Augment existing agents table
--    Keeps role column. Adds capabilities array + avg_response_time_ms.
--    wallet_address stays NULL in seed until Phase D sync-agent-wallets.ts
--    populates real Circle wallet addresses.
-- ────────────────────────────────────────────────────────────
ALTER TABLE agents ADD COLUMN IF NOT EXISTS capabilities         TEXT[];
ALTER TABLE agents ADD COLUMN IF NOT EXISTS avg_response_time_ms INTEGER DEFAULT 1500;

-- ────────────────────────────────────────────────────────────
-- 4. Augment tasks table with UI-surfaced fields
--    These values exist in-memory today; formalizing them as columns
--    so the UI can drive off persisted data after Supabase failover.
-- ────────────────────────────────────────────────────────────
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS complexity             TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS orchestrator_rationale TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS agent_count            INTEGER;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS winning_agent_name     TEXT;

-- ────────────────────────────────────────────────────────────
-- 5. New: subtasks
--    Two-model transitional state: legacy subtasks still ride inside
--    the tasks table via parent_task_id. This table is the Phase B
--    first-class home; data backfill is B.2 work.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id            UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  parent_agent_id    TEXT REFERENCES agents(id),
  type               TEXT,
  title              TEXT NOT NULL,
  description        TEXT,
  budget             NUMERIC(12,6),
  status             TEXT NOT NULL DEFAULT 'pending',
  assigned_agent_id  TEXT REFERENCES agents(id),
  winning_bid_id     UUID,
  winning_agent_name TEXT,
  depth              INTEGER DEFAULT 1,
  order_index        INTEGER,
  result             JSONB,
  execution_valid    BOOLEAN DEFAULT FALSE,
  cost_breakdown     JSONB,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at       TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id, order_index);

-- ────────────────────────────────────────────────────────────
-- 6. New: subtask_bids
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subtask_bids (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subtask_id        UUID NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
  agent_id          TEXT REFERENCES agents(id),
  agent_name        TEXT,
  price             NUMERIC(12,6) NOT NULL CHECK (price >= 0),
  estimated_time_ms INTEGER,
  reasoning         TEXT,
  is_winner         BOOLEAN DEFAULT FALSE,
  submitted_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subtask_bids_subtask ON subtask_bids(subtask_id);

-- ────────────────────────────────────────────────────────────
-- 7. New: task_events (event-sourcing ledger for the pipeline)
--    Supersedes pipeline_steps for new work. pipeline_steps is left
--    in place but dormant (see COMMENT below).
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_events (
  id         BIGSERIAL PRIMARY KEY,
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload    JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_events_task_created ON task_events(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_task_events_type         ON task_events(event_type, created_at);

COMMENT ON TABLE pipeline_steps IS
  'DORMANT (superseded by task_events in Phase B). Retained for backward compatibility; no new writes expected.';

-- ────────────────────────────────────────────────────────────
-- 8. New: settlements
--    Structured settlement record. Existing tasks.settlement JSONB
--    will be mirrored here on new writes (B.2). No backfill in B.1.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tx_hash          TEXT,
  explorer_url     TEXT,
  intents_settled  INTEGER NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,6) DEFAULT 0,
  gas_cost         NUMERIC(18,9) DEFAULT 0.0006,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','broadcast','confirmed','failed')),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT now(),
  confirmed_at     TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_settlements_task ON settlements(task_id);

-- ────────────────────────────────────────────────────────────
-- 9. RLS — permissive demo policies, matching the project's current
--    open-access convention. Re-runs safely: DROP POLICY IF EXISTS
--    then CREATE POLICY. Tightening is a Phase C task.
-- ────────────────────────────────────────────────────────────
ALTER TABLE bids          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtask_bids  ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on bids"         ON bids;
CREATE POLICY "Allow all on bids"                 ON bids          FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on subtasks"     ON subtasks;
CREATE POLICY "Allow all on subtasks"             ON subtasks      FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on subtask_bids" ON subtask_bids;
CREATE POLICY "Allow all on subtask_bids"         ON subtask_bids  FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on task_events"  ON task_events;
CREATE POLICY "Allow all on task_events"          ON task_events   FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on settlements"  ON settlements;
CREATE POLICY "Allow all on settlements"          ON settlements   FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on agents"       ON agents;
CREATE POLICY "Allow all on agents"               ON agents        FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────
-- 10. Realtime publication — idempotent via duplicate_object catch.
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bids;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE subtasks;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE subtask_bids;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payment_intents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 11. Agent seed — exact rows from src/lib/store/index.ts:4-11.
--     TODO(Phase D): populate wallet_address via scripts/sync-agent-wallets.ts
--     once Circle wallet IDs are registered in .env.local.
-- ────────────────────────────────────────────────────────────
INSERT INTO agents (id, name, role, reputation, balance, capabilities) VALUES
  ('crypto-scout-x', 'CryptoScout-X', 'orchestrator', 95, 0.42, ARRAY['orchestrator']),
  ('research-alpha', 'Research-Alpha', 'research',     92, 0.19, ARRAY['research']),
  ('data-miner-pro', 'DataMiner-Pro',  'research',     87, 0.31, ARRAY['research']),
  ('parser-x',       'Parser-X',       'clean_data',   88, 0.07, ARRAY['clean_data']),
  ('analysis-node',  'Analysis-Node',  'analysis',     91, 0.16, ARRAY['analysis']),
  ('compute-grid-4', 'Compute-Grid-4', 'compute',      90, 0.08, ARRAY['compute'])
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 12. Drop stale gas_cost default on settlements
--     The 0.0006 DEFAULT was a fallback constant that lets unwritten
--     rows look like they were measured. Going forward, every settlement
--     row carries a measured gas value (Task 2C wires the receipt
--     fetcher); rows that haven't been measured yet must be observably
--     NULL, not silently 0.0006.
--     ALTER ... DROP DEFAULT is idempotent in Postgres.
-- ────────────────────────────────────────────────────────────
ALTER TABLE settlements ALTER COLUMN gas_cost DROP DEFAULT;

COMMIT;
