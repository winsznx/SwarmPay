-- ============================================================
-- 002 — Settlement progress tracking
-- Adds the columns the new settlement queue (src/lib/settlementQueue.ts)
-- writes through. Expands settlements.status enum.
-- Idempotent. BEGIN/COMMIT wrapped.
-- ============================================================
BEGIN;

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS expected_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS confirmed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS failed_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS started_at      TIMESTAMPTZ;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS completed_at    TIMESTAMPTZ;
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS all_hashes      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- One settlement record per task. Required for the upsert(onConflict=task_id)
-- pattern in src/lib/settlementQueue.ts:startSettlement.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_settlements_task ON settlements(task_id);

-- Expand status enum: was ('pending','broadcast','confirmed','failed')
-- now ('pending','in_progress','complete','partial','failed')
-- 'broadcast' and 'confirmed' are dropped because the queue writes 'in_progress'
-- through the lifecycle and 'complete'/'partial' as terminal states.
ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_status_check;
ALTER TABLE settlements ADD  CONSTRAINT settlements_status_check
  CHECK (status IN ('pending','in_progress','complete','partial','failed'));

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS retry_count   INTEGER NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- RPC helpers used by the settlement queue. Atomic increments are
-- safer than read-modify-write for the high-frequency confirmation path.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION settlement_record_confirmed(p_task_id UUID, p_tx_hash TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE settlements
     SET confirmed_count = confirmed_count + 1,
         all_hashes      = array_append(all_hashes, p_tx_hash),
         status          = CASE
                             WHEN confirmed_count + 1 + failed_count >= expected_count
                                  AND failed_count = 0 THEN 'complete'
                             WHEN confirmed_count + 1 + failed_count >= expected_count
                                  AND failed_count > 0 THEN 'partial'
                             ELSE 'in_progress'
                           END,
         completed_at    = CASE
                             WHEN confirmed_count + 1 + failed_count >= expected_count
                             THEN NOW() ELSE completed_at
                           END
   WHERE task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION settlement_record_failed(p_task_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE settlements
     SET failed_count = failed_count + 1,
         status       = CASE
                          WHEN confirmed_count + failed_count + 1 >= expected_count
                               AND confirmed_count = 0 THEN 'failed'
                          WHEN confirmed_count + failed_count + 1 >= expected_count
                               AND confirmed_count > 0 THEN 'partial'
                          ELSE 'in_progress'
                        END,
         completed_at = CASE
                          WHEN confirmed_count + failed_count + 1 >= expected_count
                          THEN NOW() ELSE completed_at
                        END
   WHERE task_id = p_task_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
