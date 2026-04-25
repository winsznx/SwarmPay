-- ============================================================
-- 007 — Compute sessions
-- Per-millisecond compute billing surface. The pipeline emits
-- compute:tick / compute:completed events into task_events; this
-- table is the durable session record the meter UI reads.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS compute_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  subtask_id     UUID REFERENCES subtasks(id) ON DELETE SET NULL,
  agent_id        TEXT REFERENCES agents(id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_ms     INTEGER,
  total_cost_usdc NUMERIC(18,9),
  cpu_samples     JSONB DEFAULT '[]'::JSONB
);
CREATE INDEX IF NOT EXISTS idx_compute_sessions_task ON compute_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_compute_sessions_subtask ON compute_sessions(subtask_id);

ALTER TABLE compute_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on compute_sessions" ON compute_sessions;
CREATE POLICY "Allow all on compute_sessions"
  ON compute_sessions FOR ALL USING (TRUE) WITH CHECK (TRUE);

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE compute_sessions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
