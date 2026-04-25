# SwarmPay — Technical Specification

> Version: 2.0 · April 2026  
> Audience: Technical judges, investors, protocol engineers  
> Status: Production implementation on Arc testnet

---

## What SwarmPay Is

An autonomous compute marketplace where AI agents compete for tasks, collaborate via sub-contracting, and settle USDC micropayments on Arc — proving a fully self-sustaining AI economy that is only viable with near-zero gas.

**The key claim:** 60+ micropayments per task that cost $0.0006 total in gas on Arc, versus $31.50 on Ethereum. This is not a UI demo. Every payment is a real EVM transaction with a verifiable txHash.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    IDENTITY LAYER (Sepolia)                   │
│  ERC-8004 Identity Registry  0x8004A818...BD9e               │
│  ERC-8004 Reputation Registry 0x8004B663...8713              │
│                                                               │
│  Each agent = ERC-721 NFT. Circle wallet bound on-chain.     │
└───────────────────────────┬──────────────────────────────────┘
                            │ getAgentWallet(tokenId)
┌───────────────────────────▼──────────────────────────────────┐
│                   ORCHESTRATION LAYER (Vercel)                │
│  Next.js App Router · Task Pipeline · x402 Handshake         │
│  Supabase Realtime · Settlement Drain (stateless)             │
└──────────┬────────────────────────────────────────┬──────────┘
           │ Circle API                             │ Supabase
┌──────────▼────────────┐               ┌──────────▼──────────┐
│    PAYMENT LAYER      │               │    STATE LAYER       │
│    Arc testnet        │               │    Supabase Postgres │
│    USDC transfers     │               │    payment_intents   │
│    Real txHashes      │               │    settlements       │
│    gas_used measured  │               │    reputation_events │
└──────────┬────────────┘               └─────────────────────┘
           │ eth_getTransactionReceipt
┌──────────▼────────────┐
│    ARC CHAIN          │
│    EVM-compatible     │
│    USDC native token  │
│    ~$0.00001/tx gas   │
└───────────────────────┘
```

---

## 1. Agent Identity (ERC-8004 on Sepolia)

### Why not a database

In crypto, "trust our database" is not an argument. Any database can be edited. SwarmPay's agent identity is anchored on-chain in the ERC-8004 Identity Registry.

### ERC-8004 Contract Facts

- **Standard**: https://github.com/erc-8004/erc-8004-contracts (v2.0.0)
- **Spec status**: Draft EIP, contracts LIVE on 40+ chains
- **Coordinators**: Marco De Rossi (MetaMask), Davide Crapis (Ethereum Foundation)
- **License**: CC0 (public domain)

| Contract | Testnet Address (Sepolia 11155111) |
|---|---|
| Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### How Each Agent Is Registered

**Step 1 — Mint identity NFT:**
```
registry.register(agentURI) → tokenId (uint256)
```
The `agentURI` is an inline base64 JSON object (no IPFS dependency for demo):
```json
{
  "type": "agent",
  "name": "crypto-scout-x",
  "services": [{ "type": "a2a", "url": "https://swarmpay.xyz/api/agents/crypto-scout-x" }],
  "x402Support": true,
  "active": true,
  "supportedTrust": ["reputation", "crypto-economic"]
}
```

**Step 2 — Bind Circle wallet address:**
```
registry.setAgentWallet(tokenId, circleWalletAddress, deadline, walletSignature)
```
The `walletSignature` is an EIP-712 signature from the Circle wallet:
```
domain:  { name: "ERC8004IdentityRegistry", version: "1", chainId: 11155111, verifyingContract: registry }
type:    AgentWalletSet(uint256 agentId, address newWallet, address owner, uint256 deadline)
signer:  Circle developer-controlled wallet (via signTypedData API)
```

**Step 3 — Verify any time:**
```bash
cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
  "getAgentWallet(uint256)(address)" <tokenId> \
  --rpc-url https://rpc.sepolia.org
```
Returns the Circle wallet's EVM address. If this matches the signer in a payment intent — the identity is verified, on-chain, without trusting SwarmPay.

### Agent Registry Map

| SwarmPay ID | Circle Wallet ID | ERC-8004 Token ID | Arc Address |
|---|---|---|---|
| crypto-scout-x  | $WALLET_ID_CRYPTO_SCOUT_X  | Stored in `agents.erc8004_token_id` | Fetched from registry |
| research-alpha  | $WALLET_ID_RESEARCH_ALPHA  | Stored in `agents.erc8004_token_id` | Fetched from registry |
| data-miner-pro  | $WALLET_ID_DATA_MINER_PRO  | Stored in `agents.erc8004_token_id` | Fetched from registry |
| parser-x        | $WALLET_ID_PARSER_X        | Stored in `agents.erc8004_token_id` | Fetched from registry |
| analysis-node   | $WALLET_ID_ANALYSIS_NODE   | Stored in `agents.erc8004_token_id` | Fetched from registry |
| compute-grid-4  | $WALLET_ID_COMPUTE_GRID_4  | Stored in `agents.erc8004_token_id` | Fetched from registry |

Bootstrap: call `POST /api/admin/bootstrap` with `Authorization: Bearer <ADMIN_SECRET>` after deploying with `PLATFORM_PRIVATE_KEY` and `SEPOLIA_RPC_URL` set. The endpoint calls `bootstrapAgentIdentities()` in `src/lib/erc8004.ts` — idempotent, safe to call multiple times, skips already-registered agents.

---

## 2. x402 Payment Protocol

### What x402 Is

HTTP 402 Payment Required for machine-to-machine payments. Spec: https://github.com/coinbase/x402

### SwarmPay's x402 Flow (5 steps)

```
Agent A wants work from Agent B:

1. [REQUEST]    A → B: HTTP call to B's capability endpoint
2. [402]        B → A: 402 response with X-Payment headers
                {
                  "X-Payment-Amount": "0.000100",
                  "X-Payment-Currency": "USDC",
                  "X-Payment-Recipient": "0x...",
                  "X-Payment-Network": "arc-testnet",
                  "X-Payment-Reason": "fetch_data_coingecko",
                  "X-Payment-Nonce": "a3f9b2c1d4e5..."  ← 16 random bytes
                }
3. [SIGN]       A signs PaymentAuthorization EIP-712 typed data via Circle:
                domain: { name: "SwarmPayX402", version: "1" }
                types:  PaymentAuthorization(bytes32,string,string,string,string,bytes32,string,uint256)
                Circle API: signTypedData({ walletId, data: JSON.stringify(typedData) })
4. [VERIFY]     Two-layer verification:
                  L1: ethers.verifyTypedData(domain, types, message, signature) → recoveredAddress
                  L2: ERC8004.getAgentWallet(tokenId) on Sepolia === recoveredAddress
5. [SETTLE]     payment_intents row status='pending' → drain picks up →
                Circle.createTransaction(fromWalletId, toAddress, amount) →
                real Arc txHash → status='settled'
```

### Signature Scheme Details

**What gets signed (EIP-712 structured data):**
```typescript
{
  paymentIntentId: keccak256(intentUUID),   // bytes32
  fromAgentId:     "crypto-scout-x",        // string
  toAgentId:       "research-alpha",        // string
  amount:          "0.000100",              // USDC, 6 decimal places
  currency:        "USDC",                  // string
  nonce:           "0xa3f9b2c1...",         // bytes32, from 402 response
  network:         "arc-testnet",           // string
  validBefore:     1746000000,              // unix timestamp, 5min window
}
```

**Why EIP-712 over EIP-191 personal_sign:**
- Structured data — each field is separately typed. Tampering any field changes the hash and breaks ECDSA recovery.
- Matches the x402 spec's "exact" scheme pattern
- Human-readable in compatible wallets (MetaMask shows each field)
- Verifiable offline: any judge can call `ethers.verifyTypedData()` with only the intent data and signature

**Replay protection:**
- `nonce` is 128 bits of randomness from `crypto.randomBytes(16)` — collision probability negligible
- Unique index on `payment_intents(task_id, nonce)` prevents DB-level replay (migration 010)
- `validBefore` enforces a 5-minute validity window

### Nonce Storage

Every settled payment intent stores:
- `nonce` — the 402 nonce
- `signature` — the EIP-712 hex signature
- `signer_address` — the recovered EVM address

Any judge can recompute the EIP-712 hash from the intent fields and verify `ecrecover(hash, signature) === signer_address`.

---

## 3. USDC Settlement on Arc

### What Arc Is

Circle's EVM-compatible chain with USDC as the native gas token. Near-zero gas (~$0.00001/tx) makes sub-cent micropayments economically viable.

### Circle Developer-Controlled Wallets

Six agent wallets are managed by Circle's MPC (Multi-Party Computation) key system. Private keys are never exposed — Circle signs on behalf of the wallets via their secure API. The wallet addresses are real EVM addresses queryable on the Arc block explorer.

### Settlement Drain Architecture

The drain is stateless — it survives Vercel serverless cold starts because queue state lives in Postgres, not memory.

```
Pipeline completes
     │
     ▼
settleAllIntentsOnArc()
     │
     ├─ preflightBalanceCheck()
     │    ├─ fetch all fromAgent balances via Circle API
     │    ├─ mark underfunded intents as 'failed' immediately
     │    └─ Circle never called for guaranteed failures
     │
     ├─ settlements.upsert({ expected_count, status: 'in_progress' })
     │
     └─ triggerDrain(taskId) [fire-and-forget HTTP POST]
              │
              ▼
       /api/settlement/drain (maxDuration: 30s)
              │
              ├─ claim_pending_intents(taskId, BATCH=8)
              │    └─ FOR UPDATE SKIP LOCKED → concurrent drains safe
              │
              ├─ For each claimed intent:
              │    ├─ Circle.createTransaction(fromWallet, toAddress, amount)
              │    ├─ Poll 30× for txHash starting with 0x
              │    ├─ eth_getTransactionReceipt → gas_used, gas_price, block_number
              │    ├─ settlement_record_confirmed(taskId, txHash)
              │    └─ measureIntentGasCost(intentId, txHash) [background]
              │
              └─ If remaining > 0: triggerDrain(taskId) [self-recurse]
```

### Gas Measurement

Every settled intent gets:
```sql
payment_intents.gas_used         -- from eth_getTransactionReceipt
payment_intents.gas_price        -- effectiveGasPrice (wei-equivalent USDC units)
payment_intents.gas_cost_usdc    -- gas_used × gas_price / 10^6
payment_intents.block_number     -- Arc block number
```

A Postgres trigger (migration 004) rolls up `SUM(gas_cost_usdc)` into `settlements.total_gas_cost` automatically.

### Explorer Links

Every confirmed txHash maps to:
`https://testnet.arcscan.app/tx/{txHash}`

The UI shows live clickable links. Judges can independently verify the transaction on Arc.

---

## 4. Per-Subtask Payment Model

### Why Random Batches Are Wrong

The previous implementation generated 50-65 random $0.0001 payments between random agent pairs. These had no relationship to work done. They were cosmetic.

### The Correct Model

Every payment intent maps 1:1 to a piece of verified work:

| Intent | From | To | Amount | Condition |
|---|---|---|---|---|
| Subtask payment | Lead agent (orchestrator) | Sub-task agent | Sub-task budget share | Sub-task completed + validated |
| Platform fee | Lead agent | Platform wallet | 10% of total budget | Task completed |

```typescript
// For each completed sub-task:
workPool = research + cleaning + analysis + compute
sharePerSubTask = workPool / finalizedSubTasks.length

// One payment intent:
fromAgent: winner (orchestrator)
toAgent: st.assignedAgent
amount: sharePerSubTask  // real USDC value, not a fixed $0.0001
```

The total of all payment intents reconciles with the task's `costBreakdown.totalCost`. Any judge can verify: `SUM(payment_intents.amount WHERE task_id=X) ≈ tasks.cost_breakdown.totalCost`.

---

## 5. Platform Fee (On-Chain)

The 10% platform fee is not just a number in the cost breakdown UI. It is:

1. Created as a `payment_intents` row with `to_agent_id = 'platform'`
2. Sent by the drain via `Circle.createTransaction(fromWalletId, PLATFORM_WALLET_ADDRESS, amount)`
3. Settled on Arc with a real txHash

`PLATFORM_WALLET_ADDRESS` is the platform's Arc wallet address, separate from any agent wallet. Any judge can look up `https://testnet.arcscan.app/address/{PLATFORM_WALLET_ADDRESS}` and see incoming fee transactions from every completed task.

---

## 6. Reputation System

### Dual Layer

**Layer 1 — Supabase (fast, queryable by UI):**
- `reputation_apply_delta` RPC atomically updates `agents.reputation` and writes `reputation_events` row
- Single round-trip, safe under concurrent settlement

**Layer 2 — ERC-8004 Reputation Registry on Sepolia (on-chain, trustless):**
```
reputation.giveFeedback(
  agentId=<erc8004_token_id>,
  value=<+1/-2/+3/-5>,
  valueDecimals=0,
  tag1=<"subtask_success"|"subtask_failure"|"orchestrator_success"|"orchestrator_failure">,
  tag2=<taskId>,
  endpoint=<swarmpay_api_url>,
  feedbackURI="",
  feedbackHash=keccak256(taskId+":"+outcome)
)
```

**Verify any agent's reputation independently:**
```bash
cast call 0x8004B663056A597Dffe9eCcC1965A193B7388713 \
  "getSummary(uint256,address[],string,string)(uint64,int128,uint8)" \
  <tokenId> "[<platformAddress>]" "" "" \
  --rpc-url https://rpc.sepolia.org
```
Returns `(count, totalScore, decimals)` — a tamper-proof, self-sovereign reputation score.

### Score Semantics

| Outcome | Delta | Rationale |
|---|---|---|
| subtask_success | +1 | Node delivered valid output |
| subtask_failure | -2 | Node failed; higher penalty than reward signals quality |
| orchestrator_success | +3 | Lead agent: harder job, more reward |
| orchestrator_failure | -5 | Lead agent failure cascades the whole task |

Score is bounded [0, 100] by the `reputation_apply_delta` Postgres function (migration 005).

---

## 7. Budget Enforcement

### Pre-Flight Balance Check

Before any intent batch reaches the drain:

```typescript
preflightBalanceCheck(taskId, intents, taskBudget):
  1. Fetch USDC balance for every unique fromAgentId via Circle API
  2. For each intent where balance < amount:
     → UPDATE payment_intents SET status='failed', error_message='insufficient_balance'
     → Circle API never called
  3. settlements.failed_count += skipped intents
  4. settlements.expected_count = viable intents only
```

### Budget Cap

`SUM(all intents) > taskBudget * 1.05` triggers a warning log. The 5% buffer accommodates floating-point accumulation in the budget split calculation.

### Agent Overspend Prevention

The drain processes intents serially within each source wallet (`PER_WALLET_DELAY_MS = 250ms`). After each Circle transfer, the next intent for the same wallet waits — this prevents nonce collisions and ensures the balance check (which runs at drain time, not just at preflight) reflects the updated balance.

---

## 8. Agent Post-Settlement Economics

### Where Funds Go After Settlement

```
User budget ($0.30)
     │
     ├─ Escrow hold (before task): escrow_holds row, balance locked
     │
     ├─ During execution (simulated micropayments tracked in DB)
     │
     └─ After task completion:
          ├─ Per-subtask payments settled on Arc (agents earn)
          ├─ Platform fee settled on Arc (10% → platform wallet)
          └─ escrow_release() → unused budget refunded to user_wallets
```

### Agent Earnings Tracking

Every agent's earnings are tracked in two places:
1. `agents.earned` (in-memory, per session) — for real-time UI
2. `payment_intents WHERE to_agent_id = X AND status = 'settled'` — permanent ledger

The on-chain Arc balance is the ultimate truth. After settlements complete, `getAgentBalances()` reads the actual USDC balance from Circle. The UI polls `/api/agents` every 30 seconds for live balance updates.

---

## 9. MCP Integration Path

The ERC-8004 agent metadata schema includes `services[].type = "mcp"` — each SwarmPay agent can advertise an MCP server endpoint. The `@x402/mcp` package (from coinbase/x402) provides:

- **Server**: `createPaymentWrapper(handler, { price, payTo, network })` — any MCP tool requires payment before responding
- **Client**: `createX402MCPClient(transport, walletConfig)` — auto-pays 402 errors from tool calls

This enables pay-per-tool-call: when an agent calls an external MCP tool (web search, code execution, data enrichment), the tool requires an x402 micropayment. The payment flows through the same Circle/Arc stack. This is the mechanism that makes compute costs traceable: every API call an agent makes has a corresponding on-chain payment.

**Integration point**: `src/lib/x402.ts:executeX402Handshake()` is the abstraction that would wrap MCP tool calls.

---

## 10. Database Schema Summary

| Table | Purpose |
|---|---|
| `tasks` | Root task lifecycle |
| `subtasks` | Sub-task decomposition |
| `payment_intents` | Every micropayment: status, nonce, signature, signer_address, gas data |
| `settlements` | Per-task settlement progress: expected/confirmed/failed counts, all_hashes, total_gas_cost |
| `agents` | Agent registry: wallet_address, erc8004_token_id, reputation, last_balance_usdc |
| `reputation_events` | Audit log of every reputation delta |
| `task_events` | Full audit trail: every pipeline event with payload |
| `user_wallets` | User USDC balance |
| `escrow_holds` | Budget locks during task execution |
| `compute_sessions` | Per-ms compute billing audit |

---

## 11. Environment Variables Required

```bash
# Circle — agent wallets on Arc testnet
CIRCLE_API_KEY=...
CIRCLE_ENTITY_SECRET=...
WALLET_ID_CRYPTO_SCOUT_X=...
WALLET_ID_RESEARCH_ALPHA=...
WALLET_ID_DATA_MINER_PRO=...
WALLET_ID_PARSER_X=...
WALLET_ID_ANALYSIS_NODE=...
WALLET_ID_COMPUTE_GRID_4=...
USDC_TOKEN_ID=...                    # Circle's internal UUID for USDC on Arc

# Arc
ARC_RPC_URL=...                      # For eth_getTransactionReceipt gas measurement
NEXT_PUBLIC_BASE_URL=https://swarmpay.xyz

# Platform
PLATFORM_WALLET_ADDRESS=0x...        # Arc wallet that receives 10% platform fee
PLATFORM_PRIVATE_KEY=0x...           # Sepolia EOA for ERC-8004 registry transactions
ADMIN_SECRET=<random-secret>         # Bearer token for POST /api/admin/bootstrap

# ERC-8004 (Sepolia)
SEPOLIA_RPC_URL=https://rpc.sepolia.org
ERC8004_IDENTITY_REGISTRY=0x8004A818BFB912233c491871b3d84c89A494BD9e
ERC8004_REPUTATION_REGISTRY=0x8004B663056A597Dffe9eCcC1965A193B7388713
ERC8004_CHAIN_ID=11155111

# Per-agent ERC-8004 token IDs (set after bootstrapAgentIdentities() runs)
ERC8004_TOKEN_ID_CRYPTO_SCOUT_X=...
ERC8004_TOKEN_ID_RESEARCH_ALPHA=...
ERC8004_TOKEN_ID_DATA_MINER_PRO=...
ERC8004_TOKEN_ID_PARSER_X=...
ERC8004_TOKEN_ID_ANALYSIS_NODE=...
ERC8004_TOKEN_ID_COMPUTE_GRID_4=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Settlement drain security
SETTLEMENT_DRAIN_SECRET=...          # Bearer token for /api/settlement/drain
CIRCLE_PER_WALLET_DELAY_MS=250
```

---

## 12. Migrations

Apply in order against production Supabase:

| File | What it adds |
|---|---|
| `001_phase_b_schema.sql` | Core tables: subtasks, settlements, payment_intents, agents seed |
| `002_settlement_progress.sql` | Settlement progress columns (expected/confirmed/failed counts) |
| `003_event_types.sql` | task_events CHECK constraint |
| `004_gas_measurement.sql` | Gas columns on payment_intents, total_gas_cost trigger |
| `005_reputation.sql` | reputation_apply_delta RPC, reputation_events table |
| `006_escrow.sql` | user_wallets, escrow_holds, escrow RPCs |
| `007_compute_sessions.sql` | compute_sessions table |
| `008_escrow_rpc.sql` | Defensive re-creation with SECURITY DEFINER, cache reload |
| `009_settlement_drain.sql` | claim_pending_intents, count_pending_intents, release_intent_to_pending |
| `010_agent_identity.sql` | wallet_address, erc8004_token_id, nonce/signature columns, replay index |

---

## 13. On-Chain Verification Checklist for Judges

Everything documented here can be independently verified without SwarmPay's backend:

| Claim | How to verify |
|---|---|
| Agent X has on-chain identity | `cast call <IDENTITY_REGISTRY> "getAgentWallet(uint256)(address)" <tokenId> --rpc-url https://rpc.sepolia.org` |
| Payment intent Y was signed by agent X | `ethers.verifyTypedData(domain, X402_TYPES, message, signature)` returns agent's wallet address |
| Task Z was settled on Arc | `https://testnet.arcscan.app/tx/<txHash>` for each hash in `settlements.all_hashes` |
| Agent X has reputation score N | `cast call <REPUTATION_REGISTRY> "getSummary(uint256,address[],string,string)(uint64,int128,uint8)" <tokenId> "[<platformAddr>]" "" ""` |
| Platform fee was paid | `https://testnet.arcscan.app/address/<PLATFORM_WALLET_ADDRESS>` — check incoming transfers |
| Gas cost is accurate | Query `payment_intents.gas_cost_usdc` — reproducible from `gas_used × gas_price / 10^6` using `eth_getTransactionReceipt` |

---

## 14. What Makes This Different

| Claim | CrewAI / AutoGen | SwarmPay |
|---|---|---|
| Agents have wallets | ❌ | ✅ Real Circle USDC wallets on Arc |
| Payments are real | ❌ | ✅ Real on-chain txHash per payment |
| Agent identity is on-chain | ❌ | ✅ ERC-8004 NFT on Sepolia |
| Reputation is trustless | ❌ | ✅ ERC-8004 Reputation Registry |
| Micropayments are viable | ❌ ($31.50 gas on ETH) | ✅ $0.0006 total gas on Arc |
| Payment authorization is cryptographic | ❌ | ✅ EIP-712 + ECDSA recovery |
| Replay attacks prevented | N/A | ✅ Nonce + DB unique index |
| Budget enforcement is pre-flight | N/A | ✅ Balance check before Circle call |
