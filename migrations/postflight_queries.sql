-- ============================================================
-- Postflight queries — run AFTER migrations/001_phase_b_schema.sql
-- Every block below has an expected result; mismatches signal a
-- partially-applied migration and warrant the rollback script.
-- ============================================================

-- 1. All six new/augmented tables exist
--    Expect six rows in alphabetical order.
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'bids','subtasks','subtask_bids','task_events','settlements','agents'
   )
 ORDER BY table_name;

-- 2. Agent seed landed correctly
--    Expect six rows matching src/lib/store/index.ts:4-11 exactly.
SELECT id, name, role, reputation, balance, capabilities
  FROM agents
 WHERE id IN (
   'crypto-scout-x','research-alpha','data-miner-pro',
   'parser-x','analysis-node','compute-grid-4'
 )
 ORDER BY id;
-- Expected (order by id):
--   analysis-node    | Analysis-Node   | analysis     | 91 | 0.16 | {analysis}
--   compute-grid-4   | Compute-Grid-4  | compute      | 90 | 0.08 | {compute}
--   crypto-scout-x   | CryptoScout-X   | orchestrator | 95 | 0.42 | {orchestrator}
--   data-miner-pro   | DataMiner-Pro   | research     | 87 | 0.31 | {research}
--   parser-x         | Parser-X        | clean_data   | 88 | 0.07 | {clean_data}
--   research-alpha   | Research-Alpha  | research     | 92 | 0.19 | {research}

-- 3. Added columns are present on augmented tables
--    Each query expects exactly one row.
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'bids' AND column_name = 'is_winner';

SELECT column_name FROM information_schema.columns
 WHERE table_name = 'agents'
   AND column_name IN ('capabilities','avg_response_time_ms')
 ORDER BY column_name;
-- Expect two rows.

SELECT column_name FROM information_schema.columns
 WHERE table_name = 'tasks'
   AND column_name IN (
     'complexity','orchestrator_rationale','agent_count','winning_agent_name'
   )
 ORDER BY column_name;
-- Expect four rows.

-- 4. RLS enabled on every Phase B table
--    Expect rowsecurity = true for all six rows.
SELECT tablename, rowsecurity
  FROM pg_tables
 WHERE tablename IN (
   'bids','subtasks','subtask_bids','task_events','settlements','agents'
 )
 ORDER BY tablename;

-- 5. Realtime publication includes the Phase B tables
--    Expect six rows.
SELECT pubname, tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
   AND tablename IN (
     'bids','subtasks','subtask_bids','task_events','settlements','payment_intents'
   )
 ORDER BY tablename;

-- 6. payment_intents CHECK constraint is the new enum
--    Expect exactly: CHECK ((status = ANY (ARRAY['pending'::text, 'signed'::text, 'settled'::text, 'failed'::text])))
SELECT pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid = 'payment_intents'::regclass
   AND conname  = 'payment_intents_status_check';

-- 7. No surviving 'completed' status rows on payment_intents
--    Expect zero rows.
SELECT COUNT(*) AS legacy_completed_rows
  FROM payment_intents
 WHERE status = 'completed';

-- 8. Data preservation check
--    Both counts MUST match the preflight snapshot. Any drift means
--    the migration (or a concurrent writer) touched data unexpectedly.
SELECT COUNT(*) AS task_count    FROM tasks;
SELECT COUNT(*) AS payment_count FROM payment_intents;

-- 9. pipeline_steps dormant comment
--    Expect: 'DORMANT (superseded by task_events in Phase B)...'
SELECT obj_description('pipeline_steps'::regclass, 'pg_class') AS comment_text;

-- 10. settlements.gas_cost no longer carries a stale default
--     Expect: column_default IS NULL (the 0.0006 default was dropped).
SELECT column_name, column_default, is_nullable, data_type
  FROM information_schema.columns
 WHERE table_name = 'settlements' AND column_name = 'gas_cost';
-- Expected: column_default = NULL (or empty), data_type = numeric.
