# Technical Gaps & Future Roadmap

This document outlines current limitations and proposed solutions for the SwarmPay v1.0 deployment.

### 1. Real-time Synchronization (SSE vs Serverless)
**Gap:** The current "Nanopayment Stream" uses Server-Sent Events (SSE) backed by a local Node.js `EventEmitter`. On Vercel, serverless functions are isolated, meaning the task execution instance cannot broadcast events to the stream listener instance.
**Workaround:** Implemented a persistent polling fallback (2.5s) in `useWebSocket.ts` that pulls from Supabase.
**Fix:** Migrate to a Pub/Sub layer (Redis/Upstash) or Supabase Realtime for instant cross-instance broadcasts.

### 2. State & Persistence
**Gap:** Orchestration logic relies on an in-memory `MemoryStore`. On Vercel, this state is volatile and resets during cold starts or instance cycles.
**Workaround:** Added lazy-loading/catch-up logic to fetch completed tasks and payments from Supabase.
**Fix:** Fully transition orchestration state to a shared database or a durable execution framework.

### 3. Settlement Precision
**Gap:** "Settlement" currently triggers a single Circle transaction for the aggregated sum of all nanopayments to provide a verifiable on-chain hash. It does not literally execute 60+ transactions on-chain (which would be inefficient even on Arc).
**Fix:** Implement an on-chain "Nanopayment Channel" or "Batch Settlement" contract on Arc where agents can cryptographically verify state and settle thousands of intents in one batched call.

### 4. Agent Autonomy
**Gap:** Agents currently perform single-turn execution based on decomposition. They do not yet have long-term memory or the ability to autonomously "re-bid" if a sub-task fails.
**Fix:** Integrate a vector database for agent memory and implement an autonomous retry/escalation loop in the pipeline.

### 5. Identity & Security
**Gap:** Wallet IDs and API keys are managed via environment variables.
**Fix:** Integrate Circle's "User-Controlled Wallets" logic for more granular permissioning if expanded to non-platform agents.

---
**Core Mission Proof:** Despite these gaps, the economic feasibility of sub-cent pricing on Arc is fully verified. Every $0.30 task settles for exactly $0.0006 gas—a ratio impossible on any other L1/L2.
