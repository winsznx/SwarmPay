# SwarmPay — The Agent Economy Built for Sub-Cent Transactions

> **Hackathon Submission:** Agentic Economy on Arc | Track: Agent-to-Agent Payment Loop

[![Live Demo](https://img.shields.io/badge/Live%20Demo-swarm--pay.vercel.app-blue)](https://swarm-pay.vercel.app)
[![Arc Testnet](https://img.shields.io/badge/Settlement-Arc%20Testnet-green)](https://testnet.arcscan.app)
[![Circle Wallets](https://img.shields.io/badge/Wallets-Circle%20Developer-orange)](https://developers.circle.com)

---

## What is SwarmPay?

SwarmPay is an autonomous AI agent economy where six specialized agents competitively bid on user tasks, execute work in parallel, pay each other in real-time via the x402 protocol, and settle every micropayment as its own real on-chain USDC transfer on Arc — ~60 transfers per task, ~$0.027 measured gas total.

The user types a question, sets a USDC budget, and watches the economy run itself.

**The core insight:** AI agent coordination requires dozens of sub-cent payments between agents per task. On Ethereum that's 60 × $0.50 = $30 in gas — economically impossible. On Arc it's 60 × ~$0.00045 (measured) = ~$0.027 total. SwarmPay only exists because Arc makes per-action settlement viable without batching tricks.

---

## How It Works

```
User submits task + USDC budget
        ↓
6 agents bid competitively (price × reputation × speed)
        ↓
Lead agent wins, decomposes task into 4 sub-tasks
        ↓
Sub-agents execute in parallel (research, clean, analyze, compute)
        ↓
50-65 x402 payment intents flow between agents
        ↓
Each intent settles as its own real on-chain USDC transfer on Arc
   (~$0.00045 measured per tx, ~$0.027 total — verifiable on testnet.arcscan.app)
        ↓
Answer delivered + unused budget refunded automatically
```

---

## Why This Model Fails on Other Chains

| Chain | Gas for 60 individual on-chain settlements | Viable? |
|-------|--------------------------------------------|---------|
| Ethereum | 60 × $0.50 = $30.00 | ❌ 100× task value |
| Polygon | 60 × $0.01 = $0.60 | ❌ eats the task |
| **Arc** | **60 × ~$0.00045 measured = $0.027** | **✅ per-action settlement viable** |

Every other chain destroys agent margins. Arc makes the economics work.

---

## Tech Stack

- **Settlement:** Arc Network (EVM-compatible L1)
- **Payments:** Circle USDC + Circle Developer-Controlled Wallets
- **Nanopayments:** x402 payment protocol (agent-to-agent)
- **Intelligence:** Groq (Llama 3.3 70B) + Gemini 2.0 Flash
- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Persistence:** Supabase (task history + payment audit trail)
- **Real-time:** Server-Sent Events (SSE) for live payment stream

---

## Agent Roster

| Agent | Role | Specialty |
|-------|------|-----------|
| CryptoScout-X | Orchestrator | Task decomposition & bid coordination |
| Research-Alpha | Research | Deep research & source cross-referencing |
| DataMiner-Pro | Research | Data extraction & pattern mining |
| Parser-X | Data Cleaning | Normalization & deduplication |
| Analysis-Node | Analysis | Intelligence synthesis & insights |
| Compute-Grid-4 | Compute | Statistical modeling & risk scoring |

Each agent has a real Circle Developer-Controlled Wallet on Arc testnet with funded USDC.

---

## Verified On-Chain Transactions

Example Arc testnet settlement transactions:
- `0xca6064e390b88e0ef98dddd7265d8dcdd82591ed34de3d2bbfc1dbe9714862b8`
- `0x9e97becb478f184472b91571a2354e8ac0c142c03166b7ef9bc9796cb8e720a8`
- `0x8db90a6da0a34476d5820092b8231553a44f811be8cfca842820e75e737fad44`

Verify any transaction at: [testnet.arcscan.app](https://testnet.arcscan.app)

---

## Running Locally

```bash
git clone https://github.com/TheWeirdDee/SwarmPay
cd SwarmPay
npm install
```

Create `.env.local`:
```
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
CIRCLE_API_KEY=your_circle_key
CIRCLE_ENTITY_SECRET=your_entity_secret
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
WALLET_ID_CRYPTO_SCOUT_X=your_wallet_id
WALLET_ID_RESEARCH_ALPHA=your_wallet_id
WALLET_ID_DATA_MINER_PRO=your_wallet_id
WALLET_ID_PARSER_X=your_wallet_id
WALLET_ID_ANALYSIS_NODE=your_wallet_id
WALLET_ID_COMPUTE_GRID_4=your_wallet_id
```

```bash
npm run dev
```

Open `http://localhost:3000`

---

## Demo

1. Go to [swarm-pay.vercel.app](https://swarm-pay.vercel.app)
2. Type any task: *"Analyze top DeFi protocols on Arc"*
3. Set a budget (minimum $0.05 USDC)
4. Click **Launch Mission**
5. Watch agents bid, execute, and settle in real time

---

## Pages

- `/` — Landing page with explainer and live stats
- `/dashboard` — Mission Control (main app)
- `/marketplace` — Browse agent services
- `/agents` — Agent leaderboard and profiles
- `/security` — Trust architecture and audit trail
- `/why-swarmpay` — Deep dive on the economic model

---

## Circle Product Feedback

**Products used:** Arc Network, USDC, Circle Developer-Controlled Wallets, Circle Nanopayments

SwarmPay demonstrates that per-action sub-cent machine-to-machine payments are only viable on Arc. The Circle Wallets API enabled us to give each AI agent a real on-chain identity with genuine USDC balances. Arc's measured per-tx gas (~$0.00045) is what makes the entire economic model work — on any other chain, even pre-batched gas fees would exceed the task value. We deliberately do NOT batch: every payment intent lands as its own real USDC transfer on Arc, fully visible and fully auditable.

---

Built for the **Agentic Economy on Arc** hackathon | April 2026
