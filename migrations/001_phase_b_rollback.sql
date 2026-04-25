-- ============================================================
-- Phase B rollback — reverses migrations/001_phase_b_schema.sql
-- Non-destructive to pre-Phase-B data. Existing tasks and
-- payment_intents rows are NOT deleted or down-migrated.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Drop new tables (CASCADE also removes FK refs, indexes,
--    policies, and membership in the realtime publication).
-- ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS task_events  CASCADE;
DROP TABLE IF EXISTS subtask_bids CASCADE;
DROP TABLE IF EXISTS subtasks     CASCADE;
DROP TABLE IF EXISTS settlements  CASCADE;

-- ────────────────────────────────────────────────────────────
-- 2. Remove added columns on existing tables
-- ────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_bids_task_submitted;
DROP INDEX IF EXISTS idx_bids_winner;
ALTER TABLE bids   DROP COLUMN IF EXISTS is_winner;

ALTER TABLE agents DROP COLUMN IF EXISTS capabilities;
ALTER TABLE agents DROP COLUMN IF EXISTS avg_response_time_ms;

ALTER TABLE tasks  DROP COLUMN IF EXISTS complexity;
ALTER TABLE tasks  DROP COLUMN IF EXISTS orchestrator_rationale;
ALTER TABLE tasks  DROP COLUMN IF EXISTS agent_count;
ALTER TABLE tasks  DROP COLUMN IF EXISTS winning_agent_name;

-- ────────────────────────────────────────────────────────────
-- 3. payment_intents.status
--    Forward migration added a CHECK; rollback removes it.
--    Original schema had no CHECK, so we do not re-add one.
--    We do NOT un-migrate 'settled' → 'completed' — rows inserted
--    after the forward migration may legitimately be 'settled',
--    and there is no way to distinguish them from the migrated set.
-- ────────────────────────────────────────────────────────────
ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_status_check;

-- ────────────────────────────────────────────────────────────
-- 4. RLS rollback
--    The forward migration enabled RLS and added policies. Drop
--    those explicitly so nothing dangling remains. bids+agents
--    had no RLS before B.1, so disabling is the correct reverse.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on bids"    ON bids;
ALTER TABLE bids   DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on agents"  ON agents;
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
-- (subtasks, subtask_bids, task_events, settlements were DROPped above
--  in step 1 — their policies and RLS go with them.)

-- ────────────────────────────────────────────────────────────
-- 5. Realtime publication
--    payment_intents was ADDed by the forward migration; detach here.
--    bids was also ADDed by the forward migration.
--    Other Phase B tables were DROPped in step 1 which auto-detaches.
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE payment_intents;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE bids;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. Agent seed
--    Rollback does NOT DELETE seeded agent rows. If downstream rows
--    in tasks / bids / payment_intents reference them via FK, a
--    cascading delete could destroy live data. To remove seeds
--    manually after verifying no FK references exist:
--
--      DELETE FROM agents WHERE id IN
--        ('crypto-scout-x','research-alpha','data-miner-pro',
--         'parser-x','analysis-node','compute-grid-4');
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 7. pipeline_steps comment
--    The forward migration labelled pipeline_steps as DORMANT via
--    COMMENT ON TABLE. Reset to NULL to restore the original state.
-- ────────────────────────────────────────────────────────────
COMMENT ON TABLE pipeline_steps IS NULL;

COMMIT;
