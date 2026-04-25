# SwarmPay — Submission text

Copy each block into the corresponding lablab field.

---

## Project Title

**SwarmPay — The Agent Economy on Arc**

---

## Short Description (max 160 characters)

> Production agent payment infrastructure. 6 AI agents bid, sub-contract, and settle 60+ real USDC nanopayments on Arc per task.

(154 chars)

---

## Long Description (~500 words)

**Problem.** AI agent frameworks have no economic primitives. CrewAI, AutoGen, LangGraph all treat agent collaboration as a coordination problem — a graph of message-passing — and never as commerce. The agents themselves have no concept of cost, no incentive to be efficient, and no protocol to pay one another for rendered capabilities. Without per-action settlement and price signals, agents can't operate as autonomous economic actors. They're just function calls dressed in trench coats.

**Solution.** SwarmPay is full agent payment infrastructure built on Arc. Six specialized AI agents — orchestrator, two researchers, a data-cleaning agent, an analyzer, a compute node — each carry their own Circle Programmable Wallet with a real on-chain USDC balance. Users submit a task with a budget; the agents competitively bid against each other (price × reputation × confidence × speed); the winning lead agent decomposes the task into sub-tasks and recursively contracts other agents to perform them; every agent-to-agent capability call goes through a real x402 Payment Required handshake (provider responds 402 + price headers, consumer signs a payment intent via Circle, provider verifies and renders); each signed intent is settled on Arc as its own real USDC transfer. Reputation updates atomically with task settlement, weighing the next bidding round.

**Production stack.**
- Circle Programmable Wallets (one per agent, full custody isolation)
- USDC on Arc testnet
- x402 protocol implemented end-to-end ([src/lib/x402.ts](../src/lib/x402.ts))
- Per-wallet settlement queue with exponential backoff on 429s ([src/lib/settlementQueue.ts](../src/lib/settlementQueue.ts))
- Real gas measurement from Arc RPC receipts — no hardcoded constants ([src/lib/gasMeasurement.ts](../src/lib/gasMeasurement.ts))
- Atomic Postgres RPCs for reputation, escrow, and settlement progress
- Supabase persistence with Realtime updates for live UI
- Next.js on Vercel

**Track.** Agent-to-Agent Payment Loop (primary). Usage-Based Compute Billing (secondary — per-millisecond compute meter live in the UI, billing rate $0.000001/ms).

**Proof.** Every task generates 60+ verifiable on-chain transactions on `testnet.arcscan.app`. Total gas measured from real receipts (~$0.027) vs. ~$30 on Ethereum (≈1100× margin). Click any tx hash in the demo settlement panel to verify the actual USDC transfer on Arc explorer.

**Why this is production-ready, not a prototype.**
- Real escrow with held / spent / refunded lifecycle and atomic Postgres functions
- Real reputation system, +1/-2/+3/-5 deltas applied via single-statement RPC, audit trail in `reputation_events`, weighted into bid scoring
- Real x402 protocol implementation — 402 / signed / settled triplets visible in the live PaymentStream, every signature from a Circle wallet, every settlement landing on Arc
- Real per-millisecond compute meter, persisted in `compute_sessions`
- Real per-intent on-chain settlement with retry/backoff (no Promise.race truncation)
- Real per-tx gas measurement from `eth_getTransactionReceipt` — gas displays read from `settlements.total_gas_cost` summed via DB trigger from measured per-intent costs
- Real persistence surviving Vercel cold starts (every pipeline phase boundary writes through to Supabase)
- Real `/api/health` endpoint checking Supabase + Circle + Arc RPC

---

## Technologies & Tags

`Arc` · `Circle USDC` · `Circle Programmable Wallets` · `Circle Nanopayments` · `x402` · `Gemini API` · `Supabase` · `Next.js` · `Vercel` · `TypeScript`

---

## GitHub URL

`https://github.com/<owner>/SwarmPay` _(set after final merge)_

---

## Demo URL

`https://swarm-pay.vercel.app`

---

## Cover image

[`public/cover.svg`](../public/cover.svg) — 1280×720, dark background matching the landing page, "SWARMPAY" wordmark with the three production-grounded stats (60+ real settlements / $0.027 measured gas / x402 protocol). SVG ships in the repo; if the lablab form needs PNG, render the SVG to PNG via any browser screenshot or `rsvg-convert`.
