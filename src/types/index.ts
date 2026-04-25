/**
 * SwarmPay Core Types
 * Upgraded for Phase 5: Autonomous Agent Economy
 */

export type TaskStatus = 'open' | 'pending' | 'bidding' | 'assigned' | 'executing' | 'settling' | 'completed' | 'failed';

export type AgentRole = 'research' | 'clean_data' | 'analysis' | 'compute' | 'orchestrator' | 'research-agent' | 'planning-agent' | 'execution-agent' | 'validation-agent';


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
  cleaning: number;
  analysis: number;
  compute: number;
  agentMargins: number;
  platformFee: number;
  totalPayments?: number;
  totalCost: number;
  userBudget: number;
  userSavings: number;
  savingsPercent: number;
  initialBalance?: number;
  remainingBalance?: number;
  guardVerified?: boolean;
}

export interface Task {
  id: string;
  userId: string;
  prompt: string;
  budget: number;
  status: TaskStatus;
  winningBid: any | null;
  winningBidId?: string | null;
  winningAgentName?: string | null;
  assignedAgentId: string | null;
  bids?: any[];
  currentBids?: any[];
  subTaskIds: string[];
  depth: number;                // Max depth = 3 in Phase 5
  result: ExecutionResult | null;
  costBreakdown: CostBreakdown;
  parentTaskId?: string;
  createdAt: number;
  completedAt: number | null;
  complexity?: 'LOW' | 'MEDIUM' | 'HIGH';
  orchestratorRationale?: string;
  agentCount?: number;
  errorReason?: string;
  settlement?: {
    txHash: string;
    explorerUrl: string;
    intentsSettled: number;
    totalAmount: number;
    gasCost: number;
    settledAt: number;
    allHashes?: string[];
  };
  micropaymentCount?: number;
  executionValid?: boolean;
  stats?: {
    micropayments: number;
    agents: number;
    duration: number;
  };
}


export interface Bid {
  id: string;
  taskId: string;
  agentId: string;
  agentName: string;
  amount: number;
  price: number;              // Maintain compatibility
  estimatedTimeMs: number;
  latency: number;           // User requested
  reputation: number;        // User requested
  confidence: number;
  strategy: string;
  reasoning?: string;
  submittedAt: number;
  status?: 'winner' | 'rejected';
  selectionReason?: string;
  rejectionReason?: string;
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
  winningBid?: any | null;   // Unified with Task
  winningBidId?: string | null;
  winningAgentName?: string | null;
  assignedAgentId?: string | null;
  subTaskIds?: string[];        // Future proofing for nested subtasks
  result?: ExecutionResult | null;
  depth: number;
  createdAt: number;
  completedAt?: number | null;
  costBreakdown?: CostBreakdown;
  executionValid?: boolean;
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
  earned?: number;
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
  reasoning?: string;         // Why this sub-agent is best
  createdAt: number;
  status?: 'winner' | 'rejected';
}

export interface WalletTransaction {
  id: string;
  taskId: string;
  type: 'debit' | 'credit' | 'refund';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: number;
}

export interface PipelineStep {
  id: string;
  taskId: string;
  stepName: string;
  status: 'pending' | 'completed' | 'failed';
  detail: string;
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
  settledAt?: number;
  createdAt: number;
}
