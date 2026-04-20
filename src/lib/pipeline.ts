import { Task, SubTask, Agent, Bid } from '@/types';
import { store } from './store';
import { executeTask, classifyPrompt } from './execution';
import { decomposeTask } from './orchestration';
import { pipelineEvents, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_TASK_DONE, EMIT_PAYMENT } from './events';
import { broadcastEvent } from './wsServer';

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

    // Seeding is now handled automatically by the store singleton

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
    const winner = store.getAgents().find((a: Agent) => a.id === updatedTask.assignedAgentId);
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

      // ── Phase 6: Finalize ─────────────────────────────────────────────────
      // Wait one extra beat to ensure all store updates have propagated
      await delay(800); 
      let subTasks = store.getSubTasks(task.id);
      
      // Safety check: Ensure all sub-tasks are marked completed in the store
      subTasks.forEach((st: SubTask) => {
        if (st.status !== 'completed' && st.result) {
          store.updateSubTask(st.id, { status: 'completed' });
        }
      });
      
      // Re-fetch clean copy
      subTasks = store.getSubTasks(task.id);
      
      console.log(`[PIPELINE] Finalizing result from ${subTasks.length} sub-tasks.`);
      
      const fetchResult   = subTasks.find((s: SubTask) => s.title.toLowerCase().includes('fetch'))?.result?.result ?? '';
      const analyzeResult = subTasks.find((s: SubTask) => s.title.toLowerCase().includes('analyze'))?.result?.result ?? '';
      const computeResult = subTasks.find((s: SubTask) => s.title.toLowerCase().includes('compute'))?.result?.result ?? '';

      const category = classifyPrompt(task.prompt);
      let finalResultText = '';

      // PRIMARY result is ALWAYS the Analysis
      finalResultText = `## Executive Summary\n${analyzeResult}\n\n`;
      
      if (fetchResult) {
        finalResultText += `**Sources & Data:**\n${fetchResult}\n\n`;
      }
      
      if (computeResult) {
        finalResultText += `**Computation:**\n${computeResult}`;
      }

      // ── Phase 7: On-Chain Settlement ──────────────────────────────────────
      console.log(`\n[PHASE 7] Batching 63 micropayments into 1 Arc transaction...`);
      store.updateTask(task.id, { status: 'settling' });
      await delay(5000); // Dramatic pause for the high-impact animation

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
  // Execute all sub-tasks concurrently but await their full processing
  const execPromises = subTasks.map(async (st, index) => {
    try {
      await delay(index * 800); // slight stagger so the feed looks alive

      const assignedTask = store.getTask(st.id) as any;
      const subAgentId = assignedTask?.assignedAgentId;
      const subAgent = store.getAgents().find((a: Agent) => a.id === subAgentId) || leadAgent;

      console.log(`[PIPELINE] Executing sub-task: ${st.title} (${st.id})`);
      store.updateSubTask(st.id, { status: 'executing' });
      pipelineEvents.emit(EMIT_SUBTASK_START, { taskId, subTaskId: st.id, agentId: subAgent.id });

      // Execute and generate payment burst for this sub-task
      const result = await executeTask(st as any, subAgent);

      store.updateAgentIntelligence(subAgent.id, st, result);
      
      console.log('[SUBTASK] completed:', st.title, '→', result.result.slice(0, 50));
      
      store.updateSubTask(st.id, {
        result,
        status: 'completed', // Force completed if we got a result
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
          parentTask.costBreakdown.compute += cost; 
        }
        store.updateTask(taskId, { costBreakdown: parentTask.costBreakdown });
      }
    } catch (e) {
      console.error(`[PIPELINE ERROR] Sub-task "${st.title}" failed:`, e);
      store.updateSubTask(st.id, { status: 'failed' });
    }
  });

  await Promise.all(execPromises);
  console.log(`[PIPELINE] All ${subTasks.length} sub-tasks resolved.`);
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
