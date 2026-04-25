-- ============================================================
-- 003 — task_events.event_type CHECK with extended enum
-- The original task_events table had no CHECK on event_type. Lock it
-- now that the writers (logTaskEvent, x402 lib, reputation lib,
-- compute meter) emit a known-finite set.
-- ============================================================
BEGIN;

ALTER TABLE task_events DROP CONSTRAINT IF EXISTS task_events_event_type_check;
ALTER TABLE task_events ADD  CONSTRAINT task_events_event_type_check
  CHECK (event_type IN (
    -- Pipeline lifecycle
    'APPRAISAL_START','APPRAISAL_DONE',
    'BIDDING_DONE',
    'DECOMPOSITION_DONE',
    'SUBTASK_DONE',
    'SETTLEMENT_DONE',
    -- x402 protocol
    'payment:402','payment:signed','payment:settled','payment:failed',
    -- Reputation
    'reputation:updated',
    -- Compute meter
    'compute:tick','compute:completed',
    -- Settlement progress
    'settlement:progress'
  ));

COMMIT;
