## Production sprint — full scope

Closes the audit and the Production Sprint v2 plan. Every UI claim in the app is now backed by code that does the thing — no fabricated constants, no silently-swallowed errors, no copy that promises behavior the implementation doesn't deliver.

## ⚠️ APPLY ORDER (read first)

This PR ships **7 numbered migrations** + code that depends on them. Apply migrations BEFORE merging.

1. Open Supabase SQL Editor for the swarm-pay project.
2. Run migrations in order: `001 → 002 → 003 → 004 → 005 → 006 → 007`.
3. Each is `BEGIN/COMMIT` wrapped — if any fails, it rolls back; investigate before retrying.
4. Run `migrations/postflight_queries.sql` after `001`. After each subsequent migration, the spot-checks in `migrations/APPLY_RUNBOOK.md` Section 4 cover the new columns/RPCs.
5. Once all 7 are applied + verified, merge this PR.
6. Vercel will redeploy automatically.

Full apply runbook: [`migrations/APPLY_RUNBOOK.md`](migrations/APPLY_RUNBOOK.md) — self-contained, no sprint context needed.

## What ships

### Real settlement infrastructure
- **No more 25s `Promise.race` cap.** [`src/lib/settlementQueue.ts`](src/lib/settlementQueue.ts) drains per-wallet serially with `CIRCLE_PER_WALLET_DELAY_MS` (default 250ms) inter-call delay. 429 handling: exp backoff 1s → 2s → 4s, max 3 retries; non-429: 1 retry; then the intent is recorded as `failed` with `error_message` and `retry_count` populated — never silently swallowed.
- **Renamed** `batchSettleOnArc` → `settleAllIntentsOnArc`. Returns `{ enqueued }` immediately; the queue drains in the background; UI subscribes via Supabase Realtime and watches dots light up green as confirmations land.
- **Atomic Postgres RPCs** for hot-path increments: `settlement_record_confirmed`, `settlement_record_failed`. No read-modify-write races on parallel confirmations.

### Real gas measurement
- [`src/lib/gasMeasurement.ts`](src/lib/gasMeasurement.ts) calls `eth_getTransactionReceipt` against `ARC_RPC_URL` for every confirmed intent. BigInt-safe math (USDC has 6 decimals on Arc, so `gas_cost_usdc = gasUsed × effectiveGasPrice / 10^6`).
- DB trigger `trg_settlement_recompute_gas` rolls per-intent costs up into `settlements.total_gas_cost` after each measurement lands.
- **Killed every hardcoded gas constant.** No more `0.0006` fallback in SettlementAnimation, no more `0.00045` constant in arcSettlement, no `0.0006` DEFAULT on `settlements.gas_cost` (dropped via 001 Section 12).
- UI gas displays show "Measuring…" while measurement is computing — never a fake number.

### Real x402 protocol
- [`src/lib/x402.ts`](src/lib/x402.ts) implements the full 5-step handshake: `generate402Response` → `signPaymentIntent` (Circle `signMessage` over canonical intent JSON) → `verifyPaymentIntent` (signer-address match against the agent's known wallet + recompute the canonical hash to prevent post-sign tampering) → `submitForSettlement` (hands to the queue).
- `executeX402Handshake` orchestrates and emits `payment:402`, `payment:signed`, `payment:settled`, `payment:failed` events to both the live event bus and `task_events` audit table.
- Wired into `runSubTaskExecution` — every sub-agent capability invocation goes through the handshake. PaymentStream renders real triplets grouped by `paymentIntentId`.

### Real reputation
- [`src/lib/reputation.ts`](src/lib/reputation.ts) calls atomic RPC `reputation_apply_delta` (single Postgres function: read current → clamp [0,100] → audit row → agents update → success_rate recompute).
- `+1` subtask success / `-2` subtask failure / `+3` orchestrator success / `-5` orchestrator failure.
- Wired into pipeline phase 8 — every participating agent gets a delta when settlement is enqueued.
- [`src/lib/scoring.ts`](src/lib/scoring.ts): `score = (1/price) × (reputation/100) × confidence × (1/estimatedTimeMs)`. Returns `-Infinity` instead of throwing on degenerate inputs.
- `/agents` leaderboard sorts by `total_earned`, shows success rate, has the `agents[0]?.reputation` guard.
- Sidebar `AgentManager` subscribes to `reputation_events` via Realtime — animated `+N`/`-N` popup on the changing agent's card.

### Real escrow
- 3 API routes calling atomic RPCs: [`/api/escrow/hold`](src/app/api/escrow/hold/route.ts), [`/api/escrow/spend`](src/app/api/escrow/spend/route.ts), [`/api/escrow/release`](src/app/api/escrow/release/route.ts).
- BudgetModal wired to **primary** TaskInput path (was bypassed; only follow-ups used to hit it).
- Header wallet balance reads from `user_wallets` via Realtime — drops live on `escrow_hold`, increments live on `escrow_release`.
- Edge cases handled: insufficient balance returns 402 to the modal; task creation failure releases the hold automatically.

### Real compute meter
- [`src/components/ComputeMeter.tsx`](src/components/ComputeMeter.tsx) subscribes to SSE `compute:tick` / `compute:completed`, interpolates the ms timer + cost ticker at 60fps via `requestAnimationFrame` between server ticks.
- Pipeline emits real ticks every 500ms during the compute sub-task (`runComputeSession` in [`src/lib/pipeline.ts`](src/lib/pipeline.ts)) and persists the session to `compute_sessions` with `cpu_samples` JSONB.

### Honest copy
- All "1 batch / 1 tx / single Arc transaction / single settlement / compress into atomic" claims **purged** across: `SettlementProof`, `SettlementAnimation`, `MarginProofCard`, `ExplainerAnimation`, landing `/`, `/why`, `/security`, `/marketplace`, `README.md`. Replaced with honest per-intent framing grounded in measured numbers.
- The "Why Arc?" thesis is **stronger**: Arc's per-tx gas is so low we *don't need* batching — every payment intent lands as its own real on-chain USDC transfer, fully visible on `testnet.arcscan.app`.

### Submission deliverables
- [`public/cover.svg`](public/cover.svg) — 1280×720 cover image (SVG; the lablab form may want PNG — render via any browser screenshot or `rsvg-convert`)
- [`docs/SUBMISSION.md`](docs/SUBMISSION.md) — every lablab text field
- [`docs/CIRCLE_FEEDBACK.md`](docs/CIRCLE_FEEDBACK.md) — $500 USDC bonus piece, every claim grounded in shipped code
- [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) — 90s voiceover with on-screen cues per beat

### Other audit closes
- `SwarmBackground` — rAF id stored, cancelled on unmount, paused on `document.visibilityState === 'hidden'`
- `ExecutionGraph` — stops polling `/tree` when root task hits a terminal state
- `execution.ts` — Lagos `+3600000` hack replaced with `Intl.DateTimeFormat`
- `ResultCard` — strips markdown code fences before `JSON.parse` on Gemini output
- [`/api/health`](src/app/api/health/route.ts) — checks Supabase + Circle + Arc RPC; Header status badge polls every 30s and renders red `Subsystem Down` on failure

## What does NOT ship in this PR

The following items from the audit are **honestly deferred** to a follow-up Phase C polish PR. They aren't blockers; the data plane is honest. Keeping them out of this PR keeps the diff reviewable and the deploy lower-risk.

- Full `any` type purge across `src/types/index.ts` + `src/lib/pipeline.ts` (substantial refactor, would risk regressions during a high-stakes deploy)
- Exhaustive mobile pass — basic responsiveness in place; full audit (DAG fallback, sidebar collapse breakpoints, PaymentStream typography) is its own session
- Comprehensive loading-skeleton coverage — basic skeletons in place; full suite is polish
- Standalone agent profile page (`/agents/[id]`) with full reputation history timeline — leaderboard already shows aggregate, RPC + audit table are in place; the dedicated page is a small follow-up
- Network disconnect / reconnect banner — partially covered by the new `/api/health` polling, dedicated banner is polish

## Audit trail

Every section's commits + decisions logged continuously in [`BUILD_LOG.md`](BUILD_LOG.md) under the `SPRINT — Production sprint` heading.

## Local verification

- `tsc --noEmit` → exit 0
- `next build` → exit 0, 21 routes

## Coupled-deploy reminder

The `payment_intents.status` CHECK in 001 requires the `'settled'` code in `src/lib/supabase.ts:47` to be live before apply. That code shipped in commit `626d615` (currently on `main` via PR #1 merge), so Step 0 is already satisfied.
