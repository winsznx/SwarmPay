# Production migration runbook

Self-contained instructions. You don't need any prior context — read this top to bottom and run.

## What you're applying

7 numbered SQL migrations against the production Supabase project for SwarmPay. Each migration:

- Is wrapped in `BEGIN; ... COMMIT;` — if any statement fails, the whole file rolls back, no partial state.
- Is idempotent — re-runnable without error (uses `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`, and `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` for publication membership).
- Has a matching `_rollback.sql` you can run if something goes wrong post-apply.

## Hard requirement before you start

Vercel deploys this PR's branch (or `main` after merge) **before** you apply migrations. The new code expects the new tables. If you apply migrations against the live `main` without the new code deployed, nothing breaks (writers are wrapped in `try/catch` that silently no-ops on missing tables) — but the new features won't be observable until the deploy lands. The reverse — code deployed without migration — does break: payment writes fail the new `payment_intents_status_check` because some legacy rows say `'completed'` until 001 normalizes them.

Recommended order: **deploy first, then migrate**.

## Order

Apply in this exact order. Each is its own SQL Editor run.

| # | File | What it does | Reversible via |
|---|---|---|---|
| 1 | `001_phase_b_schema.sql` | Phase B core: subtasks, subtask_bids, task_events, settlements, agent + bid + task column additions, payment_intents.status enum lock, agent seed, drops settlements.gas_cost default | `001_phase_b_rollback.sql` |
| 2 | `002_settlement_progress.sql` | Settlement queue progress columns (expected/confirmed/failed counts, all_hashes), expanded settlements.status enum, payment_intents.error_message + retry_count, atomic RPC helpers | `002_settlement_progress_rollback.sql` |
| 3 | `003_event_types.sql` | task_events.event_type CHECK with the full enum used by x402, reputation, compute meter, settlement queue | `003_event_types_rollback.sql` |
| 4 | `004_gas_measurement.sql` | payment_intents gas columns (gas_used, gas_price, gas_cost_usdc, block_number), settlements.total_gas_cost, trigger that recomputes the per-task sum | `004_gas_measurement_rollback.sql` |
| 5 | `005_reputation.sql` | agents.tasks_failed + success_rate, reputation_events audit table, atomic `reputation_apply_delta` RPC | `005_reputation_rollback.sql` |
| 6 | `006_escrow.sql` | user_wallets + escrow_holds tables, atomic `escrow_hold` / `escrow_spend` / `escrow_release` RPCs, seed `user_1` with 50 USDC | `006_escrow_rollback.sql` |
| 7 | `007_compute_sessions.sql` | compute_sessions table for per-ms billing audit | `007_compute_sessions_rollback.sql` |

## Step-by-step

### 0. Snapshot first
1. Open Supabase SQL Editor for the swarm-pay project.
2. Paste the contents of `preflight_queries.sql`.
3. Run. **Save the output to a local file** named `preflight_<DATE>.txt`. This is your reference snapshot.

### 1. Apply 001
1. Paste contents of `001_phase_b_schema.sql`.
2. Run.
3. Watch for the green success banner. If you see `RAISE NOTICE 'Migrated legacy completed status to settled'`, that's expected — existing rows were normalized.
4. If anything errors: the `BEGIN/COMMIT` rolls back automatically. Do NOT re-paste blindly. Read the error, decide whether to investigate or run `001_phase_b_rollback.sql`.

### 2. Apply 002 → 007
Repeat the same paste-and-run pattern for each file in numerical order. Each one is small (~50 lines) and idempotent.

### 3. Postflight
1. Paste contents of `postflight_queries.sql`.
2. Run.
3. Cross-check every block against the inline expected results in the file. The blocks that matter most:
   - Block 1: 6 tables exist (`agents, bids, settlements, subtask_bids, subtasks, task_events`).
   - Block 2: 6 agent rows seeded with the exact name/role/reputation/balance/capabilities from `src/lib/store/index.ts:4-11`.
   - Block 6: `payment_intents_status_check` is `(status = ANY (ARRAY['pending','signed','settled','failed']))`.
   - Block 7: zero rows with `status = 'completed'`.
   - Block 8: `tasks` and `payment_intents` row counts match preflight.
   - Block 10: `settlements.gas_cost` has `column_default = NULL`.

### 4. Verify the new tables (post-002 and beyond)

Quick spot-checks you can paste into the SQL Editor:

```sql
-- 002 progress columns landed
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'settlements' AND column_name IN
   ('expected_count','confirmed_count','failed_count','started_at','completed_at','all_hashes');
-- expect 6 rows

-- 002 settlements status enum expanded
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'settlements'::regclass AND conname = 'settlements_status_check';
-- expect: CHECK (status = ANY (ARRAY['pending','in_progress','complete','partial','failed']))

-- 003 event_type CHECK active
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'task_events'::regclass AND conname = 'task_events_event_type_check';

-- 004 gas columns + trigger
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'payment_intents'
   AND column_name IN ('gas_used','gas_price','gas_cost_usdc','block_number');
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_settlement_recompute_gas';

-- 005 reputation
SELECT proname FROM pg_proc WHERE proname = 'reputation_apply_delta';

-- 006 escrow
SELECT user_id, balance FROM user_wallets WHERE user_id = 'user_1';
SELECT proname FROM pg_proc WHERE proname IN ('escrow_hold','escrow_spend','escrow_release');

-- 007 compute_sessions
SELECT table_name FROM information_schema.tables WHERE table_name = 'compute_sessions';
```

### 5. Realtime publication sanity
```sql
SELECT pubname, tablename FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
 ORDER BY tablename;
```
Expect tables for: `bids, compute_sessions, escrow_holds, payment_intents, reputation_events, settlements, subtask_bids, subtasks, task_events, user_wallets`.

## Rollback

If any postflight check fails or a downstream consumer starts erroring after a particular migration, run the matching `_rollback.sql` for the latest applied migration first, then work backwards.

You generally **do not** want to rollback past 001 once tasks have been completed under the new schema — the seeded agents will be referenced by FKs in tasks/bids/payment_intents. The rollback files explicitly do NOT delete the agent seed for this reason.

`002_settlement_progress_rollback.sql` resets the `settlements.status` CHECK back to the original `('pending','broadcast','confirmed','failed')`. Any rows currently in `'in_progress'` / `'complete'` / `'partial'` will violate the old CHECK. Either fix those rows manually first or rollback 002 only when settlements is empty.

## After all 7 are applied + verified

1. The PR is safe to merge.
2. Vercel will redeploy automatically.
3. New tasks will write through the full Phase B stack: subtasks/subtask_bids in their own tables, x402 events into task_events, reputation deltas into reputation_events, escrow lifecycle into user_wallets/escrow_holds, compute sessions into compute_sessions, and gas measurements landing on payment_intents and rolling up into settlements.total_gas_cost.

## Known migration-touches-shared-table notes

- 002 and 004 both ALTER `settlements`. 002 must run before 004 (004 references columns 002 didn't add but the migration sequence assumes 002 has landed). Apply in numerical order.
- 005 uses `agents.reputation` which is created in 001's existing schema. 001 must run before 005.
- 006 inserts `user_1` into `user_wallets` — this is the single demo user the dashboard uses today. If you have multi-user in the future, seed more rows then.
