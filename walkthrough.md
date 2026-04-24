# SwarmPay Implementation Walkthrough

This document provides a step-by-step guide on how SwarmPay was architected and implemented for the **Agentic Economy on Arc** hackathon.

### 1. Vision & Track Alignment
SwarmPay was built for the **Agent-to-Agent Payment Loop** track. 
**The Goal:** Prove that an autonomous swarm of agents can perform complex work while paying each other in real-time, which is only economically viable on **Arc** due to sub-cent gas fees.

### 2. Architecture: The 4-Phase Mission Lifecycle
We implemented a strict linear pipeline in `src/lib/pipeline.ts`:

*   **Phase 0: Intelligence Appraisal (OpenAI GPT-4o)**
    *   The orchestrator analyzes the user's prompt to determine "Mission Complexity."
    *   It determines which of the 6 specialized agents are required and sets a complexity-aware minimum budget ($0.05 - $0.30).
*   **Phase 1: Automated Bidding War**
    *   Agents receive the task details and submit competitive bids (managed in `src/lib/store/index.ts`).
    *   The UI renders this as a real-time "war" where agents update their pricing based on current node availability.
*   **Phase 2: Winning Bid Selection**
    *   The system ranks bids based on a multi-factor score: **Price × Reputation × Fast Latency**.
    *   The winner is assigned as the "Lead Orchestrator" for that specific mission.
*   **Phase 3: Parallel Execution & Nanopayments**
    *   The Lead Agent decomposes the task into 4 atomic sub-tasks (Research, Cleaning, Analysis, Compute).
    *   **High-Frequency Intent Loop:** For every thought or data retrieval, agents emit **x402-style payment intents**.
    *   We simulate/execute 50-65 intents per mission to prove frequency.
*   **Phase 4: Arc Settlement (Circle Wallets)**
    *   All intents are aggregated and settled on the **Arc Testnet** using Circle Developer-Controlled Wallets.
    *   The real on-chain transaction hash is verified and displayed to the user.

### 3. Key Technical Implementations

#### A. Multi-LLM Resilient Intelligence (`src/lib/execution.ts`)
*   We use **Gemini 2.0 Flash** (and prepared for Gemini 3) for the deep analysis sub-tasks.
*   We implemented an **Automatic Groq Fallback** (Llama 3.3 70B) so the demo never hangs if one provider rate-limits.

#### B. Stable Nanopayment Stream (`src/hooks/useWebSocket.ts`)
*   Building for Vercel required overcoming "Serverless Isolation." 
*   We implemented a **Dual-Mode Sync**:
    1.  **Real-time SSE:** For instant local feedback.
    2.  **Supabase Polling Fallback:** Ensures the 50+ payment feed populates reliably on the Vercel deployed URL.

#### C. Smart Economic Engine
*   Implemented "Complexity-Aware Budgeting" in the `TaskInput` UI.
*   Ensures users can't launch complex missions with insufficient funds, protecting agent margins.

### 4. What we did Right (Judging Criteria)
*   **Economic Proof:** We explicitly proved that 63 payments ($0.31 gas on Arc) is 10,500x cheaper than Ethereum, making the model "Economically Viable."
*   **Arc Integration:** Every mission ends with a real **Arc Testnet Hash**.
*   **Aesthetics:** High-fidelity "Mission Control" dashboard that feels futuristic and professional.

### 5. Remaining Gaps (`gaps.md`)
We documented the transition from a volatile `MemoryStore` to a full Pub/Sub architecture as the primary technical gap for the production roadmap.
