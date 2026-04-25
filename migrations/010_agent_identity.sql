-- ============================================================
-- 010 — Agent on-chain identity + payment intent audit trail
--
-- Why this exists:
--   Agents were string IDs with no verifiable on-chain footprint.
--   Judges cannot confirm an agent exists on-chain without knowing
--   its EVM wallet address. This migration adds:
--
--   1. agents.wallet_address       — the 0x address on Arc, fetched
--                                    from Circle API at boot time.
--   2. agents.last_balance_usdc    — last known USDC balance, kept
--                                    fresh by the agents API.
--   3. agents.last_balance_synced_at — when the balance was last read.
--
--   4. payment_intents.nonce       — x402 anti-replay nonce.
--   5. payment_intents.signature   — EIP-191 personal_sign hex sig
--                                    from Circle for each payment.
--   6. payment_intents.signer_address — recovered signer address.
--
--   7. Unique index on (task_id, nonce) prevents x402 replay:
--      the same nonce cannot be submitted twice for the same task.
--
-- Idempotent. BEGIN/COMMIT wrapped.
-- ============================================================

BEGIN;

-- ── 1. Agent on-chain identity columns ───────────────────────

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS wallet_address         TEXT,
  ADD COLUMN IF NOT EXISTS last_balance_usdc      NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS last_balance_synced_at TIMESTAMPTZ,
  -- ERC-8004 Identity Registry (Sepolia) tokenId for this agent.
  -- uint256 stored as TEXT to avoid numeric precision loss.
  -- Lookup: getAgentWallet(<erc8004_token_id>) on Sepolia returns wallet_address.
  ADD COLUMN IF NOT EXISTS erc8004_token_id       TEXT,
  -- Hash of the registration tx on Sepolia — judges can verify on etherscan.
  ADD COLUMN IF NOT EXISTS erc8004_register_tx    TEXT,
  -- Hash of the setAgentWallet tx on Sepolia — proves the wallet binding.
  ADD COLUMN IF NOT EXISTS erc8004_bind_tx        TEXT;

-- ── 2. Payment intent cryptographic audit trail ───────────────

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS nonce          TEXT,
  ADD COLUMN IF NOT EXISTS signature      TEXT,
  ADD COLUMN IF NOT EXISTS signer_address TEXT;

-- ── 3. Anti-replay index: one nonce per task ──────────────────
-- Partial index: only enforces uniqueness when nonce is present.
-- Legacy rows (nonce IS NULL) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_nonce_task
  ON payment_intents (task_id, nonce)
  WHERE nonce IS NOT NULL;

-- ── 4. Fast agent address lookup ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agents_wallet_address
  ON agents (wallet_address)
  WHERE wallet_address IS NOT NULL;

-- Refresh PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

COMMIT;
