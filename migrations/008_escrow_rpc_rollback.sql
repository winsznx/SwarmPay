-- Reverse migrations/008_escrow_rpc.sql
--
-- WARNING: dropping these functions will break the live API routes that
-- depend on them (escrow + settlement + reputation). Only run if you're
-- also reverting the matching code OR if you intend to re-create them
-- via 002 / 005 / 006 immediately after.
BEGIN;

DROP FUNCTION IF EXISTS reputation_apply_delta(TEXT, UUID, INTEGER, TEXT);
DROP FUNCTION IF EXISTS settlement_record_failed(UUID);
DROP FUNCTION IF EXISTS settlement_record_confirmed(UUID, TEXT);
DROP FUNCTION IF EXISTS escrow_release(UUID);
DROP FUNCTION IF EXISTS escrow_spend(UUID, NUMERIC);
DROP FUNCTION IF EXISTS escrow_hold(TEXT, UUID, NUMERIC);

NOTIFY pgrst, 'reload schema';

COMMIT;
