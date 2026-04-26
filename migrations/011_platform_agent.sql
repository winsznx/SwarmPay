-- ============================================================
-- 011 — Seed the 'platform' pseudo-agent
--
-- Why:
--   src/lib/pipeline.ts phase 7 builds a platform-fee payment_intent
--   with `toAgentId: 'platform'` whenever PLATFORM_WALLET_ADDRESS is set.
--   payment_intents.to_agent_id has an FK to agents(id), so the insert
--   fails ("violates foreign key constraint payment_intents_to_agent_id_fkey")
--   unless an agent row with id='platform' exists.
--
--   This seeds that row. wallet_address is read from env at write time
--   by the pipeline; we don't need to seed it here. Other fields are
--   sentinel values that surface 'platform' clearly in the agents UI
--   if anyone enables it (and easy to filter out via role='platform').
--
-- Idempotent. BEGIN/COMMIT wrapped.
-- ============================================================

BEGIN;

INSERT INTO agents (id, name, role, reputation, balance, capabilities)
VALUES ('platform', 'SwarmPay Platform', 'platform', 100, 0, ARRAY['platform_fee_recipient'])
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';

COMMIT;
