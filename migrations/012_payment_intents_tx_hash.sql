-- ============================================================
-- 012 — Add tx_hash column to payment_intents
--
-- Why:
--   src/lib/circleWallets.ts:settleAllIntentsOnArc writes tx_hash on each
--   intent after the SettlementVault.settleBatch call confirms. Migration 004
--   added gas_used / gas_price / gas_cost_usdc / block_number on payment_intents
--   but never added tx_hash — the per-intent write was silently dropped (the
--   .update select succeeded but the column didn't exist), and any select that
--   included tx_hash failed entirely (PostgREST 42703).
--
--   This migration adds the column and backfills it for already-settled intents
--   by joining against the settlements row (one batch tx hash per task).
--
-- Idempotent. BEGIN/COMMIT wrapped.
-- ============================================================
BEGIN;

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS tx_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_payment_intents_tx_hash ON payment_intents(tx_hash) WHERE tx_hash IS NOT NULL;

-- Backfill: every settled intent gets the tx_hash of its task's settlement row.
UPDATE payment_intents pi
   SET tx_hash = s.tx_hash
  FROM settlements s
 WHERE pi.task_id = s.task_id
   AND pi.tx_hash IS NULL
   AND pi.status  = 'settled'
   AND s.tx_hash  IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
