-- ============================================================
-- 008 — Defensive RPC re-creation + PostgREST schema reload
--
-- Why this exists:
--   /api/escrow/hold is returning 503 in prod with PostgREST error
--   "Could not find the function public.escrow_hold(...) in the schema
--   cache". Migrations 002 / 005 / 006 already define these functions,
--   so the failure is one of:
--     (a) a prior migration failed silently and these never registered
--     (b) PostgREST's schema cache is stale — Supabase caches function
--         signatures and won't see new definitions until reload
--     (c) functions exist but lack SECURITY DEFINER, blocking calls
--         under restrictive RLS contexts
--
-- This migration is the surgical fix for all three cases:
--   - DROP FUNCTION IF EXISTS first, so signature drift can't keep an
--     old shape around
--   - CREATE OR REPLACE with SECURITY DEFINER + locked search_path
--     (CVE-defensive — prevents search-path-based privilege escalation)
--   - NOTIFY pgrst, 'reload schema' at the end forces PostgREST to
--     re-read pg_proc immediately
--
-- Apply order: AFTER all of 001–007. Self-contained — does not depend
-- on any specific prior-migration state beyond the underlying tables
-- existing (which 002, 005, 006 created).
--
-- Idempotent: safe to re-run.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- Escrow RPCs (originally in 006_escrow.sql)
-- Signatures must match call sites:
--   src/app/api/escrow/hold/route.ts    rpc('escrow_hold',    {p_user_id, p_task_id, p_amount})
--   src/app/api/escrow/spend/route.ts   rpc('escrow_spend',   {p_hold_id, p_amount})
--   src/app/api/escrow/release/route.ts rpc('escrow_release', {p_hold_id})
-- ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS escrow_hold(TEXT, UUID, NUMERIC);
CREATE OR REPLACE FUNCTION escrow_hold(
  p_user_id TEXT,
  p_task_id UUID,
  p_amount  NUMERIC
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance  NUMERIC;
  v_hold_id  UUID;
BEGIN
  -- Row-lock the wallet so concurrent holds can't race past the balance check
  SELECT balance INTO v_balance
    FROM user_wallets
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'user wallet not found: %', p_user_id;
  END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient balance: have %, need %', v_balance, p_amount;
  END IF;

  UPDATE user_wallets
     SET balance = balance - p_amount, updated_at = NOW()
   WHERE user_id = p_user_id;

  INSERT INTO escrow_holds (user_id, task_id, amount, status)
    VALUES (p_user_id, p_task_id, p_amount, 'held')
    RETURNING id INTO v_hold_id;

  RETURN v_hold_id;
END;
$$;

DROP FUNCTION IF EXISTS escrow_spend(UUID, NUMERIC);
CREATE OR REPLACE FUNCTION escrow_spend(
  p_hold_id UUID,
  p_amount  NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount NUMERIC;
  v_spent  NUMERIC;
BEGIN
  SELECT amount, spent INTO v_amount, v_spent
    FROM escrow_holds
   WHERE id = p_hold_id
   FOR UPDATE;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'escrow hold not found: %', p_hold_id;
  END IF;
  IF v_spent + p_amount > v_amount THEN
    RAISE EXCEPTION 'spend exceeds hold: % + % > %', v_spent, p_amount, v_amount;
  END IF;

  UPDATE escrow_holds SET spent = spent + p_amount WHERE id = p_hold_id;
  RETURN v_spent + p_amount;
END;
$$;

DROP FUNCTION IF EXISTS escrow_release(UUID);
CREATE OR REPLACE FUNCTION escrow_release(
  p_hold_id UUID
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id TEXT;
  v_amount  NUMERIC;
  v_spent   NUMERIC;
  v_refund  NUMERIC;
BEGIN
  SELECT user_id, amount, spent INTO v_user_id, v_amount, v_spent
    FROM escrow_holds
   WHERE id = p_hold_id
   FOR UPDATE;

  IF v_amount IS NULL THEN
    RAISE EXCEPTION 'escrow hold not found: %', p_hold_id;
  END IF;

  v_refund := v_amount - v_spent;

  UPDATE escrow_holds
     SET status = 'released', released_at = NOW()
   WHERE id = p_hold_id;

  IF v_refund > 0 THEN
    UPDATE user_wallets
       SET balance = balance + v_refund, updated_at = NOW()
     WHERE user_id = v_user_id;
  END IF;

  RETURN v_refund;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Settlement RPCs (originally in 002_settlement_progress.sql)
-- Signatures must match call sites:
--   src/lib/settlementQueue.ts rpc('settlement_record_confirmed', {p_task_id, p_tx_hash})
--   src/lib/settlementQueue.ts rpc('settlement_record_failed',    {p_task_id})
-- (settlements has a UNIQUE index on task_id from 002, so task_id is the
-- unambiguous lookup key — not settlement_id.)
-- ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS settlement_record_confirmed(UUID, TEXT);
CREATE OR REPLACE FUNCTION settlement_record_confirmed(p_task_id UUID, p_tx_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

DROP FUNCTION IF EXISTS settlement_record_failed(UUID);
CREATE OR REPLACE FUNCTION settlement_record_failed(p_task_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

-- ────────────────────────────────────────────────────────────
-- Reputation RPC (originally in 005_reputation.sql)
-- Signature must match call site:
--   src/lib/reputation.ts rpc('reputation_apply_delta',
--     {p_agent_id, p_task_id, p_delta, p_reason})
-- ────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS reputation_apply_delta(TEXT, UUID, INTEGER, TEXT);
CREATE OR REPLACE FUNCTION reputation_apply_delta(
  p_agent_id TEXT,
  p_task_id  UUID,
  p_delta    INTEGER,
  p_reason   TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before INTEGER;
  v_after  INTEGER;
BEGIN
  SELECT reputation INTO v_before
    FROM agents
   WHERE id = p_agent_id
   FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'agent not found: %', p_agent_id;
  END IF;

  v_after := GREATEST(0, LEAST(100, v_before + p_delta));

  INSERT INTO reputation_events
    (agent_id, task_id, delta, reason, reputation_before, reputation_after)
  VALUES
    (p_agent_id, p_task_id, p_delta, p_reason, v_before, v_after);

  UPDATE agents
     SET reputation = v_after,
         tasks_completed = tasks_completed
           + CASE WHEN p_reason IN ('subtask_success','orchestrator_success') THEN 1 ELSE 0 END,
         tasks_failed    = tasks_failed
           + CASE WHEN p_reason IN ('subtask_failure','orchestrator_failure') THEN 1 ELSE 0 END
   WHERE id = p_agent_id;

  UPDATE agents
     SET success_rate = CASE
       WHEN tasks_completed + tasks_failed = 0 THEN NULL
       ELSE ROUND(tasks_completed::NUMERIC / (tasks_completed + tasks_failed), 4)
     END
   WHERE id = p_agent_id;

  RETURN v_after;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- Force PostgREST to drop its function-signature cache and re-read
-- pg_proc immediately. This is THE fix for the "function not found in
-- schema cache" error if the functions already exist but PostgREST
-- hasn't seen them. Safe to run even when the cache is fresh.
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;
