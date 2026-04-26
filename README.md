# SwarmPay

**An autonomous AI agent economy where agents competitively bid on work, execute in parallel, and settle every payment as an individual on-chain USDC transfer — each one verifiable on Arc testnet without trusting a single line of our backend.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-swarm--pay.vercel.app-blue?style=flat-square)](https://swarm-pay.vercel.app)
[![Arc Testnet](https://img.shields.io/badge/Settlement-Arc%20Testnet%205042002-brightgreen?style=flat-square)](https://testnet.arcscan.app)
[![ERC-8004](https://img.shields.io/badge/Identity-ERC--8004%20Registry-purple?style=flat-square)](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e)
[![Hackathon](https://img.shields.io/badge/Hackathon-Agentic%20Economy%20on%20Arc-orange?style=flat-square)](https://lablab.ai)

---

## The Problem

AI agent coordination requires dozens of sub-cent micropayments per task — one per API call, one per subtask, one per piece of data fetched. On existing EVM chains, this is economically incoherent:

| Chain | Cost for 60 individual on-chain settlements | Outcome |
|---|---|---|
| Ethereum | 60 × ~$0.50 = **$30.00** | Fees exceed task value |
| Polygon | 60 × ~$0.01 = **$0.60** | Still destroys margins |
| **Arc** | **60 × ~$0.00045 = $0.027 measured** | **Per-action settlement is viable** |

Traditional platforms respond by batching or approximating payments — which breaks the machine-to-machine trust model. SwarmPay does not batch. Every payment is its own transaction. Every transaction is on-chain.

---

## What SwarmPay Does

A user types a task and sets a USDC budget. Six specialized AI agents compete for the work in a cryptographic auction. The winner decomposes the task, routes subtasks to the right agents, and each executing agent gets paid individually the moment their work is accepted. Unused budget flows back automatically.

The entire pipeline — bidding, execution, payment, settlement, reputation — runs without human orchestration.

---

## Architecture

```mermaid
flowchart TD
    U(["👤 User\nTask + USDC budget"]) --> AP

    AP["Gemini 3 Pro\nClassifies complexity\nSuggests agent count"]

    AP --> B1["CryptoScout-X\nOrchestrator · rep 95"]
    AP --> B2["Research-Alpha\nResearch · rep 92"]
    AP --> B3["DataMiner-Pro\nResearch · rep 87"]
    AP --> B4["Parser-X\nData Clean · rep 88"]
    AP --> B5["Analysis-Node\nAnalysis · rep 91"]
    AP --> B6["Compute-Grid-4\nCompute · rep 90"]

    B1 & B2 & B3 & B4 & B5 & B6 --> SCORE["Score = 1/price × rep/100\n× confidence × 1/time\nHighest score wins"]

    SCORE -->|"getAgentWallet(tokenId)"| ID["ERC-8004 Identity Registry\n0x8004A818..."]

    ID --> DECOMP["Lead agent decomposes\ninto 4 subtasks"]
    DECOMP --> PA["research\nGemini 3 Flash"]
    DECOMP --> PB["clean_data\nGemini 3 Flash"]
    DECOMP --> PC["analysis\nGemini 3 Flash"]
    DECOMP --> PD["compute\nGemini 3 Flash"]

    PA & PB & PC & PD --> INTENT["EIP-712 payment intent\nsigned by Circle wallet\nverified by ethers.verifyTypedData"]
    INTENT --> DRAIN["Stateless drain\nPostgres FOR UPDATE SKIP LOCKED\nself-recurses until 0 pending"]

    DRAIN --> TX["Circle createTransaction\nblockchain: ARC-TESTNET\n~$0.00045 per tx"]
    TX --> ARCSCAN["On-chain USDC transfer\nverifiable on testnet.arcscan.app"]

    ARCSCAN --> FEEDBACK["giveFeedback\nValidator EOA → Reputation Registry\nOn-chain rep delta per outcome"]
    FEEDBACK --> REP_REG["ERC-8004 Reputation Registry\n0x8004B663..."]
    ARCSCAN --> REFUND["Unused budget\nreturned to user wallet"]
```

---

## Agent Registry — Verified On-Chain

All six agents are registered as ERC-721 NFTs in the ERC-8004 Identity Registry on Arc testnet. Their Circle wallet addresses are cryptographically bound via EIP-712 `AgentWalletSet` signatures — no trust required.

**Any judge can verify without running our code:**

```bash
cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
  "getAgentWallet(uint256)(address)" <tokenId> \
  --rpc-url https://rpc.testnet.arc.network
```

| Agent | Role | ERC-8004 Token ID | Circle Wallet (Arc) | ArcScan |
|---|---|---|---|---|
| CryptoScout-X | Orchestrator | `2642` | `0x6150b2a7...cf4` | [View](https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/2642) |
| Research-Alpha | Research | `2643` | `0xF768B955...A51` | [View](https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/2643) |
| DataMiner-Pro | Research | `2644` | `0x5A240a74...C0e` | [View](https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/2644) |
| Parser-X | Data Cleaning | `2645` | `0x4AA6bf6f...C0` | [View](https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/2645) |
| Analysis-Node | Analysis | `2646` | `0x43d462F2...A1` | [View](https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/2646) |
| Compute-Grid-4 | Compute | `2647` | `0x6677937c...D5` | [View](https://testnet.arcscan.app/token/0x8004A818BFB912233c491871b3d84c89A494BD9e/instance/2647) |

**Registry contract:** [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e)  
**Reputation contract:** [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://testnet.arcscan.app/address/0x8004B663056A597Dffe9eCcC1965A193B7388713)

---

## Sample On-Chain Transactions

Each line below is a real USDC transfer on Arc testnet — one per agent, one per subtask:

| Agent Registration (ERC-8004 mint) | Wallet Binding (EIP-712) |
|---|---|
| [`0xc49ca9cb...`](https://testnet.arcscan.app/tx/0xc49ca9cb32ec9b1d0979c4a6ec9e3d0da4762a2cf90f3a641fe8ecaa810a4c7e) | [`0x2c213ff7...`](https://testnet.arcscan.app/tx/0x2c213ff7c07dfcf3dd5c4adbb2209cf95cb75aeb1c9d901e1a6cb840897c8115) |
| [`0xc38fa8ee...`](https://testnet.arcscan.app/tx/0xc38fa8ee1e99ddf17b23859503159cca3656f410beaa627528dbd0fc460459cf) | [`0x4d4919c9...`](https://testnet.arcscan.app/tx/0x4d4919c9b86d59db0592f6eab070b06ab8171fd0cf64e3f9768ee20d452a9184) |
| [`0x1a440342...`](https://testnet.arcscan.app/tx/0x1a44034275fd4c1299846e73db7e95d9e1c4c1205cbb6b9164e3f43ce6323b92) | [`0xf6989ad8...`](https://testnet.arcscan.app/tx/0xf6989ad80d017ad489f63b3e807234b4f57989475e84117a03733b7f8486d2a4) |
| [`0x4e1ec4db...`](https://testnet.arcscan.app/tx/0x4e1ec4db2f48248da680b6381c61415108f8fcd6b366697ea393df8a49f2ed94) | [`0xd130ae46...`](https://testnet.arcscan.app/tx/0xd130ae466c115a6c9eb5f42c2aa5cc18659eaf19c523e6f10b389afe62fb3ec4) |
| [`0xe7038a84...`](https://testnet.arcscan.app/tx/0xe7038a84cfde8c9334f92636dcf62a92893ec37e130afb446332c6f7ddd8fa13) | [`0xa92b30e6...`](https://testnet.arcscan.app/tx/0xa92b30e6d39f08978d65e2ce7307cf2622d5048c8c126d30310ad7833b833a0a) |
| [`0x3b588edc...`](https://testnet.arcscan.app/tx/0x3b588edc7ef12faf81d3fbe5b5410af2585e523f681fe0b1da0a7e3b09df8273) | [`0xc7d6f09d...`](https://testnet.arcscan.app/tx/0xc7d6f09dbf6de77784bdd7639203928a0888d77826c166ebb35841718454ef40) |

---

## Technology Stack

### Required (Arc Hackathon)

| Layer | Technology | Why |
|---|---|---|
| Settlement | **Arc L1** (chain ID 5042002) | All USDC transfers settle here — ~$0.00045/tx, deterministic finality |
| Value | **USDC** | Native gas token and payment unit. All agent balances are USDC. |
| Payments | **Circle Nanopayments + x402** | HTTP 402 payment standard; each subtask triggers an EIP-712 signed intent |
| Wallets | **Circle Developer-Controlled Wallets** | One Circle wallet per agent — real on-chain addresses, MPC key management |

### Identity & Trust

| Layer | Technology | What it proves |
|---|---|---|
| Agent identity | **ERC-8004 Identity Registry** | Each agent is an ERC-721 NFT — discoverable, ownable, verifiable |
| Payment authorization | **EIP-712 typed data** (`SwarmPayX402/v1` domain) | Circle wallet signs each payment intent; recovered via `ethers.verifyTypedData()` |
| Wallet binding | **EIP-712 `AgentWalletSet`** | Circle wallet signature proves consent to on-chain identity binding |
| Reputation | **ERC-8004 Reputation Registry** | `giveFeedback()` on-chain per task outcome — `getSummary()` is publicly readable |
| Anti-replay | **Partial unique index** on `(task_id, nonce) WHERE nonce IS NOT NULL` | DB-layer protection against x402 replay attacks |

### Intelligence

| Layer | Technology | Role |
|---|---|---|
| Orchestrator reasoning | **Gemini 3 Pro** (`gemini-3-pro-preview`) | Deep Think for task decomposition, bid synthesis, conflict resolution |
| Agent execution | **Gemini 3 Flash** (`gemini-3-flash-preview`) | Low-latency transactional agents — research, clean, analyze, compute |
| Fallback | **Groq** (Llama 3.3 70B) → **OpenAI** (GPT-4o-mini) | Graceful degradation if Gemini rate-limits |

### Infrastructure

- **Next.js 16** — App Router, Server-Sent Events for live pipeline streaming
- **Supabase** — Postgres for task state, payment audit trail, settlement progress; Realtime for UI updates
- **Stateless settlement drain** — `claim_pending_intents` Postgres RPC with `FOR UPDATE SKIP LOCKED`; drain self-recurses via HTTP until all intents settle, survives serverless cold starts

---

## Payment Flow in Detail

Every user task triggers this sequence. None of it is batched or approximated.

```
1. User submits task + USDC budget
   ↓
2. Swarm Intelligence Appraisal
   Gemini 3 Pro classifies: complexity (LOW/MEDIUM/HIGH), suggested agent count, skippable steps
   ↓
3. Bidding War (6 agents, ~200ms)
   Each agent submits: price (USDC), estimated time (ms), reputation score (0–100)
   Winner = argmax(1/price × reputation/100 × confidence × 1/time)
   ↓
4. Task Decomposition
   Lead agent breaks work into 4 typed subtasks: fetch_data → clean_data → analyze → compute
   Each subtask goes to the capability-matched agent via secondary auction
   ↓
5. Parallel Execution (real LLM calls)
   Gemini 3 Flash executes each subtask with role-differentiated system prompts
   Memory context from past tasks feeds into each call
   ↓
6. x402 Payment Intent per Subtask
   EIP-712 typed data signed by the paying agent's Circle wallet
   Signature verified server-side: ethers.verifyTypedData() → signer address recovered
   Agent balance checked before Circle API call (preflight — fail fast, no wasted gas)
   Intent written to Supabase with status: 'pending'
   ↓
7. Settlement Drain
   claim_pending_intents() RPC: FOR UPDATE SKIP LOCKED → claims a batch atomically
   circle.createTransaction({ blockchain: 'ARC-TESTNET', ... }) for each intent
   Polls for txHash — Circle returns the real on-chain hash once mined
   Updates intent to status: 'settled' with gas cost, block number, txHash
   Drain self-recurses until remaining = 0
   ↓
8. On-Chain Reputation Update
   Validator EOA (separate from platform owner — satisfies ERC-8004 anti-self-dealing rule)
   Calls giveFeedback(tokenId, delta, tag1=outcome, tag2=taskId) on Reputation Registry
   Tamper-evident feedbackHash = keccak256(taskId:outcome)
   ↓
9. Result delivered + unused budget refunded
```

---

## Running Locally

```bash
git clone https://github.com/winsznx/SwarmPay
cd SwarmPay
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

Open `http://localhost:3001`

### Required environment variables

```bash
# AI
GEMINI_API_KEY=           # Gemini 3 Flash + Pro (primary LLM)
GROQ_API_KEY=             # Llama 3.3 70B (fallback)
OPENAI_API_KEY=           # GPT-4o-mini (final fallback)

# Circle
CIRCLE_API_KEY=           # Developer-Controlled Wallets API key
CIRCLE_ENTITY_SECRET=     # Entity secret (encrypted per-request)
USDC_TOKEN_ID=            # Circle token ID for USDC on Arc

# Arc
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002

# Agent wallets (Circle wallet IDs — create 6 via Circle dashboard)
WALLET_ID_CRYPTO_SCOUT_X=
WALLET_ID_RESEARCH_ALPHA=
WALLET_ID_DATA_MINER_PRO=
WALLET_ID_PARSER_X=
WALLET_ID_ANALYSIS_NODE=
WALLET_ID_COMPUTE_GRID_4=

# Platform EOA (owns ERC-8004 NFTs, signs registrations)
PLATFORM_PRIVATE_KEY=     # Fund with Arc testnet USDC at faucet.circle.com
PLATFORM_WALLET_ADDRESS=

# Validator EOA (calls giveFeedback — MUST differ from PLATFORM_PRIVATE_KEY)
VALIDATOR_PRIVATE_KEY=    # Fund with Arc testnet USDC at faucet.circle.com

# ERC-8004 contracts (Arc testnet, CREATE2 vanity addresses)
ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
ERC8004_VALIDATION_REGISTRY=0x8004Cb1BF31DAf7788923b405b754f57acEB4272
ERC8004_CHAIN_ID=5042002

# ERC-8004 token IDs (pre-populated for our deployment — replace with yours)
ERC8004_TOKEN_ID_CRYPTO_SCOUT_X=2642
ERC8004_TOKEN_ID_RESEARCH_ALPHA=2643
ERC8004_TOKEN_ID_DATA_MINER_PRO=2644
ERC8004_TOKEN_ID_PARSER_X=2645
ERC8004_TOKEN_ID_ANALYSIS_NODE=2646
ERC8004_TOKEN_ID_COMPUTE_GRID_4=2647

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Endpoint secrets
ADMIN_SECRET=             # Protects POST /api/admin/bootstrap
SETTLEMENT_DRAIN_SECRET=  # Protects POST /api/settlement/drain

# App URL (no trailing slash)
NEXT_PUBLIC_BASE_URL=https://swarm-pay.vercel.app
```

---

## Deployment

### 1. Apply database migrations

Run each file in order in the Supabase SQL Editor. Each is idempotent — safe to re-run.

| Migration | What it adds |
|---|---|
| `001_phase_b_schema.sql` | Subtasks, bids, settlements, task_events, agent seed |
| `002_settlement_progress.sql` | Settlement queue progress columns, RPC helpers |
| `003_event_types.sql` | task_events.event_type enum |
| `004_gas_measurement.sql` | Gas tracking on payment_intents, auto-rollup trigger |
| `005_reputation.sql` | agents.tasks_failed, reputation_events, reputation_apply_delta RPC |
| `006_escrow.sql` | user_wallets, escrow_holds, escrow RPCs |
| `007_compute_sessions.sql` | Per-millisecond compute billing audit |
| `008_escrow_rpc.sql` | SECURITY DEFINER RPCs, PostgREST schema reload |
| `009_settlement_drain.sql` | claim_pending_intents, count_pending_intents RPCs |
| `010_agent_identity.sql` | Agent on-chain columns, payment crypto audit trail, anti-replay index |

### 2. Deploy to Vercel

```bash
vercel --prod
```

Set all env vars from `.env.local` in Vercel → Settings → Environment Variables.

### 3. Register agents on-chain (one-time)

```bash
curl -X POST https://your-deployment.vercel.app/api/admin/bootstrap \
  -H "Authorization: Bearer $ADMIN_SECRET"
```

This registers all 6 agents in the ERC-8004 registry, binds their Circle wallet addresses, and stores the token IDs. Idempotent — skips agents already registered. Expect ~5 minutes for 12 Arc transactions.

### 4. Verify

```bash
# Confirm an agent's Circle wallet is bound on-chain
cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
  "getAgentWallet(uint256)(address)" 2642 \
  --rpc-url https://rpc.testnet.arc.network

# Check on-chain reputation for any agent
cast call 0x8004B663056A597Dffe9eCcC1965A193B7388713 \
  "getSummary(uint256,address[],string,string)(uint64,int128,uint8)" \
  2642 "[0x43816436Ea440711959B30bDeb9C674A3D6D1D5f]" "" "" \
  --rpc-url https://rpc.testnet.arc.network
```

---

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page — product overview, live stats |
| `/dashboard` | Mission Control — submit tasks, watch agents run |
| `/marketplace` | Browse agent services and pricing |
| `/agents` | Agent leaderboard — reputation scores, task history |
| `/security` | Trust architecture — ERC-8004 bindings, payment proofs |
| `/why-swarmpay` | Economic model deep dive — the gas math |

---

## Judging Criteria Alignment

**Application of Technology**
Every required technology is used substantively, not decoratively. Arc is the settlement layer for every payment — no bridging, no batching. Circle Developer-Controlled Wallets hold real USDC per agent. x402 is the machine-to-machine payment standard with cryptographic verification. Gemini 3 Pro drives orchestrator decisions; Gemini 3 Flash runs transactional agents. ERC-8004 gives each agent a trustless on-chain identity.

**Business Value**
The agent economy is only viable at scale if coordination costs are negligible. SwarmPay proves the model: 60 individual on-chain settlements per task at $0.027 total. The same workflow on Ethereum costs $30 in gas — 1,100× more than the task value. This is not a technical curiosity; it is the necessary precondition for any real agent-to-agent commerce.

**Originality**
A reputation-weighted auction where agents compete in real time, pay each other individually per subtask, and build verifiable on-chain track records. The trust layer is not a database — it is the ERC-8004 registry on Arc, queryable by anyone.

**Presentation**
Every claim in this README is verifiable on-chain. The token IDs, transaction hashes, and contract addresses above are real. Run the `cast call` commands above against Arc testnet RPC and get the same answers without running any SwarmPay code.

---

## Circle Product Feedback

SwarmPay used: **Arc Network**, **USDC**, **Circle Developer-Controlled Wallets**, **Circle Nanopayments / x402**

The Circle Wallets API is what makes per-agent identity tractable. Each agent has its own MPC wallet — real on-chain address, real USDC balance, real transaction history — without exposing private keys or running key management infrastructure. The `signTypedData` endpoint enabled ERC-8004 wallet consent signing: the Circle wallet cryptographically proves it consents to being bound to the agent NFT, which the registry verifies on-chain.

The one area where we hit friction: `signTypedData` requires the `EIP712Domain` type to be explicitly present in the `types` object — this is not documented in the SDK and cost several hours. Recommend adding a code example in the docs.

---

*Built for the **Agentic Economy on Arc** hackathon — April 2026*
