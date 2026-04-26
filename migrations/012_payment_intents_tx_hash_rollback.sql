-- Rollback for 012_payment_intents_tx_hash.sql
BEGIN;
DROP INDEX IF EXISTS idx_payment_intents_tx_hash;
ALTER TABLE payment_intents DROP COLUMN IF EXISTS tx_hash;
NOTIFY pgrst, 'reload schema';
COMMIT;
