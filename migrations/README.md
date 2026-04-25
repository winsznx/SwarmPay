# Phase B — Supabase migration 001

## Overview

This migration extends the SwarmPay schema to persist entities that
currently live only in the per-process in-memory store: formal
`bids.is_winner`, a proper `subtasks` table with `subtask_bids`, a
`task_events` audit ledger, a structured `settlements` table, and
additive columns on `tasks` and `agents`. It also reconciles legacy
`payment_intents.status = 'completed'` rows to the new enum
(`pending | signed | settled | failed`) and locks the enum with a
`CHECK` constraint. The same migration seeds the six canonical agents
from `src/lib/store/index.ts`.

Every statement is idempotent and wrapped in a single
`BEGIN; ... COMMIT;` block — if any operation fails, nothing changes.

---

## Safety checklist

Before applying, confirm each of the following:

- [ ] Supabase project owner has been informed and is reachable during the window
- [ ] Schema snapshot taken — screenshot or SQL export of `tasks` and `payment_intents` column + constraint definitions
- [ ] `preflight_queries.sql` run and output saved locally (alongside this README, or in a dated file)
- [ ] Env vars available and verified — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Vercel deploy is paused or in a known-good state (so the enum tightening cannot collide with a half-deployed writer)

---

## Apply steps

### Step 0 — deploy code before touching schema (hard requirement)

The forward migration adds
`CHECK (status IN ('pending','signed','settled','failed'))` on
`payment_intents`. Legacy code writes `status = 'completed'`, which
would start failing the CHECK the moment the migration lands. The code
fix in `src/lib/supabase.ts:46` (`'completed'` → `'settled'`) ships in
the same commit as these migration files.

1. Merge the current branch to `main`
2. Wait for Vercel to deploy and go green
3. Hit `/api/stats` and a task-creation flow on the live URL to confirm the new code path is serving traffic
4. Only then proceed to Step 1

Skipping Step 0 will cause new `payment_intents` inserts to fail with a
CHECK violation for the duration of the mismatch.

### Step 1 — preflight

1. Open the Supabase SQL Editor for the live project
2. Paste and run `preflight_queries.sql`
3. **Save the output locally.** It is the reference for the postflight
   data-preservation checks and — should anything go wrong — the
   authoritative snapshot of pre-migration state
4. Confirm from the output that:
   - Row counts on `tasks` and `payment_intents` match what you expect from production
   - `payment_intents` has no pre-existing CHECK named `payment_intents_status_check`
   - `bids`, `agents` do NOT yet have `is_winner` / `capabilities` / `avg_response_time_ms` columns

### Step 2 — apply

1. In the same SQL Editor, paste `001_phase_b_schema.sql` in its entirety
2. Run it
3. Verify the editor reports success (one `COMMIT` line, no red ERROR banners)
4. If you see any error, the entire `BEGIN/COMMIT` transaction rolls back. Investigate, do not re-run blindly

### Step 3 — postflight verification

1. Paste and run `postflight_queries.sql`
2. Cross-check every block against its expected result in the file comments:
   - 6 tables exist
   - 6 agent rows seeded (matches `src/lib/store/index.ts:4-11` exactly)
   - `bids.is_winner`, `agents.capabilities`, `agents.avg_response_time_ms` present
   - Four new `tasks.*` columns present
   - RLS enabled on all six tables
   - `payment_intents_status_check` CHECK is `('pending','signed','settled','failed')`
   - Zero rows with `status = 'completed'`
   - `tasks` and `payment_intents` counts match preflight
3. Any mismatch → consider rollback

### Step 4 — commit

Once postflight is clean:

```
git add migrations/
git commit -m "chore(db): Phase B schema extension — applied $(date -u +%Y-%m-%dT%H:%MZ)"
git push
```

---

## Rollback

Use `001_phase_b_rollback.sql` when:

- Postflight returned unexpected results
- A downstream consumer started erroring immediately after apply
- The app went into a degraded state attributable to the schema change

The rollback:

- **Drops** the new tables (`task_events`, `subtask_bids`, `subtasks`, `settlements`) with `CASCADE`
- **Removes** added columns on `bids`, `agents`, `tasks`
- **Removes** the `payment_intents_status_check` CHECK — the table reverts to its pre-migration constraint shape (which had none)
- **Does NOT** re-run the status string rewrite — rows migrated from `'completed'` → `'settled'` stay as `'settled'` because we cannot reliably distinguish them from rows legitimately inserted as `'settled'` post-migration
- **Does NOT** delete seeded agents — deleting them could CASCADE into real task/bid/payment rows. Manual SQL is in step 6 of the rollback file if you truly want them gone
- **Resets** the dormant `pipeline_steps` comment

After rollback, the app is back to the pre-B.1 schema shape. You will
need to revert the `src/lib/supabase.ts:46` code change as well, or
disable Supabase writes (`unset NEXT_PUBLIC_SUPABASE_URL`) until the
schema is re-migrated — otherwise payment writes keep emitting
`status = 'settled'` into the un-constrained column, which is valid but
diverges from legacy.

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Step 0 skipped — payment CHECK fails in prod | Low (procedural) | High — every new payment write errors | Step 0 is flagged as a hard requirement in three places in this README. Verify via `/api/tasks` POST before applying |
| `ADD COLUMN` locks on a hot table | Low (Postgres does it metadata-only for nullable cols) | Low — brief acquire of AccessExclusiveLock | All `ADD COLUMN` statements add nullable / defaulted columns, which skip the table rewrite on modern Postgres |
| Concurrent writer inserts `'completed'` mid-migration | Very low (single Vercel writer; Step 0 ensures code is already switched) | High — row would violate new CHECK | BEGIN/COMMIT atomicity protects within-migration. Step 0 protects before |
| Seed collides with a pre-existing agent row | Low (no code writes to `agents` today) | None — `ON CONFLICT (id) DO NOTHING` | Idempotent by design |
| Realtime publication table-add fails (already member) | Expected on re-run | None | Each `ALTER PUBLICATION` is wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` |
| Rollback DROPs a table that a future subtasks-writer code path now depends on | Medium if rolled back after B.2 lands | High — code would break | Do not rollback B.1 after B.2 code ships without also reverting B.2 code |
| Supabase instance I/O limits during migration | Low on a small prod instance | Medium — apply hangs | Migration touches small tables only; no `UPDATE` larger than the legacy `completed` count |

---

## What this migration does NOT do

- **No data backfill.** Legacy subtasks still ride inside `tasks` via
  `parent_task_id`. New `subtasks` starts empty. Phase B.2 owns the
  copy-and-cutover.
- **No Circle wallet address population.** Agent seed inserts with
  `wallet_address = NULL`. Phase D owns that via
  `scripts/sync-agent-wallets.ts`.
- **No pipeline_steps deletion.** Left in place, labelled dormant via
  `COMMENT ON TABLE`. Phase C candidate for removal.
- **No tightening of RLS.** Demo-permissive policies match current
  project convention. Real auth lands in Phase C.

---

## File index

- `001_phase_b_schema.sql` — forward migration (idempotent, transactional)
- `001_phase_b_rollback.sql` — reverse migration (best-effort; see comments for what it cannot undo)
- `preflight_queries.sql` — snapshot queries. Save output locally.
- `postflight_queries.sql` — verification queries. Run immediately after apply.
- `README.md` — this file.
