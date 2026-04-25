# SwarmPay Polish Sprint — Build Log

## A.1 — Three P0 narrative bugs
2026-04-24 · Phase A

### Files changed
1. src/components/PaymentStream.tsx — L32-38, L91-94 — filter + display now read `p.fromAgent`/`p.toAgent` (the fields the hook actually populates)
2. src/components/ResultCard.tsx — "Data cleaning" row reads `cb.cleaning`; "Compute" row reads `cb.compute` (dropped spurious `*0.6`)
3. src/components/SettlementAnimation.tsx — added `task?: Task` prop; batching label reads `task.settlement?.intentsSettled ?? task.micropaymentCount ?? task.stats?.micropayments ?? 0`; settled stage renders truncated real hash and real intent count; gas falls back to `0.0006`
4. src/components/TaskList.tsx:405 — pass `task={task}` to `<SettlementAnimation>`

### What & Why
Three P0 narrative bugs from audit (#1, #2, #3). Payment stream was rendering "Agent → Node" for every row (#1), cost breakdown rows double-used `cb.compute` and hid `cb.cleaning` so totals didn't sum (#2), and SettlementAnimation hardcoded a fake `0x8f2d...4e1a` hash with "63 intents" regardless of actual task data (#3). All three broke the demo's emotional climax for any attentive judge.

### How
Pure field-mapping fixes — no backend changes. PaymentStream and ResultCard were straight renames to match the data the existing hook/state already produces. SettlementAnimation got a `task` prop threaded from TaskList with sensible fallback chain for the intent count (settlement → micropaymentCount → stats). Deliberately did not change what the hook emits; the hook was already correct, only the consumers were wrong.

### Tests
- Typecheck (tsc --noEmit): 0 errors
- Live task run: 56 payments, every record has real agent names, zero "Agent/Node" placeholders
- Cost breakdown: 6 rows sum to $0.241842, equal to cb.totalCost (delta 0.0000000000)
- Settlement animation: renders `0x8b61...arc1` truncated + intentsSettled=56 + gas $0.0006

### Notes / Follow-ups
Hash still ends in `arc1` — mock mode (no Circle keys set locally). Phase D will replace with real on-chain tx. Flagged not blocking.

---

## A.2 — Cross-file consistency
2026-04-24 · Phase A

### Files changed
1. src/lib/arcSettlement.ts:49 — mock settlement explorer URL → `https://testnet.arcscan.app/tx/...`
2. src/lib/circleWallets.ts:128 — real settlement explorer URL → `https://testnet.arcscan.app/tx/...`
3. src/app/security/page.tsx:93 — audit-trail explorer link → `https://testnet.arcscan.app/tx/...`
4. scripts/get-latest-tx.ts:40 — verified-on-arc console log → `https://testnet.arcscan.app/tx/...`
5. src/lib/supabase.ts:112-149 — `getGlobalStats()` now returns `{completedTasks, totalUsdcMoved, totalMicropayments, avgGas}`, parallelised tasks query with a `payment_intents` count(exact) call
6. src/app/api/stats/route.ts — response shape is `{completedTasks, totalMicropayments, totalAgents, totalUsdcMoved, avgGas}` with an in-memory fallback so local dev still shows real numbers
7. src/app/page.tsx:22-28, 100-116 — `Stats` interface and GSAP counter read the new keys directly (no hardcoded fallbacks)
8. src/app/marketplace/page.tsx:60-66, 106-111 — useState seed + rendered stat row aligned to the new keys
9. src/app/agents/page.tsx:143-144 — "0% Platform Cut" → "10% Platform Fee"
10. src/components/TaskList.tsx:182-225 — Protocol Safeguard Rejection block hoisted out of the rationale conditional; now renders on any `task.status === 'failed'` regardless of complexity/rationale state
11. src/lib/execution.ts:337 — Gemini model id `gemini-flash-latest` → `gemini-2.0-flash-exp`

### What & Why
Second pass on surface-level inconsistencies a careful judge would catch. Covers audit items #4 (stats key mismatch → hardcoded counter defaults), #13 (three different explorer hostnames across code/README/security page), #14 ("0% Platform Cut" contradicting 10% platform fee everywhere else), #25 (floating `latest` Gemini alias), and #27 (Protocol Safeguard Rejection never rendering when `complexity` was absent because it was nested inside the rationale conditional). Each one individually is small; together they turned an otherwise polished demo into "wait, which chain is this on? which number is real?" for anyone reading the UI carefully.

### How
Explorer URL cleanup started with `grep -rn "explorer" ...` to enumerate every call site, then swapped the three broken hostnames to `testnet.arcscan.app` in four files and verified with follow-up greps for `explorer.arc.io` and `arc-testnet.explorer.io` (both return zero source hits). For stats, `/api/stats` now emits the target shape `{completedTasks, totalMicropayments, totalAgents, totalUsdcMoved, avgGas}`; I paralleled the Supabase tasks query with a `count: 'exact', head: true` on `payment_intents` instead of fetching rows. Because local dev typically runs without Supabase, I layered an in-memory fallback via `store.getAllPayments()` / `store.getTasks()` so landing counters animate to real numbers even without the DB. The failure-block hoist was a simple JSX extraction — moved the red ShieldAlert panel to a top-level sibling of the rationale block with its own `task.status === 'failed'` guard, eliminating the bug where it only rendered when `complexity` also existed. Gemini id was a one-line URL string swap.

### Tests
- Grep `explorer.arc.io` across src/scripts/README: 0 hits
- Grep `arc-testnet.explorer.io` across src/scripts/README: 0 hits (the one match in `.claude/settings.local.json` is a harness allow-list record of an earlier grep command, not source)
- Canonical `testnet.arcscan.app` present in 4 code sites + README
- Typecheck (tsc --noEmit): 0 errors
- `/api/stats` response keys: `['avgGas', 'completedTasks', 'totalAgents', 'totalMicropayments', 'totalUsdcMoved']` — exact match with landing Stats interface
- Live task run: `/api/stats` returns `completedTasks=1, totalMicropayments=103, totalAgents=6, totalUsdcMoved=0.0053` (no hardcoded defaults)
- Live settlement: `explorerUrl=https://testnet.arcscan.app/tx/0xbc70d1fe...arc1` — canonical, clicking opens arcscan
- `/agents` source re-read: label now reads "10% Platform Fee"
- TaskList JSX re-read: Protocol Safeguard block is a top-level sibling with `{task.status === 'failed' && ...}` as its sole gate

### Notes / Follow-ups
- Hash still ends in `arc1` (mock mode). Same flag as A.1 — Phase D (real Circle keys + real on-chain settlement) will resolve. Not a regression from this sprint.
- Gemini model id change is verified statically (typecheck + code read); no live Gemini hit was possible because this repo has no committed `.env.local`. First task run with a real `GEMINI_API_KEY` is the runtime proof.
- Triggering a genuine failure path to visually confirm the hoisted Protocol Safeguard block requires an edge case (e.g. an empty analysis result). Behavior verified by structural inspection; a scripted failure test is a Phase B candidate if we want a regression guard.
- Marketplace page was also consuming the old stats keys (`activeAgents`, `totalSettled`) — fixed in the same pass even though it wasn't in the explicit scope, because the shape change would have silently broken it otherwise.

---

## A.3 — Repo hygiene
2026-04-24 · Phase A

### Files changed
- deleted: server.log, server_new.log — 443 KB of committed runtime logs
- deleted: src/app/api/tasks/[id]/execute/route.ts — dead manual-execute route, no consumers
- deleted: src/app/api/tasks/[id]/decompose/route.ts — dead manual-decompose route
- deleted: src/app/api/tasks/[id]/select/route.ts — dead manual-select-winner route
- deleted: src/app/api/subtasks/[id]/bid/route.ts — dead manual sub-bid route
- deleted: src/app/api/subtasks/ — empty parent dir cleaned up after the above
- deleted: src/components/BidForm.tsx — unused (only self-references)
- deleted: scratch/test_gemini.ts + scratch/ dir — uncommitted smoke-test remnant
- modified: .gitignore — added `*.log`, `deployments/*.json`, `!deployments/README.md`
- created: .env.example — 22 entries grouped by Supabase / Circle / Intelligence / Arc / Platform / Dev
- modified: package.json:6 — `dev` script now `PORT=3001 next dev -p 3001` (was Windows `set PORT=3001 && ts-node ...`)

### What & Why
Before Phase B's refactor touches the same surface, the repo needed to stop looking like a half-committed workspace. Covers audit items #19 (440 KB of server logs checked in — unprofessional and churns diffs), #20 (`dev` script used Windows `set` syntax, broke cleanly on darwin/linux), and the "over-engineered for a hackathon" finding in the audit's architecture red flags (four dead API routes duplicating the autonomous pipeline + an unused BidForm component). Also creates `.env.example` so a judge or new contributor can `cp .env.example .env.local` and know what to fill in — missing that was flagged as a Step 7 walkthrough blocker.

### How
Every deletion went through a grep pre-check first to catch hidden consumers. For the dead routes I ran `grep -rn -E "/execute|/decompose|/select|subtasks/[^/]+/bid" src/` which surfaced one hit — an HTML `<select>` tag inside BidForm.tsx, a false positive. A second broader grep for string-literal route paths returned zero, confirming no fetch call sites. BidForm itself grepped clean (only self-references in the file being deleted). For scratch/test_gemini.ts, greps across src/, scripts/, package.json, next.config.ts, and server.ts returned zero references. `.env.example` was built by `grep -rohE "process\.env\.[A-Z_][A-Z0-9_]*"` across src/, scripts/, scratch/, server.ts, next.config.ts → 15 unique vars + NODE_ENV (excluded, Next-managed). Added 7 forward-looking PRD vars (SUPABASE_SERVICE_ROLE_KEY, CIRCLE_WALLET_SET_ID, ARC_*, PLATFORM_FEE_PERCENT, COMPUTE_COST_PER_MS) from the explicit required-minimum list, flagged in-file as "forward-looking: not yet consumed". Dev script fix dropped the custom server.ts wrapper because it wasn't adding anything (no WebSocket listener, just wrapping Next) — `start` still uses server.ts so the file itself stays valid. Had to `rm -rf .next` after deleting routes because Next's generated validator.ts held stale references to the four removed routes.

### Tests
- `ls server*.log` → no matches
- `.gitignore` now contains `*.log`, `.env*`, `/node_modules`, `/.next/`, `deployments/*.json`, `!deployments/README.md`
- Every `process.env.X` reference in source has a matching entry in `.env.example` — 15/15 grep hits covered, 22 total entries (7 forward-looking PRD vars flagged in comments)
- Dead routes deleted AND return 404 at runtime: `POST /api/tasks/foo/execute|decompose|select` and `/api/subtasks/foo/bid` all → 404
- `git status` shows the 7 deletions staged
- `npm run dev` banner: clean Next 16.2.4 Turbopack start, "Ready in 305ms", no PATH/set warnings, binds 3001
- `tsc --noEmit` (after `rm -rf .next` to clear stale validator types): 0 errors
- `next build`: exit 0, 17 routes listed (was 21 before dead-route cleanup), no new warnings

### Notes / Follow-ups
- The first `tsc --noEmit` after deleting routes reported 4 errors in `.next/dev/types/validator.ts` — Next caches per-route validator stubs there and `tsconfig.json` includes `.next/dev/types/**/*.ts`. `rm -rf .next` fixes it; CI will regenerate on first build anyway. Flagging so the next person who deletes routes remembers.
- `server.ts` remains referenced by the `start` script. Not a dead file today. If Phase B also drops the custom server for `next start`, delete server.ts + tsconfig.server.json in the same pass.
- The audit's architecture red flag #1 ("custom server.ts that wraps Next with nothing added") is still partially true for `start`. Left as-is since it wasn't in scope.
- 7 forward-looking env vars in `.env.example` (ARC_RPC_URL, ARC_CHAIN_ID, ARC_EXPLORER_URL, PLATFORM_FEE_PERCENT, COMPUTE_COST_PER_MS, SUPABASE_SERVICE_ROLE_KEY, CIRCLE_WALLET_SET_ID) are not yet consumed in code; comments in the file label them as Phase D / Phase B candidates. Including them now means no doc drift when they do get wired.
- The `scratch/` directory was never tracked in git (scratch/test_gemini.ts only existed in the working tree). `git rm` flagged this as expected; rm removed the file from disk.
- Metadata warning during `next build` about `metadataBase` is pre-existing from `src/app/layout.tsx` and unrelated to this sprint. Deferring.
- Caught during post-run verification: `.env*` in .gitignore silently swallowed the freshly-created `.env.example` (the whole point is that it's committed). Added `!.env.example` negation pattern immediately after the `.env*` line. `git check-ignore .env.example` → exit 1 (not ignored); `git add -n` accepts it. Flagging so the convention is consistent if anyone adds more env file variants later.

---

## B.1 — Supabase schema extension (migration authored, not applied)
2026-04-24 · Phase B

### Files changed
- created: migrations/001_phase_b_schema.sql (forward migration, idempotent, transactional)
- created: migrations/001_phase_b_rollback.sql (reverse migration, preserves pre-B.1 data)
- created: migrations/preflight_queries.sql (pre-apply snapshot, save output locally)
- created: migrations/postflight_queries.sql (post-apply verification incl. agent seed check)
- created: migrations/README.md (overview, safety checklist, apply/rollback steps, risk matrix)
- modified: src/lib/supabase.ts:47 — `savePaymentToSupabase` now writes `status: 'settled'` instead of `'completed'` (coupled with the migration's new CHECK enum)
- confirmed unchanged: supabase_master_setup.sql (git diff stat returns empty)

### What & Why
Persistence has to leave the in-memory store for Phase B to mean anything. The store resets on every Vercel cold boot, so task history, bids, and payment trails currently live only on the single Next process that created them. This migration formalizes the Phase B entity set: `subtasks` and `subtask_bids` as first-class tables (today subtasks ride inside `tasks` via `parent_task_id`), `task_events` as the pipeline's event-sourcing ledger (supersedes `pipeline_steps`, which is marked dormant via `COMMENT ON TABLE`), a structured `settlements` table, and additive columns on `bids` (`is_winner`), `agents` (`capabilities`, `avg_response_time_ms`), and `tasks` (`complexity`, `orchestrator_rationale`, `agent_count`, `winning_agent_name`) so UI-surfaced values are no longer trapped inside JSONB or in-memory state. It also reconciles legacy `payment_intents.status = 'completed'` rows to the new `('pending','signed','settled','failed')` enum locked by a CHECK. Nothing is applied — the migration ships as files only, the owner will apply tonight once env vars are available and a schema snapshot is taken.

### Pre-check findings
Existing schema has 7 tables (agents, tasks, bids, pipeline_steps, wallet_transactions, payment_intents, global_config). Only `tasks` and `payment_intents` receive live writes from `src/lib/supabase.ts` — the other five are schema-only and functionally dormant. Agent seed in `src/lib/store/index.ts:4-11` has six rows with specific `id/name/role/reputation/balance` tuples; the migration INSERT mirrors them exactly (verified by `diff` returning exit 0). Four pre-check blockers were surfaced and resolved by owner sign-off before authoring: (1) existing `bids` lacks `is_winner` — resolved by additive `ADD COLUMN IF NOT EXISTS`, (2) existing `agents` uses `role` not `type` — kept `role`, added `capabilities` and `avg_response_time_ms` alongside, (3) `pipeline_steps` overlaps `task_events` — kept dormant with `COMMENT ON TABLE`, no deletion, (4) `payment_intents.status` drift between code (`'completed'`) and types (`'settled'`) — fixed the code in the same sprint as a coupled change. Seven additional decisions were locked on the same sign-off: `is_winner BOOLEAN DEFAULT FALSE`, `avg_response_time_ms INTEGER DEFAULT 1500`, four new `tasks.*` columns, subtasks table with no data backfill in B.1, and `wallet_address = NULL` in the seed with a `TODO(Phase D)` comment pointing to `scripts/sync-agent-wallets.ts`.

### How
Every schema operation is idempotent — `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS ... CREATE POLICY`, `ALTER PUBLICATION supabase_realtime ADD TABLE ... EXCEPTION WHEN duplicate_object THEN NULL`, and `INSERT ... ON CONFLICT (id) DO NOTHING` for the seed. The whole file is wrapped in a single `BEGIN; ... COMMIT;` so any failure rolls back cleanly and leaves the database in its pre-migration state. `payment_intents` legacy status is migrated inside a `DO $$ ... END $$` block that only UPDATEs if a row with `status = 'completed'` still exists, then the CHECK is applied. Rollback drops the four new tables (`task_events`, `subtask_bids`, `subtasks`, `settlements`) via `CASCADE`, removes the added columns, removes the new CHECK but does NOT attempt to un-rewrite `'settled'` → `'completed'` (would be destructive to rows legitimately inserted post-migration), and explicitly does NOT delete seeded agents (CASCADE could destroy live task/bid data). Preflight/postflight queries are separated so the operator can save the preflight snapshot as a state reference, then compare the postflight row counts against it. The README is the single source of truth for apply ordering — the hard Step 0 requirement ("push code first, deploy green, then apply") is called out three times because skipping it would cause `payment_intents` CHECK violations on every insert for the duration of the mismatch.

### Tests
- `git diff --stat supabase_master_setup.sql`: empty (master is untouched)
- SQL syntax: reviewed by inspection — `BEGIN/COMMIT` balanced 1/1 in each file, `DO $$ / END $$` balanced 7/7 in schema and 2/2 in rollback, `ARRAY[...]` syntax used for text arrays, `ON CONFLICT (id) DO NOTHING` on seed, every `CREATE`/`ALTER`/`DROP` guarded with `IF NOT EXISTS` / `IF EXISTS`. No psql or sqlfluff in repo, so no machine parse — flagging this.
- Agent seed vs `src/lib/store/index.ts`: diff against a hand-derived reference matrix returned exit 0 — id, name, role, reputation, balance all match exactly in all six rows.
- Migration files sanity: 5 files created in `migrations/`, total ~32 KB, all readable.
- Code edit: `tsc --noEmit` exit 0, `next build` exit 0 with 17 routes (unchanged from A.3).
- `migrations/README.md` contains the Step 0 "push code first, deploy green, then apply" instruction verbatim in three places (top safety checklist, Apply Steps Step 0, Risk matrix row 1).
- Postflight file includes the agent seed verification query (Block 2) with the full expected-result table commented inline.

### Notes / Follow-ups
- **NOT YET APPLIED.** Migration files ship as code only. To apply: follow `migrations/README.md` with the project owner aware, a schema snapshot taken, and the `src/lib/supabase.ts` code change already deployed green to Vercel.
- **Coupled deploy ordering (hard requirement).** The `payment_intents_status_check` CHECK does not include `'completed'` as a valid value. The code fix in `src/lib/supabase.ts:47` must be deployed to production before the migration lands, otherwise payment inserts will CHECK-violate until the deploy catches up. README calls this out as Step 0 and in the Risk matrix.
- **Two-model subtasks transitional state.** B.1 creates the `subtasks` table but does no data backfill — legacy subtasks continue to live inside `tasks` via `parent_task_id` until B.2 migrates them. For the duration of the transition, `store.getSubTasksForTask(taskId)` still reads from the `tasks` table and the API routes (`/api/tasks/[id]/subtasks`, `/api/tasks/[id]/tree`) continue to return child rows. The new `subtasks` table will sit empty after apply until B.2 writes to it.
- **`pipeline_steps` dormant.** Labelled via `COMMENT ON TABLE`; no new writes expected. Existing writes from `store.logPipelineStep(...)` are in-memory only today and do not touch Supabase, so nothing breaks. Phase C candidate for removal once `task_events` has settled in.
- **`wallet_address` in seed is NULL.** Phase D's `scripts/sync-agent-wallets.ts` (to be written) will populate real Circle wallet addresses once the WALLET_ID_* env vars are live. `TODO(Phase D)` comment in the seed section points to the exact script path.
- **Rollback caveat.** Rollback cannot reliably un-migrate `'settled'` → `'completed'` because rows inserted after the migration may legitimately be `'settled'`. Documented in the rollback SQL and README.
- **SQL lint.** The repo has no SQL linter configured. Consider adding `sqlfluff` in Phase C to CI-check future migrations before merge — hand inspection is the only guarantee right now.
- **RLS posture.** Phase B RLS is permissive (`FOR ALL USING (TRUE) WITH CHECK (TRUE)`) to match the project's current open-access convention. Tightening is explicitly a Phase C task.
