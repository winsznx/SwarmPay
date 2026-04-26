# SwarmPay — Demo voiceover

Final voiceover script. Bracketed lines are stage directions for the screen recording. Estimated total runtime: **65–75 seconds** at unhurried pace.

---

## 00:00 – 00:08  ·  Open

> "SwarmPay. Six AI agents bid in real-time auctions and settle 60-plus USDC micropayments per task in one atomic on-chain transaction on Arc."

**On screen:** Dashboard loaded. Right sidebar shows the agent registry — 6 cards.

---

## 00:08 – 00:20  ·  Agent registry

> "Each agent here is an ERC-721 NFT on the Arc testnet, registered on the ERC-8004 Identity Registry. Their Circle wallets are bound on-chain via EIP-712. Independently verifiable."

**On screen:** Hover/highlight the right sidebar — each agent card shows truncated wallet address, balance USDC, settled-tx count, earned amount, reputation badge.

---

## 00:20 – 00:35  ·  Submit + bidding war

> "[click into the chat input, type a prompt, hit Launch Mission]"
>
> "Watch the bidding war. Six agents compete on reputation. Winner takes the task and runs its own bidding war for sub-agents. Recursive marketplaces."

**On screen:** Type prompt → BudgetModal → approve → bidding war animates (6 cards stagger in, prices and reputation visible) → winner highlighted → DAG appears with sub-task bidding under each branch.

---

## 00:35 – 00:50  ·  Settlement panel

> "[wait for task to complete, scroll to settlement panel]"
>
> "Every subtask micropayment is real. EIP-712 signed by the agent's bound wallet, verified on-chain via the Identity Registry. Sixty-plus payments for this task — settled atomically in ONE Arc transaction via our SettlementVault contract. Click the hash —"

**On screen:** Settlement panel showing N/N confirmed dots green, single batch tx hash, total measured gas (~$0.0006), batch size (60+).

---

## 00:50 – 01:00  ·  Arc verification

> "[click one of the txhash links, arcscan opens]"
>
> "— real Arc transaction. Sixty-plus PaymentSettled events on a single block. Sub-second finality. The SettlementVault holds agents' pre-deposited USDC; agents withdraw at any time. Atomic — all payments succeed or none do."

**On screen:** New browser tab opens to `testnet.arcscan.app/tx/0x...` showing the real transfer with status: success, real from/to addresses matching agent wallets, block number, gas in USDC.

---

## 01:00 – 01:10  ·  Reputation back on-chain

> "[scroll back, scroll past the cost breakdown]"
>
> "Reputation goes back on-chain after settlement. Validator EOA writes feedback to the ERC-8004 Reputation Registry, anti-self-dealing per spec."

**On screen:** Cost breakdown card visible briefly, then scroll past to where reputation deltas pop on the agent cards (`+3 REP` for orchestrator, `+1 REP` for sub-agents) via the Realtime sub.

---

## 01:10 – 01:15  ·  Close

> "This is what the agent economy looks like when you build the trust layer properly. SwarmPay. Solo on Arc with Circle."

**On screen:** Hold on the dashboard with reputation deltas still visible.

---

## Recording notes

- **Browser:** Fresh incognito window so cached wallet balance doesn't pre-load.
- **Window size:** 1440×900 — comfortable margins for full-screen recording without mobile responsive kicking in.
- **App mode (URL bar hidden):**
  ```bash
  open -a "Google Chrome" --args --app=https://swarm-pay.vercel.app
  ```
- **Pre-warm:** hit `/api/agents` and `/api/health` once before recording so the first task's wallet creation doesn't introduce 2–3s latency on screen.
- **Accuracy guarantees** — every claim in the voiceover is grounded in shipped code:
  - "ERC-721 NFT on Arc testnet, ERC-8004 Identity Registry" → contracts at `0x8004A818BFB912233c491871b3d84c89A494BD9e` (identity), `0x8004B663056A597Dffe9eCcC1965A193B7388713` (reputation), 6 agents with tokenIds 2642–2647
  - "Circle wallets bound on-chain via EIP-712" → `bindAgentWallet()` in [src/lib/erc8004.ts](../src/lib/erc8004.ts)
  - "EIP-712 signed by the agent's bound wallet, verified on-chain via the Identity Registry" → two-layer verify in [src/lib/x402.ts:verifyPaymentIntent](../src/lib/x402.ts) (ECDSA recovery + `verifyAgentIdentityOnChain`)
  - "Real Arc transaction, atomic batch settlement" → `SettlementVault` at [`0xc04DA4613F89ED2d48835654799308C206884060`](https://testnet.arcscan.app/address/0xc04DA4613F89ED2d48835654799308C206884060). Proven settleBatch txs (each lands 65 micropayments visible on the Token Transfers tab):
    - [`0xe6372add35e0…42f62a9`](https://testnet.arcscan.app/tx/0xe6372add35e0cad4a3254c9f5a5147ae5afd2a73159e706808e85670e42f62a9?tab=token_transfers) (block 39,139,977 · $0.016 gas)
    - [`0xd69a57852bdb…1ce60a`](https://testnet.arcscan.app/tx/0xd69a57852bdb0d0d52b2a39f42a0c4533f805dc297b8cffbdcd76f5b581ce60a?tab=token_transfers) (block 39,130,201 · $0.016 gas)
    - [`0x0faa707be852…dbcf783`](https://testnet.arcscan.app/tx/0x0faa707be8526cbb231558d802c20e6aa011adc7354fb5224d0bb1493dbcf783?tab=token_transfers) (block 39,127,797 · $0.0076 gas)
  - "SettlementVault custody + atomic settleBatch" → `contracts/SettlementVault.sol` deployed via `scripts/deploy-vault.ts`; 6 agents pre-funded via `scripts/bootstrap-vault.ts` ($2.00 each = $12 escrow). The contract debits `balances[from]` and forwards real native USDC to the recipient address per payment, all-or-nothing.
  - "Validator EOA writes feedback, anti-self-dealing per spec" → `getValidatorSigner()` (separate from `getPlatformSigner()`) in [src/lib/erc8004.ts](../src/lib/erc8004.ts), called by [src/lib/reputation.ts:updateAfterTask](../src/lib/reputation.ts) fire-and-forget after Postgres update
  - "Recursive marketplaces" → `runSubTaskBidding` in [src/lib/pipeline.ts](../src/lib/pipeline.ts) opens a fresh sub-market per sub-task
- **Backup tx hash** if your live click doesn't load instantly: [`0xe6372add35e0…42f62a9`](https://testnet.arcscan.app/tx/0xe6372add35e0cad4a3254c9f5a5147ae5afd2a73159e706808e85670e42f62a9?tab=token_transfers) — 65 atomic micropayments, single block.
