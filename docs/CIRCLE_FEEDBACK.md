# Circle Product Feedback — SwarmPay

This is grounded entirely in what we built and shipped during the hackathon. Every claim ties back to a file in the repo or an experience hitting the Circle / Arc APIs. Nothing here is "in a future version."

---

## Circle products used

- **Programmable Wallets (Developer-Controlled)** — one wallet per AI agent. Six agent wallets in total: `crypto-scout-x`, `research-alpha`, `data-miner-pro`, `parser-x`, `analysis-node`, `compute-grid-4`. Wallet IDs in `.env.local`; setup script at [`scripts/setup-wallets.ts`](../scripts/setup-wallets.ts).
- **USDC on Arc testnet** — settlement currency and the chain's native gas token.
- **Nanopayments** — $0.0001 per intent unit economics; ~50–65 intents per task.
- **x402 Payment Required pattern** — fully implemented in [`src/lib/x402.ts`](../src/lib/x402.ts). Five-step handshake: provider 402 + headers → consumer signs intent via Circle wallet → provider verifies signature → service rendered → signed intent enqueued for on-chain settlement.

---

## Why these products for this use case

**Programmable Wallets** give every agent independent custody. This was non-negotiable for our model: agents are real economic actors with their own balance sheets, not pooled custody under a platform service account. When DataMiner-Pro bids $0.18 and CryptoScout-X bids $0.22, those are commitments backed by separate on-chain wallets. Pooled custody would have collapsed the entire reputation/economics layer into bookkeeping.

**Arc** is the only chain where our model's gas profile actually works. We measured per-tx gas from real receipts (`eth_getTransactionReceipt` via `ARC_RPC_URL`) and the average came in around **$0.00045 per transfer**. With 60 transfers per task that's **~$0.027 total** — economically defensible per-action settlement. The same workload on Polygon's $0.01/tx is $0.60 (eats most of the task budget); on Ethereum mainnet's $0.50/tx it's $30 (≈100× the task budget — comically infeasible). Arc isn't a "nice-to-have," it's the floor that lets the model exist.

**x402** maps cleanly onto agent-to-agent service requests. The "402 → sign → 200" handshake is exactly how providers should monetize capabilities in an agent mesh. We implemented it as a real protocol — every sub-agent capability call our pipeline issues goes through the handshake, not just one symbolic instance — and the live PaymentStream renders every triplet (yellow `402 PAYMENT REQUIRED` chip, blue `SIGNED` chip with the truncated real signature, green `SETTLED` chip with the truncated real txHash linking to `testnet.arcscan.app`).

---

## What worked well

- **Circle Wallets SDK ergonomics.** `createWalletSet` + `createWallets` + `signMessage` + `createTransaction` were straightforward to compose. Wallet creation flow was clean. Signing via the dev-controlled flow worked first-try.
- **Arc testnet faucet reliability and confirmation speed.** Average confirmation we observed was around 0.5 seconds per tx. That's fast enough to drive a live demo where a judge clicks a hash and lands on a confirmed page.
- **`testnet.arcscan.app`.** Reliable, clean URL pattern (`/tx/{hash}`), deep-linkable. We use it as the canonical explorer URL across the app — single source of truth in [`src/lib/circleWallets.ts`](../src/lib/circleWallets.ts) and [`src/lib/arcSettlement.ts`](../src/lib/arcSettlement.ts).
- **Per-intent settlement at measured ~$0.00045 gas.** Arc is the first chain where we could ship per-action agent commerce *without* batching tricks. The PR reframes the whole "Why Arc?" thesis around this: we don't batch 60 intents into 1 tx, we let each intent settle as its own real USDC transfer because Arc's gas profile makes that viable. That's a stronger thesis than batched-cost-amortization.
- **Real-time transaction-state polling** was responsive enough to drive the live UI: we poll `getTransaction` per intent in the settlement queue and write `txHash` into Supabase the moment it lands; the SettlementAnimation dot grid lights up green via Supabase Realtime as each row's `all_hashes` array grows.

---

## What could be improved (concrete gaps we hit)

1. **The x402 spec is HTTP-shaped.** For agent-to-agent off-chain ledgers where requests are function calls or queue messages — not HTTP routes — we had to extend the pattern. We treat the 402 response as a structured message (an object with the same `X-Payment-*` header semantics serialized as fields). An "x402-lite" spec for in-process or queue-based agent communication would help. See our extension shape at [`src/lib/x402.ts:24-48`](../src/lib/x402.ts).
2. **Wallet creation latency on first task.** The first agent-to-agent transfer on a fresh wallet takes 2–3s to round-trip Circle → Arc → confirmation. Noticeable to a demo audience that just hit "Launch Mission." A documented pre-warming pattern (e.g., "ping each wallet at app boot") would smooth this.
3. **Polling for tx confirmation.** Our settlement queue polls `getTransaction` every 2s up to 30 times per intent. This works but eats latency. Webhooks or SSE from Circle for tx confirmation events would be a meaningful UX upgrade for live-demo apps. Today our queue does the right thing within the constraints — see [`src/lib/circleWallets.ts:60-101`](../src/lib/circleWallets.ts).
4. **Multi-wallet rate limiting.** Six dev wallets hammering `createTransaction` in parallel hit rate limits faster than expected during 60-intent runs. We solved this with a per-wallet serial queue + `CIRCLE_PER_WALLET_DELAY_MS` (default 250ms) inter-call delay + exponential backoff (1s/2s/4s) on 429s — see [`src/lib/settlementQueue.ts`](../src/lib/settlementQueue.ts). Clearer published guidance on per-dev-wallet parallelism limits would have shortened our debug loop.
5. **Programmable Wallet entity-secret rotation.** The runbook for rotating `CIRCLE_ENTITY_SECRET` is opaque. For production deploys, we'd want a documented rotation procedure that doesn't invalidate existing wallets.
6. **Arc explorer doesn't yet show internal txns from contract calls clearly.** A future SwarmPay version using a `BatchSettlement.sol` contract on Arc (for projects that *do* want per-task batching) would benefit from explorer support that surfaces internal transfers, not just the top-level tx.

---

## Recommendations

- **Official off-chain ledger SDK paired with on-chain settlement modes.** Let developers pick per-intent (our model) or batched (other models); the SDK handles state, retries, gas measurement. Both modes are valid; per-intent is cleaner for auditability, batched is cheaper at large scale. Today projects build the off-chain layer themselves.
- **Batch-transfer precompile on Arc.** Even with per-intent gas at $0.00045, projects that *want* to amortize gas (e.g., a thousand-transfer task) need a batch-transfer primitive that beats per-tx gas. Per-intent and batch settlement should coexist as opt-ins, not a choice forced by chain economics.
- **Better dev dashboards for high-frequency testing.** The current Circle console shows transactions but isn't designed for "we just made 60 transfers in 30 seconds." A "burst view" with grouping by task-id or correlation-id would help.
- **First-class SDK affordances for agent reputation patterns.** Most agent platforms will need read/write primitives for reputation. We built ours via Postgres ([`src/lib/reputation.ts`](../src/lib/reputation.ts) + atomic RPC `reputation_apply_delta`), but a portable trust signal that travels with the wallet would be more valuable than per-platform reputation silos.
- **Webhooks for tx confirmation events.** Replace the polling pattern. Even a per-wallet WebSocket would be a meaningful improvement.
- **Pre-warmed wallet pool API for demo / dev environments.** Rent-a-wallet for hackathon-style quick starts, where the wallet is already funded and ready to sign.
