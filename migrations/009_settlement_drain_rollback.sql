-- Reverse migrations/009_settlement_drain.sql
BEGIN;

DROP FUNCTION IF EXISTS release_intent_to_pending(UUID, TEXT);
DROP FUNCTION IF EXISTS count_pending_intents(UUID);
DROP FUNCTION IF EXISTS claim_pending_intents(UUID, INTEGER);

DROP INDEX IF EXISTS idx_payment_intents_pending_by_task;

NOTIFY pgrst, 'reload schema';

COMMIT;
