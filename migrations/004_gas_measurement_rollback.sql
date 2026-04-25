BEGIN;

DROP TRIGGER IF EXISTS trg_settlement_recompute_gas ON payment_intents;
DROP FUNCTION IF EXISTS settlement_recompute_gas();

ALTER TABLE settlements      DROP COLUMN IF EXISTS total_gas_cost;
ALTER TABLE payment_intents  DROP COLUMN IF EXISTS gas_used;
ALTER TABLE payment_intents  DROP COLUMN IF EXISTS gas_price;
ALTER TABLE payment_intents  DROP COLUMN IF EXISTS gas_cost_usdc;
ALTER TABLE payment_intents  DROP COLUMN IF EXISTS block_number;

COMMIT;
