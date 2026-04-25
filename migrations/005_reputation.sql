-- ============================================================
-- 005 — Reputation system
-- agents.reputation already exists (B.1). Adds tasks_failed and a
-- computed success_rate column. Audit trail via reputation_events.
-- ============================================================
BEGIN;

ALTER TABLE agents ADD COLUMN IF NOT EXISTS tasks_failed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS success_rate NUMERIC(5,4);

CREATE TABLE IF NOT EXISTS reputation_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          TEXT NOT NULL REFERENCES agents(id),
  task_id           UUID REFERENCES tasks(id),
  delta             INTEGER NOT NULL,
  reason            TEXT NOT NULL CHECK (reason IN (
                      'subtask_success','subtask_failure',
                      'orchestrator_success','orchestrator_failure'
                    )),
  reputation_before INTEGER,
  reputation_after  INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reputation_events_agent_created
  ON reputation_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reputation_events_task
  ON reputation_events(task_id);

ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on reputation_events" ON reputation_events;
CREATE POLICY "Allow all on reputation_events"
  ON reputation_events FOR ALL USING (TRUE) WITH CHECK (TRUE);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reputation_events;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Atomic reputation update. Single transaction: clamp delta, write
-- audit row, update agents row. Used by src/lib/reputation.ts.
CREATE OR REPLACE FUNCTION reputation_apply_delta(
  p_agent_id TEXT,
  p_task_id  UUID,
  p_delta    INTEGER,
  p_reason   TEXT
) RETURNS INTEGER AS $$
DECLARE
  v_before INTEGER;
  v_after  INTEGER;
BEGIN
  SELECT reputation INTO v_before FROM agents WHERE id = p_agent_id FOR UPDATE;
  IF v_before IS NULL THEN
    RAISE EXCEPTION 'agent not found: %', p_agent_id;
  END IF;

  v_after := GREATEST(0, LEAST(100, v_before + p_delta));

  INSERT INTO reputation_events
    (agent_id, task_id, delta, reason, reputation_before, reputation_after)
  VALUES
    (p_agent_id, p_task_id, p_delta, p_reason, v_before, v_after);

  UPDATE agents
     SET reputation = v_after,
         tasks_completed = tasks_completed
           + CASE WHEN p_reason IN ('subtask_success','orchestrator_success') THEN 1 ELSE 0 END,
         tasks_failed    = tasks_failed
           + CASE WHEN p_reason IN ('subtask_failure','orchestrator_failure') THEN 1 ELSE 0 END
   WHERE id = p_agent_id;

  -- Recompute success_rate
  UPDATE agents
     SET success_rate = CASE
       WHEN tasks_completed + tasks_failed = 0 THEN NULL
       ELSE ROUND(tasks_completed::NUMERIC / (tasks_completed + tasks_failed), 4)
     END
   WHERE id = p_agent_id;

  RETURN v_after;
END;
$$ LANGUAGE plpgsql;

COMMIT;
