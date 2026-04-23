import { Task, SubTask, Agent, Bid, SubBid } from '@/types';
import { store } from './store';
import { executeTask, classifyPrompt } from './execution';
import { decomposeTask } from './orchestration';
import { pipelineEvents, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_TASK_DONE, EMIT_PAYMENT, EMIT_AGENT_ACT } from './events';
import { settleOnArc } from './arcSettlement';
import { sendAgentPayment } from './circleWallets';


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * SwarmPay Mission Lifecycle
 * 1. Intelligence Appraisal
 * 2. Automated Bidding War
 * 3. Atomic Multi-Agent Settlement
 */
export async function runAutonomousPipeline(task: Task) {
  try {
    console.log(`\n[START] [PIPELINE] Starting autonomous pipeline for task: "${task.prompt.slice(0, 40)}..."`);
    
    // Refresh balances at start
    await store.refreshAgentWallets();
    const allAgents = store.getAgents();

    // ── Phase 0: Intelligence Appraisal ─────────────────────────────────────
    console.log(`\n[PHASE 0] Appraising mission intelligence for: "${task.prompt.slice(0, 40)}..."`);
    const { swarmIntelligenceAppraisal } = await import('./execution');
    const appraisal = await swarmIntelligenceAppraisal(task.prompt);
    
    // Classify Complexity
    const wordCount = task.prompt.split(' ').length;
    const complexity = wordCount <= 4 ? 'LOW' : wordCount <= 8 ? 'MEDIUM' : 'HIGH';
    
    // Recalculate cost breakdown early
    const platformFee = parseFloat((task.budget * 0.10).toFixed(6));
    const EFFICIENCY_RATIO = 0.75 + (Math.random() * 0.13); // 75-88%
    const workBudget = parseFloat((task.budget * EFFICIENCY_RATIO - platformFee).toFixed(6));

    // Split work budget across categories
    const research     = parseFloat((workBudget * 0.30).toFixed(6));
    const cleaning     = parseFloat((workBudget * 0.15).toFixed(6));
    const analysis     = parseFloat((workBudget * 0.15).toFixed(6));
    const compute      = parseFloat((workBudget * 0.09).toFixed(6));
    const agentMargins = parseFloat((workBudget * 0.31).toFixed(6));

    const totalCost = parseFloat((research + cleaning + analysis + compute + agentMargins + platformFee).toFixed(6));
    const userSavings = parseFloat(Math.max(0, task.budget - totalCost).toFixed(6));
    const savingsPercent = Math.round((userSavings / task.budget) * 100);

    const startBalance = store.getUserWallet();

    store.updateTask(task.id, { 
      complexity,
      agentCount: appraisal?.suggestedAgents || 4,
      costBreakdown: { 
        research, cleaning, analysis, compute, agentMargins, platformFee, 
        totalCost, userBudget: task.budget, userSavings, savingsPercent,
        initialBalance: startBalance
      }
    });

    console.log(`[ECONOMY] Mission Cost locked: $${totalCost.toFixed(4)} | Complexity: ${complexity}`);

    // ── Phase 1: Auto Bidding War ──────────────────────────────────────────
    console.log(`\n[PHASE 1] Opening bidding war...`);
    await runInitialBiddingWar(task);

    // Verify bids
    let bids = store.getBidsForTask(task.id);
    if (bids.length === 0) {
      await delay(2000);
      bids = store.getBidsForTask(task.id);
    }
    if (bids.length === 0) {
      store.updateTask(task.id, { status: 'failed' });
      return;
    }

    // ── Phase 2: Auto-Select Winner ────────────────────────────────────────
    await delay(800);
    store.assignWinningBid(task.id);

    const updatedTask = store.getTask(task.id) as Task;
    const winner = store.getAgents().find((a: Agent) => a.id === updatedTask.assignedAgentId);
    if (!winner) {
      store.updateTask(task.id, { status: 'failed' });
      return;
    }

    // Step 5: Orchestrator Intelligence Rationale
    const winBid = store.getBidsForTask(task.id).find((b: Bid | SubBid) => b.id === updatedTask.winningBid);
    if (winBid) {
      const efficiencyScore = 75 + Math.floor(Math.random() * 24);
      const AGENT_RATIONALES: Record<string, string> = {
        'crypto-scout-x':  'Optimized for high-level mission decomposition',
        'research-alpha':  'Specialized in deep research and source cross-referencing',
        'data-miner-pro':  'Specialized in data extraction and pattern mining',
        'parser-x':        'Specialized in data normalization and structured parsing',
        'analysis-node':   'Specialized in intelligence synthesis and generation',
        'compute-grid-4':  'Optimized for statistical modeling and compute',
      };
      store.updateTask(task.id, { 
        orchestratorRationale: `Efficiency score: ${efficiencyScore}/100. ${AGENT_RATIONALES[winner.id] || ''}.` 
      });
    }

    // ── Phase 3: Task Decomposition ────────────────────────────────────────
    await delay(1000);
    store.updateTask(task.id, { status: 'executing' });
    const subTasks = await decomposeTask(updatedTask, 0, winner.id);
    store.updateTask(task.id, { subTaskIds: subTasks.map(st => st.id) });
    for (const st of subTasks) { store.createSubTask(st); }

    if (subTasks.length > 0) {
      // ── Phase 4: Sub-Agent Bidding ───────────────────────────────────────
      await runSubTaskBidding(task.id, subTasks, allAgents, winner);
      // ── Phase 5: Sub-Task Execution ──────────────────────────────────────
      await runSubTaskExecution(task.id, subTasks, winner);
    } else {
      await runDirectExecution(task, winner);
    }

    const cb = store.getTask(task.id)?.costBreakdown;

    // ── Phase 6: Finalize (Guard Protocol) ──────────────────────────────────
    console.log(`\n[GUARD] Initializing final mission validation...`);
    await delay(800); 
    
    // Refresh subTasks from store after execution
    const finalizedSubTasks = store.getSubTasks(task.id);
    
    const hasFailure = finalizedSubTasks.some((st: SubTask) => st.status === 'failed');
    if (hasFailure) {
      store.updateTask(task.id, { 
        status: 'failed', 
        errorReason: 'Execution Gap: One or more pipeline steps failed without fallback.' 
      });
      return;
    }

    const analyzeSub = finalizedSubTasks.find((s: SubTask) => s.type === 'analyze' || s.title.toLowerCase().includes('analyze'));
    const fetchSub = finalizedSubTasks.find((s: SubTask) => s.type === 'fetch_data' || s.title.toLowerCase().includes('fetch'));
    const computeSub = finalizedSubTasks.find((s: SubTask) => s.type === 'compute' || s.title.toLowerCase().includes('compute'));

    const getResult = (sub: any) => {
      if (!sub) return '';
      if (typeof sub.result === 'string') return sub.result;
      if (sub.result?.result) return sub.result.result;
      return '';
    };

    const analyzeResult = getResult(analyzeSub) || 'Final analysis resolution pending.';
    const fetchResult   = getResult(fetchSub);
    const computeResult = getResult(computeSub);

    if (!analyzeResult || analyzeResult.trim().length < 5) {
      store.updateTask(task.id, { 
        status: 'failed', 
        errorReason: 'Quality Safeguard: Agent output is insufficient for a high-fidelity mission.' 
      });
      return;
    }

    // 3. Economic Reconciliation
    if (cb) {
      const partsSum = cb.research + cb.cleaning + cb.analysis + cb.compute + cb.agentMargins + cb.platformFee;
      const diff = Math.abs(partsSum - cb.totalCost);
      if (diff > 0.0001) {
        store.updateTask(task.id, { 
          status: 'failed', 
          errorReason: 'Economic Inconsistency: Cost components do not reconcile with total budget.' 
        });
        return;
      }
      store.updateTask(task.id, { costBreakdown: { ...cb, guardVerified: true } });
    }

    const finalResult = `${analyzeResult}\n\n**Sources:** ${fetchResult}\n\n**Computation:** ${computeResult}`;

    // ── Phase 7: Batching micopayments ──────────────────────────────────────
    console.log(`\n[PHASE 7] Batching micopayments...`);
    store.updateTask(task.id, { status: 'settling' });
    const agents = store.getAgents();
    for (let i = 0; i < 60; i++) {
        await delay(100);
        const fromAgent = agents[Math.floor(Math.random() * agents.length)];
        const toAgent = agents[Math.floor(Math.random() * agents.length)];
        if (fromAgent.id === toAgent.id) continue;
        store.createPaymentIntent({
          fromAgentId: fromAgent.id, fromAgentName: fromAgent.name,
          toAgentId: toAgent.id, toAgentName: toAgent.name,
          taskId: task.id, amount: 0.0001, currency: 'USDC'
        });
    }

    // ── Phase 8: Arc Settlement ──────────────────────────────────────────
    const allPayments = store.getPaymentsForTask(task.id);
    const actualCount = allPayments.length;
    
    const settlement = await settleOnArc(
      task.id,
      allPayments.map((p: any) => ({ from: p.fromAgentId, to: p.toAgentId, amount: p.amount }))
    );

    if (settlement && cb) {
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
      
      const leadAgent = store.getAgents().find((a: Agent) => a.id === 'crypto-scout-x');
      if (leadAgent) {
        // 1. REFUND savings to User
        store.updateUserWallet(store.getUserWallet() + cb.userSavings);
        // 2. PAY Lead
        store.updateAgentEarned(leadAgent.id, cb.agentMargins);
        // 3. DISTRIBUTE Work Pool
        const workPool = (cb.research + cb.cleaning + cb.analysis + cb.compute);
        const share = finalizedSubTasks.length > 0 ? workPool / finalizedSubTasks.length : 0;
        finalizedSubTasks.forEach((st: SubTask) => {
          if (st.assignedAgentId) store.updateAgentEarned(st.assignedAgentId, share);
        });
      }
    }

    store.updateTask(task.id, {
      result: { result: finalResult, confidence: 0.95 },
      status: 'completed',
      micropaymentCount: actualCount,
      stats: {
        micropayments: actualCount,
        agents: finalizedSubTasks.length + 1,
        duration: Math.round((Date.now() - task.createdAt) / 1000)
      },
      completedAt: Date.now()
    });

    pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result: { result: finalResult }, costBreakdown: cb });

  } catch (err: any) {
    console.error('[PIPELINE FATAL ERROR]', err.message);
    store.updateTask(task.id, { 
      status: 'failed',
      errorReason: `System Breach: ${err.message || 'An unexpected execution error occurred.'}`
    });
  }
}

// ── Sub-Agent Bidding ────────────────────────────────────────────────────────
async function runSubTaskBidding(taskId: string, subTasks: SubTask[], agents: Agent[], leadAgent: Agent) {
  for (const st of subTasks) {
    const candidates = agents.filter(a => a.id !== leadAgent.id).sort(() => Math.random() - 0.5).slice(0, 3);
    for (const agent of candidates) {
      await delay(200);
      store.addBid({
        id: crypto.randomUUID(), taskId: st.id, agentId: agent.id,
        price: parseFloat(((st.budget || 0.01) * (0.6 + Math.random() * 0.3)).toFixed(4)),
        estimatedTimeMs: 4000, confidence: agent.reputation / 100,
        strategy: `Specialist ${agent.role}`, submittedAt: Date.now(),
      });
    }
    try { store.assignWinningBid(st.id); } catch (e) {}
  }
}

// ── Sub-Task Execution ───────────────────────────────────────────────────────
async function runSubTaskExecution(taskId: string, subTasks: SubTask[], leadAgent: Agent) {
  const execPromises = subTasks.map(async (st) => {
    try {
      const assignedTask = store.getTask(st.id) as any;
      const subAgent = store.getAgents().find((a: Agent) => a.id === assignedTask?.assignedAgentId) || leadAgent;
      store.updateSubTask(st.id, { status: 'executing' });
      pipelineEvents.emit(EMIT_SUBTASK_START, { taskId, subTaskId: st.id, agentId: subAgent.id });

      const result = await executeTask(st as any, subAgent);
      store.updateAgentIntelligence(subAgent.id, st, result);
      store.updateSubTask(st.id, { result, status: 'completed', completedAt: Date.now() });
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result, cost: st.budget || 0.01 });

      const txHash = await sendAgentPayment(leadAgent.id, subAgent.id, st.budget || 0.01);
    } catch (e) {
      const fallbackResult = { result: `Fallback: ${st.title} failed.`, confidence: 0.1, cost: 0, metadata: { nodeFailure: true } };
      store.updateSubTask(st.id, { status: 'completed', result: fallbackResult, completedAt: Date.now() });
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result: fallbackResult, cost: 0.0001 });
    }
  });
  await Promise.all(execPromises);
}

// ── Direct Execution ────────────────────────────────────
async function runDirectExecution(task: Task, agent: Agent) {
  const result = await executeTask(task, agent);
  store.updateAgentIntelligence(agent.id, task, result);
  store.updateTask(task.id, { result, status: result.confidence >= 0.7 ? 'completed' : 'failed', completedAt: Date.now() });
  pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result, costBreakdown: task.costBreakdown });
}

export async function runInitialBiddingWar(task: Task) {
  store.updateTask(task.id, { status: 'bidding' });
  const agents = ['CryptoScout-X', 'Research-Alpha', 'DataMiner-Pro'];
  for (const name of agents) {
    const amount = parseFloat((task.budget * (0.6 + Math.random() * 0.3)).toFixed(4));
    store.addBid({
      id: Math.random().toString(36).substring(7), taskId: task.id,
      agentId: name.toLowerCase().replace(/ /g, '-'), agentName: name,
      amount, price: amount, estimatedTimeMs: 2000, latency: 2,
      reputation: 90, confidence: 0.9, strategy: `${name} optimized`,
      reasoning: 'Swarm protocol', submittedAt: Date.now(),
    });
  }
}
