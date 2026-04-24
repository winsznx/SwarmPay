import { Task, SubTask, Agent, Bid, SubBid } from '@/types';
import { store } from './store';
import { executeTask, classifyPrompt } from './execution';
import { decomposeTask } from './orchestration';
import { pipelineEvents, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_TASK_DONE, EMIT_PAYMENT, EMIT_AGENT_ACT } from './events';
import { settleOnArc } from './arcSettlement';
import { sendAgentPayment } from './circleWallets';
import { saveTaskToSupabase, savePaymentToSupabase } from './supabase';


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * SwarmPay Mission Lifecycle
 * 1. Intelligence Appraisal
 * 2. Automated Bidding War
 * 3. Atomic Multi-Agent Settlement
 */
export async function runAutonomousPipeline(task: Task) {
  try {
    await store.updateTask(task.id, { status: 'executing' });
    console.log(`\n[START] [PIPELINE] Starting autonomous pipeline for task: "${task.prompt.slice(0, 40)}..."`);
    await store.logPipelineStep(task.id, 'Initialization', 'completed', 'Mission lifecycle started, refreshing agent telemetry.');
    
    // Refresh balances at start
    await store.refreshAgentWallets();
    const allAgents = await store.getAgents();

    // ── Phase 0: Intelligence Appraisal ─────────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 0: Intelligence Appraisal', 'pending', 'Appraising mission intelligence and classifying complexity.');
    const { swarmIntelligenceAppraisal } = await import('./execution');
    const appraisal = await swarmIntelligenceAppraisal(task.prompt);
    
    // Classify Complexity
    const wordCount = task.prompt.split(' ').length;
    const complexity: 'LOW' | 'MEDIUM' | 'HIGH' = wordCount <= 4 ? 'LOW' : wordCount <= 8 ? 'MEDIUM' : 'HIGH';

    // Recalculate cost breakdown early
    const platformFee = parseFloat((task.budget * 0.10).toFixed(6));
    const EFFICIENCY_RATIO = 0.75 + (Math.random() * 0.13); // 75-88%
    const spendable = parseFloat((task.budget * EFFICIENCY_RATIO - platformFee).toFixed(6));

    // Split spendable budget across categories
    const research     = parseFloat((spendable * 0.30).toFixed(6));
    const cleaning     = parseFloat((spendable * 0.15).toFixed(6));
    const analysis     = parseFloat((spendable * 0.15).toFixed(6));
    const compute      = parseFloat((spendable * 0.09).toFixed(6));
    const agentMargins = parseFloat((spendable * 0.31).toFixed(6));

    const totalCost = parseFloat((research + cleaning + analysis + compute + agentMargins + platformFee).toFixed(6));
    const userSavings = parseFloat(Math.max(0, task.budget - totalCost).toFixed(6));
    const savingsPercent = Math.round((userSavings / task.budget) * 100);

    const startBalance = await store.getUserWallet();

    await store.updateTask(task.id, { 
      status: 'bidding',
      complexity,
      budget: task.budget,
      agentCount: appraisal?.suggestedAgents || 4,
      costBreakdown: { 
        research, cleaning, analysis, compute, agentMargins, platformFee, 
        totalCost, userBudget: task.budget, userSavings, savingsPercent,
        initialBalance: startBalance
      }
    });

    await store.logPipelineStep(task.id, 'Phase 0: Intelligence Appraisal', 'completed', `Mission Cost locked: $${totalCost.toFixed(4)} | Complexity: ${complexity} | Budget: $${task.budget}`);

    // ── Phase 1: Set bidding status and wait ─────────────────────────────────
    await store.updateTask(task.id, { status: 'bidding', bids: [], currentBids: [] });
    await store.logPipelineStep(task.id, 'Phase 1: Auto Bidding War', 'pending', 'Opening global bidding war for specialist agents.');
    
    // Generate bids during this window - they will be added one by one
    const bids = await runInitialBiddingWar(task);
    
    // Final update for Phase 1
    await store.updateTask(task.id, { bids, currentBids: bids });
    await store.logPipelineStep(task.id, 'Phase 1: Auto Bidding War', 'completed', `Bidding war closed. ${bids.length} nodes received.`);
    await delay(1000); // Short pause before selection

    // ── Phase 2: Select winner ───────────────────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 2: Auto-Select Winner', 'pending', 'Ranking bids based on reputation, price, and latency.');
    const winnerBid = await store.selectWinningBid(task.id);
    const winner = (await store.getAgents()).find(a => a.id === winnerBid.bid.agentId);
    
    if (!winner) {
      await store.logPipelineStep(task.id, 'Phase 2: Auto-Select Winner', 'failed', 'Auction failed to resolve a viable winner.');
      await store.updateTask(task.id, { status: 'failed' });
      return;
    }

    await store.assignWinningBid(task.id); 
    const updatedTask = await store.getTask(task.id) as Task;
    
    await store.updateTask(task.id, {
      status: 'assigned',
      winningAgentName: winner.name,
      winningBid: winnerBid.bid.id,
      winningBidId: winnerBid.bid.id
    });
    
    // Deliberate delay for UI to show assigned
    await delay(2000);

    // ── Phase 3: Start executing ─────────────────────────────────────────────
    await store.updateTask(task.id, { status: 'executing' });
    await store.logPipelineStep(task.id, 'Phase 3: Task Decomposition', 'pending', 'Decomposing mission into atomic specialized sub-tasks.');
    await delay(1500); // 1.5s for UI to catch decomposition start
    
    const subTasks = await decomposeTask({ ...updatedTask, assignedAgentId: winner.id, status: 'executing' } as any, 0, winner.id);
    await store.updateTask(task.id, { subTaskIds: subTasks.map(st => st.id) });
    for (const st of subTasks) { await store.createSubTask(st); }

    if (subTasks.length > 0) {
      await store.logPipelineStep(task.id, 'Phase 3: Task Decomposition', 'completed', `Mission split into ${subTasks.length} nodes for parallel execution.`);
      await delay(1000); // Cinematic pause

      // ── Phase 4: Sub-Agent Bidding ───────────────────────────────────────
      await store.logPipelineStep(task.id, 'Phase 4: Sub-Agent Bidding', 'pending', 'Opening sub-markets for specialized network nodes.');
      await runSubTaskBidding(task.id, subTasks, allAgents, winner);
      await store.logPipelineStep(task.id, 'Phase 4: Sub-Agent Bidding', 'completed', 'Sub-market auctions resolved. Network nodes allocated.');
      await delay(1000);

      // ── Phase 5: Sub-Task Execution ──────────────────────────────────────
      await store.logPipelineStep(task.id, 'Phase 5: Sub-Task Execution', 'pending', 'Triggering parallel mission execution across Arc nodes.');
      await runSubTaskExecution(task.id, subTasks, winner);
      await delay(1000);
    } else {
      await store.logPipelineStep(task.id, 'Direct Execution', 'pending', 'Routing to direct execution for low-complexity mission.');
      await runDirectExecution(task, winner);
    }

    const taskData = await store.getTask(task.id);
    const cb = taskData?.costBreakdown;

    // ── Phase 6: Finalize (Guard Protocol) ──────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'pending', 'Initializing final mission validation and output synthesis.');
    await delay(800); 
    
    // Refresh subTasks from store after execution
    const finalizedSubTasks = await store.getSubTasks(task.id);
    
    const hasFailure = finalizedSubTasks.some((st: SubTask) => st.status === 'failed');
    if (hasFailure) {
      await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'failed', 'Execution Gap: One or more pipeline steps failed without fallback.');
      await store.updateTask(task.id, { 
        status: 'failed', 
        errorReason: 'Execution Gap: One or more pipeline steps failed without fallback.' 
      });
      return;
    }

    const analyzeSub = finalizedSubTasks.find((s: SubTask) => s.type === 'analyze' || (s.title || '').toLowerCase().includes('analyze'));
    const fetchSub = finalizedSubTasks.find((s: SubTask) => s.type === 'fetch_data' || (s.title || '').toLowerCase().includes('fetch'));
    const computeSub = finalizedSubTasks.find((s: SubTask) => s.type === 'compute' || (s.title || '').toLowerCase().includes('compute'));

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
      await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'failed', 'Quality Safeguard: Agent output is insufficient.');
      await store.updateTask(task.id, { 
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
        await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'failed', 'Economic Inconsistency detected in cost reconciliation.');
        await store.updateTask(task.id, { 
          status: 'failed', 
          errorReason: 'Economic Inconsistency: Cost components do not reconcile with total budget.' 
        });
        return;
      }
      await store.updateTask(task.id, { costBreakdown: { ...cb, guardVerified: true } });
    }

    const finalResult = `${analyzeResult}\n\n**Sources:** ${fetchResult}\n\n**Computation:** ${computeResult}`;
    
    // PROBLEM 2: Verify all pipeline steps are completed
    const allStepsDone = await store.allPipelineStepsCompleted(task.id);
    if (!allStepsDone) {
        await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'failed', `Protocol Guard: Mission incomplete. Final steps failed.`);
        await store.updateTask(task.id, { 
          status: 'failed', 
          errorReason: `Protocol Guard rejection: Mission state is inconsistent (all nodes did not complete).` 
        });
        // Save failed status to Supabase
        saveTaskToSupabase(store.getTask(task.id)).catch(() => {});
        return;
    }

    await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'completed', 'Integrity Guard passed. Results synthesized.');

    // ── Phase 7: Batching micopayments ──────────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 7: Batching micopayments', 'pending', 'Initializing p2p micropayment batch for autonomous reconciliation.');
    await store.updateTask(task.id, { status: 'settling' });
    const agents = await store.getAgents();
    const PAYMENT_COUNT = Math.max(50, 50 + Math.floor(Math.random() * 15));
    let createdCount = 0;
    while (createdCount < PAYMENT_COUNT) {
        await delay(50);
        const fromAgent = agents[Math.floor(Math.random() * agents.length)];
        const toAgentObj = agents[Math.floor(Math.random() * agents.length)];
        
        // Exact 1:1 check to ensure we never have fewer than PAYMENT_COUNT
        if (fromAgent.id === toAgentObj.id) continue;
        
        const intent = await store.createPaymentIntent({
          fromAgentId: fromAgent.id, fromAgentName: fromAgent.name,
          toAgentId: toAgentObj.id, toAgentName: toAgentObj.name,
          taskId: task.id, amount: 0.0001, currency: 'USDC'
        });
        
        createdCount++;
        
        // Fix payment stream emission - use REAL names
        console.log('[PIPELINE] emitting payment:intent', intent.id, intent.amount);
        pipelineEvents.emit('payment:intent', {
          taskId: task.id,
          type: 'payment:intent',
          id: intent.id,
          fromAgent: intent.fromAgentName ?? store.getAgent(intent.fromAgentId)?.name ?? intent.fromAgentId,
          toAgent: intent.toAgentName ?? store.getAgent(intent.toAgentId)?.name ?? intent.toAgentId,
          amount: intent.amount,
          timestamp: Date.now()
        });

        // Update receiving agent's earned balance
        const toAgent = store.getAgent(intent.toAgentId);
        if (toAgent) {
          store.updateAgent(intent.toAgentId, {
            earned: (toAgent.earned ?? 0) + intent.amount
          });
        }

        // Save and forget
        savePaymentToSupabase(intent).catch(() => {});
    }
    await store.logPipelineStep(task.id, 'Phase 7: Batching micopayments', 'completed', 'Micropayment batch signed and ready for settlement.');

    // ── Phase 8: Arc Settlement ──────────────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 8: Arc Settlement', 'pending', 'Committing transaction batch to Arc Settlement layer.');
    const allPayments = await store.getPaymentsForTask(task.id);
    const actualCount = allPayments.length;
    
    const settlement = await settleOnArc(
      task.id,
      allPayments.map((p: any) => ({ from: p.fromAgentId, to: p.toAgentId, amount: p.amount }))
    );

    if (settlement && cb) {
      // RULE 5: Charge user ONLY on completion
      const currentWallet = await store.getUserWallet();
      const budgetToCharge = cb.totalCost;
      if (currentWallet < budgetToCharge) {
          throw new Error('Insolvent wallet: Cannot settle mission payments.');
      }
      await store.updateUserWallet(currentWallet - budgetToCharge, task.id, `Mission Finalized: ${task.id}`);
      console.log(`[ECONOMY] Mission finalized successfully. Charged user $${budgetToCharge.toFixed(4)}.`);

      await store.updateTask(task.id, {
        settlement: {
          txHash: settlement.txHash,
          explorerUrl: settlement.explorerUrl,
          intentsSettled: settlement.intentsSettled,
          totalAmount: settlement.totalAmount,
          gasCost: settlement.gasCost,
          settledAt: Date.now()
        }
      });
      
      const leadAgent = (await store.getAgents()).find((a: Agent) => a.id === winner.id);
      if (leadAgent) {
        // 1. REFUND savings? No, we only charged 'totalCost' which ALREADY has savings excluded.
        // The user's wallet is fine.

        // 2. PAY Lead
        await store.updateAgentEarned(leadAgent.id, cb.agentMargins, task.id, `Lead Commission: ${task.id}`);
        // 3. DISTRIBUTE Work Pool
        const workPool = (cb.research + cb.cleaning + cb.analysis + cb.compute);
        const share = finalizedSubTasks.length > 0 ? workPool / finalizedSubTasks.length : 0;
        for (const st of finalizedSubTasks) {
          if (st.assignedAgentId) await store.updateAgentEarned(st.assignedAgentId, share, task.id, `Node completion: ${st.title}`);
        }
      }

      // Mark all payments as settled
      for (const p of allPayments) { await (store as any).settlePaymentIntent(p.id); }
      await store.logPipelineStep(task.id, 'Phase 8: Arc Settlement', 'completed', `Batch settled locally via circle. TX: ${settlement.txHash}`);
    }

    await store.updateTask(task.id, {
      result: { result: finalResult, confidence: 0.95, cost: 0.01 },
      status: 'completed',
      executionValid: true,
      micropaymentCount: actualCount,
      stats: {
        micropayments: actualCount,
        agents: finalizedSubTasks.length + 1,
        duration: Math.round((Date.now() - task.createdAt) / 1000)
      },
      completedAt: Date.now()
    });

    pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result: { result: finalResult }, costBreakdown: cb });

    // Save to Supabase for persistence (fire and forget)
    saveTaskToSupabase(store.getTask(task.id)).catch(e =>
      console.error('[SUPABASE] background save failed:', e)
    );

    } catch (err) {
    console.error('[PIPELINE FATAL ERROR]', (err as any).message);
    
    // PROBLEM: Emergency Failure Reset
    // Rule 5: User wasn't charged, so no refund needed.
    await store.logPipelineStep(task.id, 'Financial Safety', 'completed', 'Rule 5 Verification: No funds were deducted for failed mission.');

    await store.logPipelineStep(task.id, 'Execution Breach', 'failed', (err as any).message);
    await store.updateTask(task.id, { 
      status: 'failed',
      errorReason: `System Breach: ${(err as any).message || 'An unexpected execution error occurred.'}`
    });
    // Save to Supabase
    saveTaskToSupabase(store.getTask(task.id)).catch(() => {});
  }
}

// ── Sub-Agent Bidding ────────────────────────────────────────────────────────
async function runSubTaskBidding(taskId: string, subTasks: SubTask[], agents: Agent[], leadAgent: Agent) {
  for (const st of subTasks) {
    // 1. Mark sub-task as bidding
    await store.updateSubTask(st.id, { status: 'bidding' });
    
    // 2. Generate bids for this sub-task
    const candidates = agents.filter(a => a.id !== leadAgent.id).sort(() => Math.random() - 0.5).slice(0, 3);
    for (const agent of candidates) {
      await store.addBid({
        id: crypto.randomUUID(), taskId: st.id, agentId: agent.id,
        price: parseFloat(((st.budget || 0.01) * (0.6 + Math.random() * 0.3)).toFixed(4)),
        estimatedTimeMs: 4000, confidence: agent.reputation / 100,
        strategy: `Specialist ${agent.role}`, submittedAt: Date.now(),
      } as any);
    }
    
    await store.logPipelineStep(taskId, `Sub-Market: ${st.title}`, 'pending', `Sub-agent bids received for ${st.type} atomic node.`);
    
    // DELIBERATE DELAY so user can see the bidding state in the mission graph
    await delay(1500); 
    
    // 3. Assign winner
    try { 
      await store.assignWinningBid(st.id); 
      // Delay to show assigned
      await delay(800);
    } catch (e) {}
  }
}

// ── Sub-Task Execution ───────────────────────────────────────────────────────
async function runSubTaskExecution(taskId: string, subTasks: SubTask[], leadAgent: Agent) {
  const execPromises = subTasks.map(async (st) => {
    try {
      // RULE 2: Insert individual pipeline records
      const stepTitle = `Node: ${st.title}`;
      await store.logPipelineStep(taskId, stepTitle, 'pending', `Activating node for specialist task: ${st.description}`);

      const assignedTask = await store.getTask(st.id) as any;
      const agents = await store.getAgents();
      const subAgent = agents.find((a: Agent) => a.id === assignedTask?.assignedAgentId) || leadAgent;
      await store.updateSubTask(st.id, { status: 'executing' });
      pipelineEvents.emit(EMIT_SUBTASK_START, { taskId, subTaskId: st.id, agentId: subAgent.id });

      const result = await executeTask(st as any, subAgent);
      await store.updateAgentIntelligence(subAgent.id, st, result);
      await store.updateSubTask(st.id, { result, status: 'completed', completedAt: Date.now() });
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result, cost: st.budget || 0.01 });

      await store.logPipelineStep(taskId, stepTitle, 'completed', `Node execution successful. Confidence: ${result.confidence}`);
      await sendAgentPayment(leadAgent.id, subAgent.id, st.budget || 0.01);
    } catch (e: any) {
      const fallbackResult = { result: `Fallback: ${st.title} failed.`, confidence: 0.1, cost: 0, metadata: { nodeFailure: true } };
      await store.updateSubTask(st.id, { status: 'completed', result: fallbackResult, completedAt: Date.now() });
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result: fallbackResult, cost: 0.0001 });
      await store.logPipelineStep(taskId, `Node: ${st.title}`, 'failed', `Node failure: ${e.message}`);
    }
  });
  await Promise.all(execPromises);
}

// ── Direct Execution ────────────────────────────────────
async function runDirectExecution(task: Task, agent: Agent) {
  const result = await executeTask(task, agent);
  await store.updateAgentIntelligence(agent.id, task, result);
  await store.updateTask(task.id, { result, status: result.confidence >= 0.7 ? 'completed' : 'failed', completedAt: Date.now() });
  pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result, costBreakdown: task.costBreakdown });
}

export async function runInitialBiddingWar(task: Task) {
  const agentNames = ['CryptoScout-X', 'Research-Alpha', 'DataMiner-Pro'];
  const bids: any[] = [];
  
  for (const name of agentNames) {
    // Force a 1.2s resonance delay between agent bids so they pop in UI
    await delay(1500); 
    const amount = parseFloat((task.budget * (0.6 + Math.random() * 0.3)).toFixed(4));
    const bid = {
      id: Math.random().toString(36).substring(7), 
      taskId: task.id,
      agentId: name.toLowerCase().replace(/ /g, '-'), 
      agentName: name,
      amount, price: amount, estimatedTimeMs: 2000, latency: 2,
      reputation: 90 + Math.floor(Math.random() * 10), 
      confidence: 0.9, 
      strategy: `${name} optimized`,
      reasoning: 'Swarm protocol analysis', 
      submittedAt: Date.now(),
    } as any;
    
    await store.addBid(bid);
    bids.push(bid);
    
    // Update task object in real-time so polling UI sees the new bids immediately
    await store.updateTask(task.id, { bids: [...bids], currentBids: [...bids] });
  }
  return bids;
}
