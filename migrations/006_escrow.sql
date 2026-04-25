-- ============================================================
-- 006 — Real escrow
-- user_wallets is the source of truth for the demo user balance
-- (replaces the in-memory store.userWallet). escrow_holds tracks
-- held / spent / refunded amounts per task.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS user_wallets (
  user_id    TEXT PRIMARY KEY,
  balance    NUMERIC(18,9) NOT NULL DEFAULT 50.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS escrow_holds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES user_wallets(user_id),
  task_id     UUID REFERENCES tasks(id),
  amount      NUMERIC(18,9) NOT NULL CHECK (amount > 0),
  spent       NUMERIC(18,9) NOT NULL DEFAULT 0 CHECK (spent >= 0),
  status      TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held','released','refunded','failed')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CONSTRAINT spent_le_amount CHECK (spent <= amount)
);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_user ON escrow_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_task ON escrow_holds(task_id);

ALTER TABLE user_wallets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_holds  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on user_wallets" ON user_wallets;
CREATE POLICY "Allow all on user_wallets" ON user_wallets FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow all on escrow_holds" ON escrow_holds;
CREATE POLICY "Allow all on escrow_holds" ON escrow_holds FOR ALL USING (TRUE) WITH CHECK (TRUE);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_wallets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE escrow_holds;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default user (matches src/lib/store/index.ts default user_id)
INSERT INTO user_wallets (user_id, balance) VALUES ('user_1', 50.00)
ON CONFLICT (user_id) DO NOTHING;

-- Atomic escrow operations
CREATE OR REPLACE FUNCTION escrow_hold(
  p_user_id TEXT,
  p_task_id UUID,
  p_amount  NUMERIC
) RETURNS UUID AS $$
DECLARE
  v_balance  NUMERIC;
  v_hold_id  UUID;
BEGIN
  SELECT balance INTO v_balance FROM user_wallets WHERE user_id = p_user_id FOR UPDATE;
  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'user wallet not found: %', p_user_id;
  END IF;
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient balance: have %, need %', v_balance, p_amount;
  END IF;
  UPDATE user_wallets SET balance = balance - p_amount, updated_at = NOW()
   WHERE user_id = p_user_id;
  INSERT INTO escrow_holds (user_id, task_id, amount, status)
    VALUES (p_user_id, p_task_id, p_amount, 'held')
    RETURNING id INTO v_hold_id;
  RETURN v_hold_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION escrow_spend(
  p_hold_id UUID,
  p_amount  NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_amount NUMERIC;
  v_spent  NUMERIC;
BEGIN
  SELECT amount, spent INTO v_amount, v_spent
    FROM escrow_holds WHERE id = p_hold_id FOR UPDATE;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'escrow hold not found: %', p_hold_id; END IF;
  IF v_spent + p_amount > v_amount THEN
    RAISE EXCEPTION 'spend exceeds hold: % + % > %', v_spent, p_amount, v_amount;
  END IF;
  UPDATE escrow_holds SET spent = spent + p_amount WHERE id = p_hold_id;
  RETURN v_spent + p_amount;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION escrow_release(
  p_hold_id UUID
) RETURNS NUMERIC AS $$
DECLARE
  v_user_id TEXT;
  v_amount  NUMERIC;
  v_spent   NUMERIC;
  v_refund  NUMERIC;
BEGIN
  SELECT user_id, amount, spent INTO v_user_id, v_amount, v_spent
    FROM escrow_holds WHERE id = p_hold_id FOR UPDATE;
  IF v_amount IS NULL THEN RAISE EXCEPTION 'escrow hold not found: %', p_hold_id; END IF;
  v_refund := v_amount - v_spent;
  UPDATE escrow_holds
     SET status = 'released', released_at = NOW()
   WHERE id = p_hold_id;
  IF v_refund > 0 THEN
    UPDATE user_wallets SET balance = balance + v_refund, updated_at = NOW()
     WHERE user_id = v_user_id;
  END IF;
  RETURN v_refund;
END;
$$ LANGUAGE plpgsql;

COMMIT;
