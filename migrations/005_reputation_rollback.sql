BEGIN;

DROP FUNCTION IF EXISTS reputation_apply_delta(TEXT, UUID, INTEGER, TEXT);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE reputation_events;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DROP TABLE IF EXISTS reputation_events CASCADE;

ALTER TABLE agents DROP COLUMN IF EXISTS tasks_failed;
ALTER TABLE agents DROP COLUMN IF EXISTS success_rate;

COMMIT;
