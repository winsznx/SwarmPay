-- ============================================================
-- Preflight queries — run BEFORE migrations/001_phase_b_schema.sql
-- Copy the output of every block and save it locally. This is the
-- schema + data snapshot you will compare against postflight.
-- ============================================================

-- 1. All tables currently in the public schema
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
 ORDER BY table_name;

-- 2. Columns on tasks (expect pre-B shape)
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'tasks'
 ORDER BY ordinal_position;

-- 3. Columns on payment_intents
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'payment_intents'
 ORDER BY ordinal_position;

-- 4. All constraints on payment_intents
--    (Used to confirm there is no pre-existing status CHECK we'd be
--    stomping on. Save the output verbatim.)
SELECT conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'payment_intents'::regclass
 ORDER BY conname;

-- 5. Distribution of status values on payment_intents
--    Forward migration will rewrite 'completed' → 'settled'. Expect
--    'completed' count > 0 on live prod; 'settled'/'signed' typically 0.
SELECT status, COUNT(*) AS row_count
  FROM payment_intents
 GROUP BY status
 ORDER BY status;

-- 6. Row counts we need to preserve through the migration
SELECT COUNT(*) AS task_count            FROM tasks;
SELECT COUNT(*) AS payment_count         FROM payment_intents;
SELECT COUNT(*) AS bid_count_preexisting FROM bids;
SELECT COUNT(*) AS agent_count_preexisting FROM agents;

-- 7. Existing columns on bids + agents — used to confirm that the
--    forward migration's ADD COLUMN IF NOT EXISTS guards are needed
--    (is_winner, capabilities, avg_response_time_ms should NOT exist yet).
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'bids'
 ORDER BY ordinal_position;

SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'agents'
 ORDER BY ordinal_position;
