# SwarmPay — 90s Demo Script

Time-coded voiceover. Each beat names what's on screen so the recording can sync to the live demo.

---

## 00:00 – 00:10  ·  Hook

> "AI agents have wallets, but they don't have an economy. SwarmPay is the missing piece — production agent payment infrastructure on Arc."

**On screen:** Landing page hero, "THE AGENT ECONOMY · POWERED BY ARC" wordmark. Cursor moves to "LAUNCH MISSION CONTROL."

---

## 00:10 – 00:25  ·  Submission, escrow, bidding

> "I type a task. Approve a half-dollar budget. The user wallet drops by half a dollar — that's real escrow, held in a Postgres atomic transaction. The moment I approve, six agents pile into a bidding war."

**On screen:**
- Type *"Analyze top 5 DeFi protocols on Arc"* into the task input.
- BudgetModal appears. Click "Approve $0.50."
- Header wallet ticks down from $50.00 → $49.50 (Realtime sub on `user_wallets`).
- Six bid cards stagger in: CryptoScout-X, Research-Alpha, DataMiner-Pro, Parser-X, Analysis-Node, Compute-Grid-4. Each shows price, reputation badge, latency.
- Winner card flashes green.

---

## 00:25 – 00:40  ·  Sub-agent recursion, DAG

> "The winning agent decomposes the task into four sub-tasks and re-opens the market — sub-agents bid recursively. This is a marketplace all the way down."

**On screen:**
- Hybrid Execution Graph appears. Lead agent at top, four sub-tasks branching down.
- Sub-bids appear on each branch, winners highlighted.
- Click "Visualize DAG" — ReactFlow viewport shows the live tree, auto-centering on the executing node.

---

## 00:40 – 01:00  ·  Payment stream + compute meter

> "Watch the payment stream — every line you see is a real x402 handshake. Provider responds 402, consumer signs with their Circle wallet, settled on Arc as a real USDC transfer. While analysis runs, the compute meter bills per millisecond at $0.000001/ms — no fake numbers, the timer interpolates at 60fps between server ticks."

**On screen:**
- PaymentStream right column. **x402 Handshakes (live)** section shows triplets:
  - Yellow chip "402 Required"
  - Blue chip "Signed 0x82a7…b14c"
  - Green chip "Settled 0x4c19…a2f8" — link to `testnet.arcscan.app`.
- Multiple triplets stack as sub-agent calls fire.
- Compute Meter card pulses: CPU gauge fills, ms timer rolls, cost ticker ticks $0.000001 per ms.

---

## 01:00 – 01:15  ·  Settlement panel — live confirmations

> "The settlement panel shows 60 dots, one per payment intent. Each dot lights up green the moment Arc confirms the on-chain transfer. We're not batching anything — every single payment is a real on-chain USDC transfer. Click any dot, you land on Arc explorer with the real transaction."

**On screen:**
- SettlementAnimation panel. Counter ticks "X of 60 confirmed" live.
- Dots turn green in waves as Realtime updates land.
- Click a green dot → opens `https://testnet.arcscan.app/tx/0x...` in new tab → real transfer page on Arc explorer.
- Below: SettlementProof card showing measured gas total ("$0.0274") and the first 5 txHashes as clickable links.

---

## 01:15 – 01:30  ·  Why Arc + close

> "Sixty real on-chain transfers. Twenty-seven cents of gas, measured per-tx from real Arc receipts — not a hardcoded constant. On Ethereum that's thirty dollars. On Polygon it eats the budget. Per-action agent commerce only works on Arc, and SwarmPay is the production infrastructure that proves it."

**On screen:**
- Why Arc card visible: ETH $30 / Polygon $0.60 / Arc $0.027.
- Sub-line emphasizes "60 × ~$0.00045 measured per tx."
- Cut to /agents page: leaderboard updates in real time, reputation deltas pop in (+3 for orchestrator on success).
- Final beat: closing line.

> "Per-action agent economies. Production-ready. On Arc."

---

## Recording notes

- **Browser:** Use a fresh incognito window so cached wallet balance doesn't pre-load.
- **Window size:** 1440×900 — comfortable margins for full-screen recording without mobile responsive kicking in.
- **Tab strip hidden:** open the demo in app mode (`open -a "Google Chrome" --args --app=https://swarm-pay.vercel.app`) to crop the URL bar out.
- **Pre-warm:** hit `/api/agents` and `/api/health` once before recording so the first task's wallet creation doesn't introduce 2–3s latency on screen.
- **Backup hash:** if a confirmation hash you click doesn't load on `testnet.arcscan.app` instantly, have one of these as a fallback to demonstrate the explorer integration: `0xca6064e390b88e0ef98dddd7265d8dcdd82591ed34de3d2bbfc1dbe9714862b8`, `0x9e97becb478f184472b91571a2354e8ac0c142c03166b7ef9bc9796cb8e720a8`, `0x8db90a6da0a34476d5820092b8231553a44f811be8cfca842820e75e737fad44`.
