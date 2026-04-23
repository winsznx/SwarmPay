import * as fs from 'fs';
import * as path from 'path';
import { Task, Bid, Agent, SubTask, SubBid, ExecutionResult, AgentMessage, PaymentIntent } from '@/types';
import { calculateBidScore } from '../scoring';
import { pipelineEvents, EMIT_PAYMENT } from '../events';
import { getAgentBalances, getAgentAddress } from '../circleWallets';

const STORE_DIR = path.join(process.cwd(), '.data');
const STORE_PATH = path.join(STORE_DIR, 'store.json');

const SEED_AGENTS = [
  { id: 'crypto-scout-x',  name: 'CryptoScout-X',  role: 'orchestrator' as any, reputation: 95, balance: 0.42, available: true },
  { id: 'research-alpha',  name: 'Research-Alpha',  role: 'research' as any,     reputation: 92, balance: 0.19, available: true },
  { id: 'data-miner-pro',  name: 'DataMiner-Pro',   role: 'research' as any,     reputation: 87, balance: 0.31, available: true },
  { id: 'parser-x',        name: 'Parser-X',        role: 'clean_data' as any,   reputation: 88, balance: 0.07, available: true },
  { id: 'analysis-node',   name: 'Analysis-Node',   role: 'analysis' as any,     reputation: 91, balance: 0.16, available: true },
  { id: 'compute-grid-4',  name: 'Compute-Grid-4',  role: 'compute' as any,      reputation: 90, balance: 0.08, available: true },
];

class InMemoryStore {
  private tasks: Map<string, Task | SubTask> = new Map();
  private bids: Map<string, Bid | SubBid> = new Map();
  private agents: Map<string, Agent> = new Map();
  private messages: Map<string, AgentMessage> = new Map();
  private payments: Map<string, PaymentIntent> = new Map();
  private userWallet: number = 50.00; // Seed with $50 for the user

  constructor() {
    this.init();
    this.cleanStaleTasks();
    
    if (this.agents.size === 0) {
      this.seedAgents();
    }
  }

  private init(): void {
    try {
      if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
      }
    } catch (err) {
      console.warn('[STORE] Environment warning: Local storage directory could not be created/accessed.');
    }
    
    try {
      this.load();
    } catch (err) {
      console.warn('[STORE] Data loading skipped or failed.');
    }

    if (this.agents.size === 0) {
      this.seedAgents();
    }
  }

  private seedAgents(): void {
    SEED_AGENTS.forEach(a => {
      const agent = {
        ...a,
        walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        wallet: a.balance,
        totalEarned: 0,
        tasksCompleted: 0,
        avgResponseTimeMs: 1200,
        capabilities: [a.role],
        memory: { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 },
      } as Agent;
      this.agents.set(agent.id, agent);
    });
  }

  private save(): void {
    if (process.env.VERCEL) return;
    try {
      const data = {
        tasks: Array.from(this.tasks.entries()),
        bids: Array.from(this.bids.entries()),
        agents: Array.from(this.agents.entries()),
        messages: Array.from(this.messages.entries()),
        payments: Array.from(this.payments.entries()),
        userWallet: this.userWallet,
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {}
  }

  private load(): void {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        if (!raw) return;
        const data = JSON.parse(raw);
        this.tasks = new Map(data.tasks || []);
        this.bids = new Map(data.bids || []);
        this.agents = new Map(data.agents || []);
        this.messages = new Map(data.messages || []);
        this.payments = new Map(data.payments || []);
        this.userWallet = data.userWallet ?? 50.00;

        this.agents.forEach(agent => {
          if (!agent.memory) {
            agent.memory = { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
          }
        });
      }
    } catch (err) {}
  }

  private cleanStaleTasks(): void {
    try {
      const now = Date.now();
      let cleaned = 0;
      this.tasks.forEach((task, id) => {
        const isStale = (task.status === 'bidding' || task.status === 'executing') && 
                        (now - task.createdAt > 2 * 60 * 1000);
        if (isStale) {
          task.status = 'failed';
          this.tasks.set(id, task);
          cleaned++;
        }
      });
      if (cleaned > 0) this.save();
    } catch (err) {}
  }

  createTask(task: Task | SubTask): void {
    const newTask = { ...task, subTaskIds: (task as any).subTaskIds || [], depth: (task as any).depth || 0 };
    this.tasks.set(task.id, newTask);
    if ((task as any).parentTaskId) {
      const parent = this.tasks.get((task as any).parentTaskId);
      if (parent) {
        const currentIds = (parent as any).subTaskIds || [];
        if (!currentIds.includes(task.id)) {
          (parent as any).subTaskIds = [...currentIds, task.id];
          this.tasks.set(parent.id, parent);
        }
      }
    }
    this.save();
  }

  getTasks(): (Task | SubTask)[] {
    return Array.from(this.tasks.values())
      .filter((t: any) => t.prompt && t.prompt.trim().length > 0)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getTask(id: string): (Task | SubTask) | undefined { return this.tasks.get(id); }

  updateTask(id: string, updates: Partial<Task | SubTask>): void {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
      this.save();
    }
  }

  createSubTask(st: SubTask) { this.createTask(st); }
  getSubTasks(taskId: string): SubTask[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    const sids = (task as any).subTaskIds || [];
    return sids.map((id: string) => this.tasks.get(id)).filter((t: any): t is SubTask => !!t);
  }

  updateSubTask(id: string, updates: Partial<SubTask>): void { this.updateTask(id, updates as any); }
  getSubBids(subTaskId: string): SubBid[] { return this.getBidsForTask(subTaskId) as SubBid[]; }

  addAgent(agent: Agent): void { this.agents.set(agent.id, agent); this.save(); }
  updateAgent(id: string, updates: Partial<Agent>): void {
    const agent = this.agents.get(id);
    if (agent) { this.agents.set(id, { ...agent, ...updates }); this.save(); }
  }
  getAgents(): Agent[] { return Array.from(this.agents.values()); }
  getUserWallet(): number { return this.userWallet; }
  updateUserWallet(amount: number): void { this.userWallet = amount; this.save(); }

  addBid(bid: Bid | SubBid): void { this.bids.set(bid.id, bid); this.save(); }
  getBidsForTask(taskId: string): (Bid | SubBid)[] {
    return Array.from(this.bids.values()).filter(bid => (bid as any).taskId === taskId || (bid as any).subTaskId === taskId);
  }

  addMessage(msg: AgentMessage): void { this.messages.set(msg.id, msg); this.save(); }
  getMessagesForTask(taskId: string): AgentMessage[] {
    return Array.from(this.messages.values()).filter(m => m.taskId === taskId).sort((a, b) => a.createdAt - b.createdAt);
  }

  calculateBudgetHeuristic(prompt: string): number {
    const len = prompt?.length || 0;
    if (len < 20) return 0.05;
    if (len < 100) return 0.15;
    return 0.30;
  }

  selectWinningBid(taskId: string): { bid: Bid, agent: Agent, score: number } {
    const bids = this.getBidsForTask(taskId);
    if (bids.length === 0) throw new Error('No bids');
    const rankedBids = bids.map(bid => {
      const agent = this.agents.get(bid.agentId);
      if (!agent) return null;
      return { bid: bid as Bid, agent, score: calculateBidScore(bid as Bid, agent) };
    }).filter((item): item is { bid: Bid, agent: Agent, score: number } => item !== null);
    
    return rankedBids.sort((a, b) => b.score - a.score)[0];
  }

  assignWinningBid(taskId: string): void {
    const winner = this.selectWinningBid(taskId);
    this.getBidsForTask(taskId).forEach(bid => {
      const isWinner = bid.id === winner.bid.id;
      this.bids.set(bid.id, { ...bid, status: isWinner ? 'winner' : 'rejected' } as any);
    });
    this.updateTask(taskId, { winningBid: winner.bid.id, assignedAgentId: winner.agent.id, status: 'assigned' });
    this.save();
  }

  updateAgentIntelligence(agentId: string, task: Task | SubTask, result: ExecutionResult): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    if (result.confidence >= 0.7) { agent.reputation = Math.min(100, agent.reputation + 1); }
    else { agent.reputation = Math.max(0, agent.reputation - 1); }
    this.agents.set(agentId, agent);
    this.save();
  }

  async refreshAgentWallets(): Promise<void> {
    const balances = await getAgentBalances();
    for (const [agentId, amount] of Object.entries(balances)) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.wallet = amount;
        if (!agent.walletAddress || agent.walletAddress.length < 10) {
          const addr = await getAgentAddress(agentId);
          if (addr) agent.walletAddress = addr;
        }
        this.agents.set(agentId, agent);
      }
    }
    this.save();
  }

  updateAgentEarned(agentId: string, amount: number) {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.set(agentId, {
        ...agent,
        wallet: (agent.wallet || 0) + amount,
        earned: (agent.earned ?? 0) + amount,
        tasksCompleted: (agent.tasksCompleted || 0) + 1
      });
      this.save();
    }
  }

  distributePayment(agentId: string, amount: number): void { this.updateAgentEarned(agentId, amount); }

  createPaymentIntent(data: Omit<PaymentIntent, 'id' | 'createdAt' | 'status'>): PaymentIntent {
    const intent: PaymentIntent = { ...data, id: crypto.randomUUID(), status: 'pending', createdAt: Date.now() };
    this.payments.set(intent.id, intent);
    this.save();
    pipelineEvents.emit(EMIT_PAYMENT, intent);
    return intent;
  }

  getPaymentsForTask(taskId: string): PaymentIntent[] {
    return Array.from(this.payments.values()).filter(p => !taskId || p.taskId === taskId).sort((a, b) => b.createdAt - a.createdAt);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).filter((t: any) => !t.parentTaskId) as Task[];
  }
}

export const store = (global as any).appStore || ((global as any).appStore = new InMemoryStore());
