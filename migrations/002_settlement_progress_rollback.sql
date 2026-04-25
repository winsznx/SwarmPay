-- Reverse migrations/002_settlement_progress.sql
BEGIN;

DROP FUNCTION IF EXISTS settlement_record_confirmed(UUID, TEXT);
DROP FUNCTION IF EXISTS settlement_record_failed(UUID);

ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_status_check;
ALTER TABLE settlements ADD  CONSTRAINT settlements_status_check
  CHECK (status IN ('pending','broadcast','confirmed','failed'));

ALTER TABLE settlements DROP COLUMN IF EXISTS expected_count;
ALTER TABLE settlements DROP COLUMN IF EXISTS confirmed_count;
ALTER TABLE settlements DROP COLUMN IF EXISTS failed_count;
ALTER TABLE settlements DROP COLUMN IF EXISTS started_at;
ALTER TABLE settlements DROP COLUMN IF EXISTS completed_at;
ALTER TABLE settlements DROP COLUMN IF EXISTS all_hashes;

DROP INDEX IF EXISTS uniq_settlements_task;

ALTER TABLE payment_intents DROP COLUMN IF EXISTS error_message;
ALTER TABLE payment_intents DROP COLUMN IF EXISTS retry_count;

COMMIT;
