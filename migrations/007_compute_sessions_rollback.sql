BEGIN;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE compute_sessions;
EXCEPTION WHEN undefined_object THEN NULL; END $$;
DROP TABLE IF EXISTS compute_sessions CASCADE;
COMMIT;
