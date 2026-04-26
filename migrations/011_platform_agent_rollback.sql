-- Rollback for 011_platform_agent.sql.
-- Removes the seeded 'platform' agent only if no payment_intents reference it.
-- If there are FK references, this will fail rather than orphan rows — re-run
-- after settling/deleting the referencing intents.
BEGIN;

DELETE FROM agents WHERE id = 'platform';

COMMIT;
