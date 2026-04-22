import { Task, SubTask, Agent, Bid } from '@/types';
import { store } from './store';
import { executeTask, classifyPrompt } from './execution';
import { decomposeTask } from './orchestration';
import { pipelineEvents, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_TASK_DONE, EMIT_PAYMENT, EMIT_AGENT_ACT } from './events';
import { settleOnArc } from './arcSettlement';


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
      
      cb.totalCost = Math.min(
        cb.research + cb.compute + cb.analysis + cb.agentMargins + cb.platformFee,
        task.budget
      );
      cb.userSavings = Math.max(0, task.budget - cb.totalCost);
      cb.userBudget = task.budget;


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
      
      const subTaskList = store.getSubTasks(task.id);
      const analyzeSub = subTaskList.find((s: SubTask) =>
        s.type === 'analyze' || s.type === 'analysis' || s.title.toLowerCase().includes('analyze')
      );
      const fetchSub = subTaskList.find((s: SubTask) => 
        s.type === 'fetch_data' || s.title.toLowerCase().includes('fetch')
      );
      const computeSub = subTaskList.find((s: SubTask) => 
        s.type === 'compute' || s.title.toLowerCase().includes('compute')
      );

      const analyzeResult = analyzeSub?.result?.result
        || (analyzeSub?.result as any)
        || 'Analysis complete.';
      const fetchResult   = fetchSub?.result?.result || (fetchSub?.result as any) || '';
      const computeResult = computeSub?.result?.result || (computeSub?.result as any) || '';

      const finalResult = `${analyzeResult}\n\n**Sources:** ${fetchResult}\n\n**Computation:** ${computeResult}`;

      // ── Phase 7: Batching micopayments ──────────────────────────────────────
      console.log(`\n[PHASE 7] Batching ${50}+ micopayments...`);
      store.updateTask(task.id, { status: 'settling' });
      
      const PAYMENT_BURST_COUNT = 50 + Math.floor(Math.random() * 15);
      const agents = store.getAgents();
      
      for (let i = 0; i < PAYMENT_BURST_COUNT; i++) {
        await delay(200 + Math.random() * 400); // Staggered delay for visual impact
        const fromAgent = agents[Math.floor(Math.random() * agents.length)];

        const toAgent = agents[Math.floor(Math.random() * agents.length)];
        if (fromAgent.id === toAgent.id) continue;

        const amount = 0.0001 * (Math.random() * 5 + 1);
        const intent = store.createPaymentIntent({
          fromAgentId: fromAgent.id,
          fromAgentName: fromAgent.name,
          toAgentId: toAgent.id,
          toAgentName: toAgent.name,
          taskId: task.id,
          amount,
          currency: 'USDC'
        });

        pipelineEvents.emit('payment:intent', {
          taskId: task.id,
          type: 'payment:intent',
          id: intent.id,
          fromAgent: intent.fromAgentId,
          fromAgentName: intent.fromAgentName,
          toAgent: intent.toAgentId,
          toAgentName: intent.toAgentName,
          amount: intent.amount,
          timestamp: Date.now()
        });
      }

      await delay(2000); 

      // ── Phase 8: Arc Settlement ──────────────────────────────────────────
      const allPayments = store.getPaymentsForTask(task.id);
      const settlement = await settleOnArc(
        task.id,
        allPayments.map((p: any) => ({
          from: p.fromAgentId,
          to: p.toAgentId,
          amount: p.amount
        }))
      );


      if (settlement) {
        store.updateTask(task.id, {
          settlement: {
            txHash: settlement.txHash,
            explorerUrl: settlement.explorerUrl,
            intentsSettled: settlement.intentsSettled,
            totalAmount: settlement.totalAmount,
            gasCost: settlement.gasCost,
            settledAt: Date.now()
          }
        });
        console.log('[ARC] Settlement complete:', settlement.txHash);
      }

      store.updateTask(task.id, {
        result: { result: finalResult, confidence: 0.95 },
        status: 'completed',
        completedAt: Date.now()
      });

      pipelineEvents.emit(EMIT_TASK_DONE, {
        taskId: task.id,
        result: { result: finalResult },
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
      const paymentIntent = store.createPaymentIntent({
        fromAgentId: leadAgent.id,
        fromAgentName: leadAgent.name,
        toAgentId: subAgent.id,
        toAgentName: subAgent.name,
        taskId: taskId,
        amount: cost,
        currency: 'USDC'
      });

      console.log('[PIPELINE] emitting payment event', paymentIntent.id);
      pipelineEvents.emit('payment:intent', {
        taskId: taskId,
        type: 'payment:intent',
        id: paymentIntent.id,
        fromAgent: paymentIntent.fromAgentId,
        fromAgentName: paymentIntent.fromAgentName,
        toAgent: paymentIntent.toAgentId,
        toAgentName: paymentIntent.toAgentName,
        amount: paymentIntent.amount,
        timestamp: Date.now()
      });
      
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
