import { Task, SubTask, Agent, Bid } from '@/types';
import { store } from './store';
import { executeTask, classifyPrompt } from './execution';
import { decomposeTask } from './orchestration';
import { pipelineEvents, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_TASK_DONE, EMIT_PAYMENT } from './events';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * THE AUTONOMOUS PIPELINE
 * ========================
 * This is the core of SwarmPay's autonomous economy.
 * Called once on task creation - runs entirely without human input.
 *
 * Phases:
 *   1. Auto-Bid War (staggered agent bids, 3-5s)
 *   2. Auto-Select Winner (scoring engine picks best bid)
 *   3. Auto-Decompose (lead agent breaks into sub-tasks)
 *   4. Auto Sub-Bid (sub-agents bid on each sub-task)
 *   5. Auto-Execute (execution + micropayment burst)
 *   6. Auto-Complete (aggregate results, update leaderboard)
 */
export async function runAutonomousPipeline(task: Task) {
  try {
    console.log(`\n[START] [PIPELINE] Starting autonomous pipeline for task: "${task.prompt.slice(0, 40)}..."`);

    // ── Phase 1: Auto Bidding War ──────────────────────────────────────────
    console.log(`\n[PHASE 1] Opening bidding war...`);
    const agents = store.getAgents();

    if (agents.length === 0) {
      console.warn('[PIPELINE] No agents registered. Seeding demo agents...');
      await seedDemoAgents();
    }

    const allAgents = store.getAgents();
    if (allAgents.length === 0) {
      console.error('[PIPELINE] Cannot run pipeline — no agents available.');
      store.updateTask(task.id, { status: 'failed' });
      return;
    }

    // Each agent bids with slight stagger to simulate a real market
    for (const agent of allAgents) {
      await delay(Math.random() * 1000 + 600); // 600ms–1600ms stagger per agent
      const bid: Bid = {
        id: crypto.randomUUID(),
        taskId: task.id,
        agentId: agent.id,
        price: parseFloat((agent.wallet * 0.05 + Math.random() * 0.15 + 0.05).toFixed(4)),
        estimatedTimeMs: Math.floor(Math.random() * 30000) + 20000, // 20–50s
        confidence: agent.reputation / 100,
        strategy: `${agent.role} optimized execution`,
        submittedAt: Date.now(),
      };
      store.addBid(bid);
      console.log(`  [BID] ${agent.name} → $${bid.price} | ${(bid.estimatedTimeMs / 1000).toFixed(1)}s | rep:${agent.reputation}`);
    }

    // Verify bids were placed
    const bids = store.getBidsForTask(task.id);
    if (bids.length === 0) {
      store.updateTask(task.id, { status: 'failed' });
      return;
    }

    // ── Phase 2: Auto-Select Winner ────────────────────────────────────────
    await delay(800);
    console.log(`\n[PHASE 2] Scoring bids and selecting winner...`);
    store.assignWinningBid(task.id);

    const updatedTask = store.getTask(task.id) as Task;
    const winner = store.getAgents().find(a => a.id === updatedTask.assignedAgentId);
    if (!winner) {
      store.updateTask(task.id, { status: 'failed' });
      return;
    }
    console.log(`  [WINNER] ${winner.name} selected as lead agent.`);

    // ── Phase 3: Task Decomposition ────────────────────────────────────────
    await delay(1000);
    console.log(`\n[PHASE 3] Lead agent decomposing task into sub-tasks...`);
    store.updateTask(task.id, { status: 'executing' });

    const subTasks = await decomposeTask(updatedTask, 0, winner.id);
    for (const st of subTasks) {
      store.createSubTask(st);
    }
    console.log(`  [DECOMPOSED] ${subTasks.length} sub-tasks created.`);

    if (subTasks.length > 0) {
      // ── Phase 4: Sub-Agent Bidding ───────────────────────────────────────
      await delay(500);
      console.log(`\n[PHASE 4] Sub-agent bidding on each sub-task...`);
      await runSubTaskBidding(task.id, subTasks, allAgents, winner);

      // ── Phase 5: Sub-Task Execution ──────────────────────────────────────
      await delay(800);
      console.log(`\n[PHASE 5] Executing sub-tasks with micropayment stream...`);
      await runSubTaskExecution(task.id, subTasks, winner);
    } else {
      // Simple task — execute directly
      await delay(500);
      console.log(`\n[PHASE 5] Executing task directly...`);
      await runDirectExecution(task, winner);
    }

    // ── Phase 6: Finalize ─────────────────────────────────────────────────
    console.log(`\n[DONE] [PHASE 6] Pipeline complete for task "${task.prompt.slice(0, 30)}..."`);
    
    // Recalculate cost breakdown
    const finalTask = store.getTask(task.id) as Task;
    if (finalTask.costBreakdown) {
      const cb = finalTask.costBreakdown;
      cb.agentMargins = (cb.research + cb.compute + cb.analysis) * 0.40;
      
      const workCost = cb.research + cb.analysis + cb.compute + cb.agentMargins;
      const availableForWork = task.budget - cb.platformFee;
      
      if (workCost > availableForWork && availableForWork > 0) {
        const scale = availableForWork / workCost;
        cb.research *= scale;
        cb.analysis *= scale;
        cb.compute *= scale;
        cb.agentMargins *= scale;
      }
      
      cb.totalCost = cb.research + cb.compute + cb.analysis + cb.agentMargins + cb.platformFee;
      cb.userSavings = Math.max(0, cb.userBudget - cb.totalCost);

      // ASSEMBLE REAL FINAL ANSWER
      const subTasks = store.getSubTasks(task.id);
      const fetchResult   = subTasks.find(s => s.title.toLowerCase().includes('fetch'))?.result?.result ?? '';
      const analyzeResult = subTasks.find(s => s.title.toLowerCase().includes('analyze'))?.result?.result ?? '';
      const computeResult = subTasks.find(s => s.title.toLowerCase().includes('compute'))?.result?.result ?? '';

      const category = classifyPrompt(task.prompt);
      let finalResultText = '';

      if (category === 'crypto') {
        finalResultText = `## ${task.prompt}\n\n${analyzeResult}\n\n**Data View:** ${fetchResult}\n\n**Financial Metrics:** ${computeResult}`;
      } else {
        finalResultText = `## ${task.prompt}\n\n${analyzeResult}\n\n**Sources:** ${fetchResult}\n\n**Computation:** ${computeResult}`;
      }

      store.updateTask(task.id, { 
        costBreakdown: cb, 
        status: 'completed', 
        completedAt: Date.now(),
        result: {
          result: finalResultText,
          confidence: 0.95,
          cost: cb.totalCost
        }
      });

      pipelineEvents.emit(EMIT_TASK_DONE, {
        taskId: task.id,
        result: { result: finalResultText },
        costBreakdown: cb
      });
    } else {
      const result = (store.getTask(task.id) as Task).result;
      store.updateTask(task.id, { status: 'completed', completedAt: Date.now() });
      pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result, costBreakdown: (task as any).costBreakdown });
    }

  } catch (err: any) {
    console.error('[PIPELINE ERROR]', err.message);
    store.updateTask(task.id, { status: 'failed' });
  }
}

// ── Sub-Agent Bidding ────────────────────────────────────────────────────────
async function runSubTaskBidding(
  taskId: string,
  subTasks: SubTask[],
  agents: Agent[],
  leadAgent: Agent
) {
  for (const st of subTasks) {
    // Pick 2-3 specialist agents to bid on each sub-task (not the lead agent)
    const candidates = agents
      .filter(a => a.id !== leadAgent.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(3, agents.length));

    for (const agent of candidates) {
      await delay(Math.random() * 600 + 300);
      store.addBid({
        id: crypto.randomUUID(),
        taskId: st.id,
        agentId: agent.id,
        price: parseFloat((Math.random() * 0.05 + 0.001).toFixed(5)),
        estimatedTimeMs: Math.floor(Math.random() * 8000) + 3000,
        confidence: agent.reputation / 100,
        strategy: `Specialist ${agent.role} for ${st.title}`,
        submittedAt: Date.now(),
      });
      console.log(`    [SUB-BID] ${agent.name} → sub-task "${st.title}"`);
    }

    // Auto-assign winner for each sub-task
    try {
      store.assignWinningBid(st.id);
      const updatedSt = store.getTask(st.id);
      const subWinner = agents.find(a => a.id === (updatedSt as any)?.assignedAgentId);
      console.log(`    [SUB-ASSIGNED] "${st.title}" → ${subWinner?.name || 'unknown'}`);
    } catch (e: any) {
      console.warn(`    [WARN] [SUB-BID] Could not assign winner for "${st.title}": ${e.message}`);
    }
  }
}

// ── Sub-Task Execution ───────────────────────────────────────────────────────
async function runSubTaskExecution(taskId: string, subTasks: SubTask[], leadAgent: Agent) {
  // Execute sub-tasks concurrently (they run in parallel in the swarm)
  const execPromises = subTasks.map(async (st, index) => {
    try {
      await delay(index * 800); // slight stagger so the feed looks alive

      const assignedTask = store.getTask(st.id) as any;
      const subAgentId = assignedTask?.assignedAgentId;
      const subAgent = store.getAgents().find(a => a.id === subAgentId) || leadAgent;

      store.updateTask(st.id, { status: 'executing' });
      pipelineEvents.emit(EMIT_SUBTASK_START, { taskId, subTaskId: st.id, agentId: subAgent.id });

      // Execute and generate payment burst for this sub-task
      const result = await executeTask(st as any, subAgent);

      store.updateAgentIntelligence(subAgent.id, st, result);
      store.updateTask(st.id, {
        result,
        status: result.confidence >= 0.7 ? 'completed' : 'failed',
        completedAt: Date.now(),
      });
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result, cost: st.budget || 0.01 });
      
      const cost = st.budget || 0.01;
      store.distributePayment(subAgent.id, cost);

      // Accumulate cost in parent task
      const parentTask = store.getTask(taskId) as Task;
      if (parentTask && parentTask.costBreakdown) {
        const title = st.title.toLowerCase();
        if (title.includes('fetch') || title.includes('clean')) {
          parentTask.costBreakdown.research += cost;
        } else if (title.includes('analyze')) {
          parentTask.costBreakdown.analysis += cost;
        } else if (title.includes('compute')) {
          parentTask.costBreakdown.compute += cost;
        } else {
          parentTask.costBreakdown.compute += cost; // fallback
        }
        store.updateTask(taskId, { costBreakdown: parentTask.costBreakdown });
      }

      console.log(`  [EXECUTED] "${st.title}" — confidence: ${result.confidence.toFixed(2)}`);
    } catch (e) {
      console.error(`  [FAILED] [EXECUTION FAILED] "${st.title}":`, e);
      store.updateTask(st.id, { status: 'failed' });
    }
  });

  await Promise.all(execPromises);
}

// ── Direct Execution (non-complex tasks) ────────────────────────────────────
async function runDirectExecution(task: Task, agent: Agent) {
  const result = await executeTask(task, agent);
  store.updateAgentIntelligence(agent.id, task, result);
  store.distributePayment(agent.id, task.budget || 0.01);
  store.updateTask(task.id, {
    result,
    status: result.confidence >= 0.7 ? 'completed' : 'failed',
    completedAt: Date.now(),
  });
  pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result, costBreakdown: task.costBreakdown });
}

// ── Demo Agent Seeder ─────────────────────────────────────────────────────────
async function seedDemoAgents() {
  const demoAgents = [
    { name: 'CryptoScout-X', role: 'orchestrator', reputation: 95, capabilities: ['research', 'orchestration'] },
    { name: 'Research-Alpha', role: 'research-agent', reputation: 92, capabilities: ['data-fetching', 'web-search'] },
    { name: 'DataMiner-Pro', role: 'research-agent', reputation: 87, capabilities: ['data-cleaning', 'normalization'] },
    { name: 'Analysis-Node', role: 'execution-agent', reputation: 91, capabilities: ['analysis', 'scoring'] },
    { name: 'Compute-Grid-4', role: 'execution-agent', reputation: 88, capabilities: ['compute', 'ml-inference'] },
    { name: 'Validator-V1', role: 'validation-agent', reputation: 90, capabilities: ['validation', 'quality-check'] },
  ];

  for (const a of demoAgents) {
    store.addAgent({
      id: crypto.randomUUID(),
      name: a.name,
      role: a.role as any,
      capabilities: a.capabilities,
      walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
      wallet: Math.random() * 2 + 0.5,
      reputation: a.reputation,
      totalEarned: Math.random() * 0.5,
      tasksCompleted: Math.floor(Math.random() * 15),
      avgResponseTimeMs: Math.floor(Math.random() * 5000) + 1000,
      memory: { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 },
    });
    console.log(`[SEED] Agent "${a.name}" registered.`);
  }
}
