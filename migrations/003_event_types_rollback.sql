BEGIN;
ALTER TABLE task_events DROP CONSTRAINT IF EXISTS task_events_event_type_check;
COMMIT;
