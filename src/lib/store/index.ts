import * as fs from 'fs';
import * as path from 'path';
import { Task, Bid, Agent, SubTask, SubBid, ExecutionResult, AgentMessage, PaymentIntent } from '@/types';
import { calculateBidScore } from '../scoring';
import { pipelineEvents, EMIT_PAYMENT } from '../events';

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

  constructor() {
    this.init();
    this.cleanStaleTasks();
    // Always reset on startup — never use stale balances from store.json
    this.agents = new Map(SEED_AGENTS.map(a => [a.id, { 
      ...a, 
      walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
      wallet: a.balance,
      totalEarned: 0,
      tasksCompleted: 0,
      avgResponseTimeMs: 1200,
      capabilities: [a.role],
      memory: { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 }
    } as Agent]))
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
    console.log('[SEED] Registry initializing in memory...');
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
    console.log('[SEED] Memory registry initialized.');
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
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      // Intentionally silent - persistence is best-effort in this architecture
    }
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

        this.agents.forEach(agent => {
          if (!agent.memory) {
            agent.memory = { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
          }
        });

        console.log(`[STORE] Database loaded: ${this.tasks.size} tasks.`);
      }
    } catch (err) {
      console.warn('[STORE] Persistence could not be loaded.');
    }
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

      if (cleaned > 0) {
        this.save();
      }
    } catch (err) {
      // silently ignore
    }
  }

  // Unified Task Management
  createTask(task: Task | SubTask): void {
    const newTask = {
      ...task,
      subTaskIds: (task as any).subTaskIds || [],
      depth: (task as any).depth || 0
    };
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
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getTask(id: string): (Task | SubTask) | undefined {
    return this.tasks.get(id);
  }

  updateTask(id: string, updates: Partial<Task | SubTask>): void {
    const task = this.tasks.get(id);
    if (task) {
      const updatedTask = { ...task, ...updates };
      this.tasks.set(id, updatedTask);
      
      if ((updatedTask as any).parentTaskId) {
        this.checkParentCompletion((updatedTask as any).parentTaskId);
      }

      // Note: Automatic parent completion removed to avoid conflicts with 'settling' phase in pipeline.
      this.save();
    }
  }

  private checkParentCompletion(parentId: string) {
    // Note: Automatic parent completion removed to avoid conflicts with 'settling' phase in pipeline.
    return;
  }

  // SubTask Helpers (Alias for unified map)
  createSubTask(st: SubTask) { this.createTask(st); }
  getSubTask(id: string) { return this.getTask(id); }
  getSubTasks(taskId: string): SubTask[] {
    const task = this.tasks.get(taskId);
    if (!task) return [];
    const sids = (task as any).subTaskIds || [];
    return sids.map((id: string) => this.tasks.get(id)).filter((t: any): t is SubTask => !!t);
  }
  updateSubTask(id: string, updates: Partial<SubTask>) { this.updateTask(id, updates); }

  // Agents
  addAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.save();
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // Bids (Unified)
  addBid(bid: Bid | SubBid): void {
    this.bids.set(bid.id, bid);
    this.save();
  }

  getBidsForTask(taskId: string): (Bid | SubBid)[] {
    return Array.from(this.bids.values()).filter(bid => (bid as any).taskId === taskId || (bid as any).subTaskId === taskId);
  }

  addSubBid(sb: SubBid) { this.addBid(sb); }
  getSubBids(sid: string) { return this.getBidsForTask(sid); }

  // Selection Engine
  selectWinningBid(taskId: string): { bid: Bid, agent: Agent, score: number } {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Task not found');

    const bids = this.getBidsForTask(taskId);
    if (bids.length === 0) throw new Error('No bids available for this task');

    const rankedBids = bids.map(bid => {
      const agent = this.agents.get(bid.agentId);
      if (!agent) return null;
      try {
        const score = calculateBidScore(bid as Bid, agent);
        return { bid: bid as Bid, agent, score };
      } catch (err) {
        return null;
      }
    }).filter((item): item is { bid: Bid, agent: Agent, score: number } => item !== null);

    if (rankedBids.length === 0) throw new Error('No valid agents found for bids');

    const titleToRoleMap: Record<string, string> = {
      'Research': 'research-agent',
      'Planning': 'planning-agent',
      'Execution': 'execution-agent',
      'Validation': 'validation-agent'
    };

    const targetRole = titleToRoleMap[(task as any).title] || titleToRoleMap[(task as any).prompt] || '';

    return rankedBids.sort((a, b) => {
      const aMatches = a.agent.role === targetRole;
      const bMatches = b.agent.role === targetRole;
      if (aMatches !== bMatches) return aMatches ? -1 : 1;
      if (Math.abs(b.score - a.score) > 0.000001) return b.score - a.score;
      return a.bid.submittedAt - b.bid.submittedAt;
    })[0];
  }

  assignWinningBid(taskId: string): void {
    const winner = this.selectWinningBid(taskId);
    this.updateTask(taskId, {
      winningBid: winner.bid.id,
      assignedAgentId: winner.agent.id,
      status: 'assigned'
    });
  }

  // Inter-Agent Communication
  addMessage(msg: AgentMessage): void {
    this.messages.set(msg.id, msg);
    this.save();
  }

  getMessagesForTask(taskId: string): AgentMessage[] {
    return Array.from(this.messages.values())
      .filter(m => m.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // Intelligence Evolution
  updateAgentIntelligence(agentId: string, task: Task | SubTask, result: ExecutionResult): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    if (!agent.memory) {
      agent.memory = { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
    }

    if (result.confidence >= 0.7) {
      agent.reputation = Math.min(100, agent.reputation + 1);
      agent.memory.successCount += 1;
    } else {
      agent.reputation = Math.max(0, agent.reputation - 1);
      agent.memory.failureCount += 1;
    }

    const taskTitle = (task as any).title || (task as any).prompt;
    agent.memory.pastTasks = [taskTitle, ...agent.memory.pastTasks].slice(0, 10);
    agent.memory.pastResults = [result.result.slice(0, 100), ...agent.memory.pastResults].slice(0, 10);

    this.agents.set(agentId, agent);
    this.save();
  }

  // Economy
  distributePayment(agentId: string, amount: number): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.wallet += amount;
      agent.totalEarned += amount;
      agent.tasksCompleted += 1;
      this.agents.set(agentId, agent);
      this.save();
    }
  }

  calculateBudgetHeuristic(content: string): number {
    const len = content?.length || 0;
    return 0.01 + (len / 1000);
  }

  // Payments
  createPaymentIntent(data: Omit<PaymentIntent, 'id' | 'createdAt' | 'status'>): PaymentIntent {
    const intent: PaymentIntent = {
      ...data,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: Date.now(),
    };
    
    this.payments.set(intent.id, intent);
    this.save();
    
    pipelineEvents.emit(EMIT_PAYMENT, intent);
    
    return intent;
  }

  getPaymentsForTask(taskId: string): PaymentIntent[] {
    return Array.from(this.payments.values())
      .filter(p => !taskId || p.taskId === taskId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const store = (global as any).appStore || ((global as any).appStore = new InMemoryStore());
