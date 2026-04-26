import { Task, Bid, Agent, SubTask, SubBid, ExecutionResult, AgentMessage, PaymentIntent } from '@/types';
import { pipelineEvents, EMIT_PAYMENT } from '../events';

const SEED_AGENTS = [
  { id: 'crypto-scout-x',  name: 'CryptoScout-X',  role: 'orchestrator' as any, reputation: 95, balance: 0.42 },
  { id: 'research-alpha',  name: 'Research-Alpha',  role: 'research' as any,     reputation: 92, balance: 0.19 },
  { id: 'data-miner-pro',  name: 'DataMiner-Pro',   role: 'research' as any,     reputation: 87, balance: 0.31 },
  { id: 'parser-x',        name: 'Parser-X',        role: 'clean_data' as any,   reputation: 88, balance: 0.07 },
  { id: 'analysis-node',   name: 'Analysis-Node',   role: 'analysis' as any,     reputation: 91, balance: 0.16 },
  { id: 'compute-grid-4',  name: 'Compute-Grid-4',  role: 'compute' as any,      reputation: 90, balance: 0.08 },
];

class MemoryStore {
  private tasks: Task[] = [];
  private agents: Agent[] = [];
  private bids: (Bid | SubBid)[] = [];
  private payments: PaymentIntent[] = [];
  private messages: AgentMessage[] = [];
  private userWallet: number = 50.0;
  private pipelineSteps: any[] = [];

  constructor() {
    // wallet_address is intentionally null here — it gets populated from Circle
    // API via agentIdentity.resolveAgentAddress() and persisted in Supabase
    // agents.wallet_address. Never generate random addresses: they would be
    // different on every cold start and are cryptographically meaningless.
    this.agents = SEED_AGENTS.map(a => ({
      ...a,
      wallet_address: null,
      wallet: a.balance,
      tasksCompleted: 0,
      totalEarned: 0,
      capabilities: [a.role],
      avgResponseTimeMs: 0,
      memory: { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 }
    })) as any;
  }

  // Task Methods
  getTask(id: string): Task | undefined {
    return this.tasks.find(t => t.id === id);
  }

  getAllTasks(): Task[] {
    return this.tasks.filter(t => !t.parentTaskId).sort((a, b) => b.createdAt - a.createdAt);
  }

  addTask(task: Task | SubTask): void {
    if (!this.tasks.some(t => t.id === task.id)) {
      this.tasks.push(task as Task);
    }
  }

  async createTask(task: Task | SubTask): Promise<void> {
    this.addTask(task as Task);
  }

  updateTask(id: string, updates: Partial<Task | SubTask>): void {
    const index = this.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.tasks[index] = { ...this.tasks[index], ...updates } as any;
    }
  }

  // Compatibility for existing code
  async updateSubTask(id: string, updates: Partial<SubTask>): Promise<void> {
    this.updateTask(id, updates as any);
  }

  // Compatibility wrapper for async pipeline
  async getTasks(): Promise<Task[]> {
    return this.getAllTasks();
  }

  getSubTasksForTask(taskId: string): SubTask[] {
    return this.tasks.filter(t => t.parentTaskId === taskId) as any;
  }

  async getSubTasks(taskId: string): Promise<SubTask[]> {
    return this.getSubTasksForTask(taskId);
  }

  async createSubTask(st: SubTask) {
    this.addTask(st as any);
  }

  async getSubTask(id: string): Promise<SubTask | undefined> {
    return this.tasks.find(t => t.id === id) as any;
  }

  // Agent Methods
  getAgents(): Agent[] {
    return this.agents;
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.find(a => a.id === id);
  }

  async addAgent(agent: Agent): Promise<void> {
    if (!this.agents.some(a => a.id === agent.id)) {
      this.agents.push(agent);
    }
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    const index = this.agents.findIndex(a => a.id === id);
    if (index !== -1) {
      this.agents[index] = { ...this.agents[index], ...updates };
    }
  }

  async updateAgentEarned(agentId: string, amount: number, taskId: string, description: string) {
    const agent = this.getAgent(agentId);
    if (agent) {
      const before = agent.wallet;
      const after = before + amount;
      this.updateAgent(agentId, {
        wallet: after,
        totalEarned: (agent.totalEarned || 0) + amount,
        tasksCompleted: (agent.tasksCompleted || 0) + 1
      });
      await this.logTransaction({ taskId, type: 'credit', amount, before, after, description });
    }
  }

  async updateAgentIntelligence(agentId: string, task: Task | SubTask, result: ExecutionResult) {
    const agent = this.getAgent(agentId);
    if (!agent) return;
    const newRep = result.confidence >= 0.7 
      ? Math.min(100, (agent.reputation || 0) + 1)
      : Math.max(0, (agent.reputation || 0) - 10);
    this.updateAgent(agentId, { reputation: newRep });
  }

  // Bidding Methods
  async addBid(bid: Bid | SubBid): Promise<void> {
    this.bids.push(bid);
  }

  async getBidsForTask(taskId: string): Promise<(Bid | SubBid)[]> {
    return this.bids.filter(b => (b as any).taskId === taskId || (b as any).subTaskId === taskId);
  }

  async getSubBids(subTaskId: string): Promise<SubBid[]> {
    return this.bids.filter(b => (b as any).subTaskId === subTaskId) as SubBid[];
  }

  async selectWinningBid(taskId: string): Promise<{ bid: Bid, agent: Agent, score: number }> {
    const bids = await this.getBidsForTask(taskId);
    if (bids.length === 0) throw new Error('No bids');
    const { calculateBidScore } = await import('../scoring');
    const rankedBids = bids.map(bid => {
      const agent = this.getAgent(bid.agentId);
      if (!agent) return null;
      return { bid: bid as Bid, agent, score: calculateBidScore(bid as Bid, agent) };
    }).filter((item): item is { bid: Bid, agent: Agent, score: number } => item !== null);
    if (rankedBids.length === 0) throw new Error('No valid bids');
    return rankedBids.sort((a, b) => b.score - a.score)[0];
  }

  async assignWinningBid(taskId: string): Promise<void> {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');
    const winner = await this.selectWinningBid(taskId);
    if (winner.bid.price > (task.budget ?? 0)) {
       throw new Error(`Winner bid price ($${winner.bid.price}) exceeds task budget ($${task.budget})`);
    }
    this.bids.forEach(b => {
      if ((b as any).taskId === taskId || (b as any).subTaskId === taskId) {
        (b as any).status = b.id === winner.bid.id ? 'winner' : 'rejected';
      }
    });
    this.updateTask(taskId, { 
      winningBidId: winner.bid.id, 
      assignedAgentId: winner.agent.id, 
      status: 'assigned' 
    } as any);
  }

  // Payment Methods
  addPaymentIntent(intent: PaymentIntent): void {
    this.payments.push(intent);
    pipelineEvents.emit(EMIT_PAYMENT, intent);
  }

  async createPaymentIntent(data: any): Promise<PaymentIntent> {
    const intent = { 
      ...data, 
      fromAgent: data.fromAgentName,
      toAgent: data.toAgentName,
      id: crypto.randomUUID(), 
      status: 'pending', 
      createdAt: Date.now() 
    };
    this.addPaymentIntent(intent);
    return intent;
  }

  getPaymentsForTask(taskId: string): PaymentIntent[] {
    return this.payments.filter(p => p.taskId === taskId);
  }

  async distributePayment(agentId: string, amount: number, taskId: string, description: string): Promise<void> {
    await this.updateAgentEarned(agentId, amount, taskId, description);
  }

  getAllPayments(): PaymentIntent[] {
    return this.payments;
  }

  async settlePaymentIntent(id: string) {
    const index = this.payments.findIndex(p => p.id === id);
    if (index !== -1) this.payments[index].status = 'settled';
  }

  // Message Methods
  async addMessage(msg: AgentMessage): Promise<void> {
    this.messages.push(msg);
  }

  async getMessagesForTask(taskId: string): Promise<AgentMessage[]> {
    return this.messages.filter(m => m.taskId === taskId);
  }

  // Wallet Methods
  async getUserWallet(): Promise<number> {
    return this.userWallet;
  }

  async updateUserWallet(amount: number, taskId: string = 'system', description: string = 'Wallet update'): Promise<void> {
    if (amount < 0) throw new Error('Wallet balance cannot be negative');
    const before = this.userWallet;
    this.userWallet = amount;
    await this.logTransaction({ taskId, type: amount < before ? 'debit' : 'credit', amount: Math.abs(amount - before), before, after: amount, description });
  }

  async logTransaction(data: any) {
    // Audit log (in-memory)
    console.log(`[TRANSACTION] ${data.type.toUpperCase()}: $${data.amount.toFixed(4)} | ${data.description}`);
  }

  calculateBudgetHeuristic(prompt: string): number {
    const len = prompt?.length || 0;
    if (len < 20) return 0.05;
    if (len < 100) return 0.15;
    return 0.30;
  }

  // Pipeline Step Methods
  async logPipelineStep(taskId: string, stepName: string, status: string, detail: string) {
    this.pipelineSteps.push({ taskId, stepName, status, detail, timestamp: Date.now() });
  }

  async allPipelineStepsCompleted(taskId: string): Promise<boolean> {
    const steps = this.pipelineSteps.filter(s => s.taskId === taskId && s.status === 'completed');
    return steps.length >= 5;
  }

  // Memory Refresh Compatibility
  async refreshAgentWallets() {
     const { getAgentBalances, getAgentAddress } = await import('../circleWallets');
     const balances = await getAgentBalances();
     for (const [agentId, amount] of Object.entries(balances)) {
       const agent = this.getAgent(agentId);
       if (agent) {
         this.updateAgent(agentId, { wallet: amount as number });
       }
     }
  }
}

export const store = new MemoryStore();
