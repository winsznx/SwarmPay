-- ============================================================
-- 004 — Real gas measurement
-- src/lib/gasMeasurement.ts fetches the Arc receipt for each confirmed
-- payment intent and writes gas_used / gas_price / gas_cost_usdc /
-- block_number. settlements.total_gas_cost is recomputed as the
-- per-task SUM via trigger.
-- ============================================================
BEGIN;

ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS gas_used      BIGINT;
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS gas_price     NUMERIC(38,0);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS gas_cost_usdc NUMERIC(18,9);
ALTER TABLE payment_intents ADD COLUMN IF NOT EXISTS block_number  BIGINT;

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS total_gas_cost NUMERIC(18,9);

-- Recompute settlements.total_gas_cost whenever a payment_intents row's
-- gas_cost_usdc lands. Safer than ad-hoc app-side sums.
CREATE OR REPLACE FUNCTION settlement_recompute_gas() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.gas_cost_usdc IS DISTINCT FROM OLD.gas_cost_usdc THEN
    UPDATE settlements
       SET total_gas_cost = (
         SELECT COALESCE(SUM(gas_cost_usdc), 0)
           FROM payment_intents
          WHERE task_id = NEW.task_id AND gas_cost_usdc IS NOT NULL
       )
     WHERE task_id = NEW.task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settlement_recompute_gas ON payment_intents;
CREATE TRIGGER trg_settlement_recompute_gas
  AFTER UPDATE OF gas_cost_usdc ON payment_intents
  FOR EACH ROW EXECUTE FUNCTION settlement_recompute_gas();

COMMIT;
