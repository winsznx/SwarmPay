/**
 * SwarmPay Core Types
 * Upgraded for Phase 5: Autonomous Agent Economy
 */

export type TaskStatus = 'open' | 'pending' | 'bidding' | 'assigned' | 'executing' | 'settling' | 'completed' | 'failed';

export type AgentRole = 'research-agent' | 'planning-agent' | 'execution-agent' | 'validation-agent' | 'orchestrator';

export interface ExecutionResult {
  result: string;
  confidence: number;   // 0–1
  cost: number;         // simulated cost
  metadata?: Record<string, any>;
}

export interface AgentMemory {
  pastTasks: string[];   // titles/prompts
  pastResults: string[]; // brief summaries
  successCount: number;
  failureCount: number;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  taskId: string;
  content: string;
  createdAt: number;
}

export interface CostBreakdown {
  research: number;
  compute: number;
  analysis: number;
  agentMargins: number;
  platformFee: number;
  totalPayments: number;
  totalCost: number;
  userBudget: number;
  userSavings: number;
}

export interface Task {
  id: string;
  userId: string;
  prompt: string;
  budget: number;
  status: TaskStatus;
  winningBid: string | null;
  assignedAgentId: string | null;
  subTaskIds: string[];
  depth: number;                // Max depth = 3 in Phase 5
  result: ExecutionResult | null;
  costBreakdown: CostBreakdown;
  parentTaskId?: string;
  createdAt: number;
  completedAt: number | null;
  settlement?: {
    txHash: string;
    explorerUrl: string;
    intentsSettled: number;
    totalAmount: number;
    gasCost: number;
    settledAt: number;
  };
}


export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  price: number;
  estimatedTimeMs: number;
  confidence: number;
  strategy: string;
  submittedAt: number;
}

export interface SubTask {
  id: string;
  userId?: string;              // Linked to parent task's user
  parentTaskId: string;
  parentAgentId: string;
  type?: string;
  title: string;
  description: string;
  budget?: number;
  status: TaskStatus;
  winningBid?: string | null;   // Unified with Task
  assignedAgentId?: string | null;
  subTaskIds?: string[];        // Future proofing for nested subtasks
  result?: ExecutionResult | null;
  depth: number;
  createdAt: number;
  completedAt?: number | null;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;              // Assigned specialized role
  capabilities: string[];
  walletAddress: string;
  wallet: number;               // simulated USDC balance
  reputation: number;           // 0-100
  totalEarned: number;
  tasksCompleted: number;
  avgResponseTimeMs: number;
  memory: AgentMemory;
}

export interface SubBid {
  id: string;
  subTaskId: string;
  agentId: string;
  price: number;
  estimatedTimeMs: number;
  createdAt: number;
}

export interface PaymentIntent {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  taskId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'signed' | 'settled';
  createdAt: number;
}
