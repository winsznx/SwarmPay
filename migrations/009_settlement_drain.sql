-- ============================================================
-- 009 — Stateless settlement drain support
--
-- Why this exists:
--   The previous settlement queue lived in-memory in a Node Map.
--   On Vercel serverless, the function that armed the queue returns
--   its response and the runtime tears down — the queue dies with
--   it. Settlements stayed in `pending` forever; UI showed 0/N
--   confirmations indefinitely.
--
--   New architecture: queue state lives in `payment_intents.status`.
--   A self-recursing /api/settlement/drain endpoint pulls a bounded
--   batch, processes it within the function timeout, and dispatches
--   the next drain if work remains. Multiple concurrent drains are
--   safe because this RPC atomically claims a batch via the standard
--   "UPDATE ... RETURNING from CTE with FOR UPDATE SKIP LOCKED"
--   distributed-worker pattern.
--
--   On status='pending' rows: claim them by promoting to 'signed'
--   (semantically: x402 intent has been signed, on-chain confirmation
--   is in flight). On success the drain writes 'settled'; on
--   permanent failure 'failed'; on transient retryable error the
--   drain writes back to 'pending' with retry_count++.
--
-- Idempotent. BEGIN/COMMIT wrapped. Functions use SECURITY DEFINER
-- with locked search_path (CVE-defensive). Ends with NOTIFY pgrst.
-- ============================================================

BEGIN;

-- Index supporting fast claim queries: pending rows for a given task,
-- ordered by created_at, with retry_count cap. Partial index keeps it
-- small even at scale.
CREATE INDEX IF NOT EXISTS idx_payment_intents_pending_by_task
  ON payment_intents (task_id, created_at)
  WHERE status = 'pending';

-- ────────────────────────────────────────────────────────────
-- claim_pending_intents(p_task_id, p_limit)
--
--   Atomically claims up to p_limit pending intents for the given
--   task. Promotes each to status='signed' and returns the claimed
--   rows. SKIP LOCKED ensures concurrent drains never compete for
--   the same row.
--
--   Returns: id, from_agent_id, to_agent_id, amount, retry_count
--
--   Caller is then responsible for processing each row and writing
--   the terminal status ('settled' or 'failed') back via direct UPDATE.
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS claim_pending_intents(UUID, INTEGER);
CREATE OR REPLACE FUNCTION claim_pending_intents(
  p_task_id UUID,
  p_limit   INTEGER DEFAULT 8
) RETURNS TABLE (
  id            UUID,
  from_agent_id TEXT,
  to_agent_id   TEXT,
  amount        NUMERIC,
  retry_count   INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT pi.id
      FROM payment_intents pi
     WHERE pi.task_id     = p_task_id
       AND pi.status      = 'pending'
       AND pi.retry_count < 4
     ORDER BY pi.created_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE payment_intents pi
     SET status = 'signed'
    FROM claimed
   WHERE pi.id = claimed.id
  RETURNING pi.id, pi.from_agent_id, pi.to_agent_id, pi.amount, pi.retry_count;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- count_pending_intents(p_task_id)
--   Cheap count of remaining drainable rows. Drain endpoint uses this
--   to decide whether to dispatch a follow-up drain invocation.
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS count_pending_intents(UUID);
CREATE OR REPLACE FUNCTION count_pending_intents(p_task_id UUID)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER
    FROM payment_intents
   WHERE task_id     = p_task_id
     AND status      = 'pending'
     AND retry_count < 4;
$$;

-- ────────────────────────────────────────────────────────────
-- release_intent_to_pending(p_intent_id, p_error_message)
--   Releases a claimed (status='signed') intent back to 'pending'
--   with retry_count++. Used by the drain when a Circle call hits
--   a transient error (429, network) and we want it picked up again.
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS release_intent_to_pending(UUID, TEXT);
CREATE OR REPLACE FUNCTION release_intent_to_pending(
  p_intent_id UUID,
  p_error_message TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE payment_intents
     SET status        = 'pending',
         retry_count   = retry_count + 1,
         error_message = p_error_message
   WHERE id = p_intent_id
     AND status = 'signed';
END;
$$;

-- Refresh PostgREST so the new RPCs are visible immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
