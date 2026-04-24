-- SwarmPay 2.1: Master Database Schema
-- Run this in your Supabase SQL Editor to initialize the protocol data layer.

-- 1. Agents Table
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  reputation NUMERIC(12,6) DEFAULT 90,
  balance NUMERIC(12,6) DEFAULT 0,
  total_earned NUMERIC(12,6) DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tasks Table (Root Missions & Sub-tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT DEFAULT 'user_1',
  prompt TEXT NOT NULL,
  budget NUMERIC(12,6) NOT NULL CHECK (budget >= 0),
  status TEXT NOT NULL,
  depth INTEGER DEFAULT 0,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  winning_bid_id TEXT, 
  assigned_agent_id TEXT REFERENCES agents(id),
  execution_valid BOOLEAN DEFAULT false,
  result JSONB,
  error_reason TEXT,
  cost_breakdown JSONB,
  stats JSONB,
  settlement JSONB,
  micropayment_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Protocol Integrity Constraint
  CONSTRAINT completed_task_must_be_valid CHECK (
    status != 'completed' OR (execution_valid = true AND winning_bid_id IS NOT NULL)
  )
);

-- 3. Bids Table
CREATE TABLE IF NOT EXISTS bids (
  id TEXT PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id),
  agent_name TEXT,
  price NUMERIC(12,6) NOT NULL CHECK (price >= 0),
  amount NUMERIC(12,6),
  confidence NUMERIC(12,6),
  strategy TEXT,
  reasoning TEXT,
  estimated_time_ms INTEGER,
  latency NUMERIC(12,6),
  reputation NUMERIC(12,6),
  status TEXT DEFAULT 'pending', -- 'pending', 'winner', 'rejected'
  submitted_at BIGINT
);

-- 4. Pipeline Steps (Audit Trail)
CREATE TABLE IF NOT EXISTS pipeline_steps (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. Wallet Transactions (Financial Audit)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'debit', 'credit', 'refund', 'earnings'
  amount NUMERIC(12,6) NOT NULL,
  balance_before NUMERIC(12,6),
  balance_after NUMERIC(12,6),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 6. Payment Intents (Micropayments)
CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  from_agent_id TEXT REFERENCES agents(id),
  from_agent_name TEXT,
  to_agent_id TEXT REFERENCES agents(id),
  to_agent_name TEXT,
  amount NUMERIC(12,6) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE
);

-- 7. Global Ledger (Simulated User Wallet)
CREATE TABLE IF NOT EXISTS global_config (
    key TEXT PRIMARY KEY,
    value JSONB
);

INSERT INTO global_config (key, value) 
VALUES ('user_wallet', '{"balance": 50.00}')
ON CONFLICT (key) DO NOTHING;
