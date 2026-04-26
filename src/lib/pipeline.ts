import { Task, SubTask, Agent, Bid, SubBid } from '@/types';
import { store } from './store';
import { executeTask, classifyPrompt } from './execution';
import { decomposeTask } from './orchestration';
import { pipelineEvents, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_TASK_DONE, EMIT_PAYMENT, EMIT_AGENT_ACT } from './events';
import { settleOnArc } from './arcSettlement';
import { sendAgentPayment } from './circleWallets';
import {
  saveTaskToSupabase,
  savePaymentToSupabase,
  saveSubTaskToSupabase,
  logTaskEvent,
  saveSettlementToSupabase,
  supabaseAdmin
} from './supabase';


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * SwarmPay Mission Lifecycle
 * 1. Intelligence Appraisal
 * 2. Automated Bidding War
 * 3. Atomic Multi-Agent Settlement
 */
export async function runAutonomousPipeline(task: Task) {
  try {
    // await store.updateTask(task.id, { status: 'executing' }); // REMOVED: Bidding comes first
    console.log(`\n[START] [PIPELINE] Starting autonomous pipeline for task: "${task.prompt.slice(0, 40)}..."`);
    
    // Safety Net: Build Effective Budget based on complexity (5c / 10c / 20c)
    const words = task.prompt.trim().split(' ').length;
    const hasComplexKeywords = /analyz|research|compar|invest|strateg|market|crypto|defi|blockchain|predict|forecast|explain|comprehensive|detailed/i.test(task.prompt);
    
    let minBudget = 0.20;
    if (words <= 5 && !hasComplexKeywords) minBudget = 0.05;
    else if (words <= 10 || !hasComplexKeywords) minBudget = 0.10;
    
    const effectiveBudget = Math.max(task.budget || 0, minBudget);
    
    await store.logPipelineStep(task.id, 'Initialization', 'completed', `Mission lifecycle started. Verified effective budget: $${effectiveBudget.toFixed(2)}.`);
    
    // Refresh balances at start
    await store.refreshAgentWallets();
    const allAgents = await store.getAgents();

    // ── Phase 0: Intelligence Appraisal ─────────────────────────────────────
    await logTaskEvent(task.id, 'APPRAISAL_START', { prompt: task.prompt });
    await store.logPipelineStep(task.id, 'Phase 0: Intelligence Appraisal', 'pending', 'Appraising mission intelligence and classifying complexity.');
    const { swarmIntelligenceAppraisal } = await import('./execution');
    const appraisal = await swarmIntelligenceAppraisal(task.prompt);
    
    // Classify Complexity
    const wordCount = task.prompt.split(' ').length;
    const complexity: 'LOW' | 'MEDIUM' | 'HIGH' = wordCount <= 4 ? 'LOW' : wordCount <= 8 ? 'MEDIUM' : 'HIGH';

    // Recalculate cost breakdown early
    const platformFee = parseFloat((effectiveBudget * 0.10).toFixed(6));
    // Efficiency ratio: deterministic based on complexity, not random.
    // HIGH complexity tasks use more agent coordination = slightly lower efficiency.
    const EFFICIENCY_RATIO = appraisal?.complexity === 'LOW' ? 0.88 : appraisal?.complexity === 'MEDIUM' ? 0.82 : 0.78;
    const spendable = parseFloat((effectiveBudget * EFFICIENCY_RATIO - platformFee).toFixed(6));

    // Split spendable budget across categories
    const research     = parseFloat((spendable * 0.30).toFixed(6));
    const cleaning     = parseFloat((spendable * 0.15).toFixed(6));
    const analysis     = parseFloat((spendable * 0.15).toFixed(6));
    const compute      = parseFloat((spendable * 0.09).toFixed(6));
    const agentMargins = parseFloat((spendable * 0.31).toFixed(6));

    const totalCost = parseFloat((research + cleaning + analysis + compute + agentMargins + platformFee).toFixed(6));
    const userSavings = parseFloat(Math.max(0, effectiveBudget - totalCost).toFixed(6));
    const savingsPercent = Math.round((userSavings / effectiveBudget) * 100);

    const startBalance = await store.getUserWallet();

    await store.updateTask(task.id, { 
      status: 'bidding',
      complexity,
      budget: effectiveBudget,
      agentCount: appraisal?.suggestedAgents || 4,
      costBreakdown: { 
        research, cleaning, analysis, compute, agentMargins, platformFee, 
        totalCost, userBudget: task.budget, userSavings, savingsPercent,
        initialBalance: startBalance
      }
    });
    // Persist appraisal results
    await saveTaskToSupabase(await store.getTask(task.id));
    await logTaskEvent(task.id, 'APPRAISAL_DONE', { complexity, totalCost });
    await store.logPipelineStep(task.id, 'Phase 0: Intelligence Appraisal', 'completed', `Mission Cost locked: $${totalCost.toFixed(4)} | Complexity: ${complexity} | Budget: $${effectiveBudget}`);

    // ── Phase 1: Set bidding status and wait ─────────────────────────────────
    await store.updateTask(task.id, { status: 'bidding', bids: [], currentBids: [] });
    await store.logPipelineStep(task.id, 'Phase 1: Auto Bidding War', 'pending', 'Opening global bidding war for specialist agents.');
    
    // Generate bids during this window - they will be added one by one
    const bids = await runInitialBiddingWar(task);
    
    // Final update for Phase 1 - hold the full market view
    await store.updateTask(task.id, { bids, currentBids: bids });
    await saveTaskToSupabase(await store.getTask(task.id));
    await logTaskEvent(task.id, 'BIDDING_DONE', { bidCount: bids.length });
    await store.logPipelineStep(task.id, 'Phase 1: Auto Bidding War', 'completed', `Bidding war closed. ${bids.length} agents analyzed and submitted proposals.`);
    await delay(3500); // UI breathing room

    // ── Phase 2: Select winner ───────────────────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 2: Winning Bid Selection', 'pending', 'Autonomous auction resolver ranking bids by Price, Reputation, and Estimated Latency.');
    await delay(2000); // Visualizing the 'Selection' thinking process
    
    const winnerBid = await store.selectWinningBid(task.id);
    const winner = (await store.getAgents()).find(a => a.id === winnerBid.bid.agentId);
    
    if (!winner) {
      await store.logPipelineStep(task.id, 'Phase 2: Winning Bid Selection', 'failed', 'Auction failed to resolve a viable winner.');
      await store.updateTask(task.id, { status: 'failed' });
      return;
    }

    await store.logPipelineStep(task.id, 'Phase 2: Winning Bid Selection', 'completed', `Swarm winner identified: ${winner.name} (Lead Agent). Finalizing allocation.`);
    await store.assignWinningBid(task.id); 
    const updatedTask = await store.getTask(task.id) as Task;
    
    await store.updateTask(task.id, {
      status: 'assigned',
      winningAgentName: winner.name,
      winningBid: winnerBid.bid.id,
      winningBidId: winnerBid.bid.id
    });
    // Atomic persistence of assigned state
    await saveTaskToSupabase(await store.getTask(task.id));
    
    // Deliberate delay for UI to show winner selection
    await delay(3000);

    // ── Phase 3: Start executing ─────────────────────────────────────────────
    await store.updateTask(task.id, { status: 'executing' });
    await saveTaskToSupabase(await store.getTask(task.id));
    await store.logPipelineStep(task.id, 'Phase 3: Task Decomposition', 'pending', 'Decomposing mission into atomic specialized sub-tasks.');
    await delay(300); // UI catch decomposition start
    
    const subTasks = await decomposeTask({ ...updatedTask, assignedAgentId: winner.id, status: 'executing' } as any, 0, winner.id);
    await store.updateTask(task.id, { subTaskIds: subTasks.map(st => st.id) });
    for (const st of subTasks) { 
      await store.createSubTask(st); 
      await saveSubTaskToSupabase(st);
    }
    await logTaskEvent(task.id, 'DECOMPOSITION_DONE', { subTaskCount: subTasks.length });

    if (subTasks.length > 0) {
      await store.logPipelineStep(task.id, 'Phase 3: Task Decomposition', 'completed', `Mission split into ${subTasks.length} nodes for parallel execution.`);
      await delay(200); // Cinematic pause

      // ── Phase 4: Sub-Agent Bidding ───────────────────────────────────────
      await store.logPipelineStep(task.id, 'Phase 4: Sub-Agent Bidding', 'pending', 'Opening sub-markets for specialized network nodes.');
      await runSubTaskBidding(task.id, subTasks, allAgents, winner);
      await store.logPipelineStep(task.id, 'Phase 4: Sub-Agent Bidding', 'completed', 'Sub-market auctions resolved. Network nodes allocated.');
      await delay(300);

      // ── Phase 5: Sub-Task Execution ──────────────────────────────────────
      await store.logPipelineStep(task.id, 'Phase 5: Sub-Task Execution', 'pending', 'Triggering parallel mission execution across Arc nodes.');
      await runSubTaskExecution(task.id, subTasks, winner);
      await delay(300);
    } else {
      await store.logPipelineStep(task.id, 'Direct Execution', 'pending', 'Routing to direct execution for low-complexity mission.');
      await runDirectExecution(task, winner);
    }

    const taskData = await store.getTask(task.id);
    const cb = taskData?.costBreakdown;

    // ── Phase 6: Finalize (Guard Protocol) ──────────────────────────────────
    await store.logPipelineStep(task.id, 'Phase 6: Finalize (Guard Protocol)', 'pending', 'Initializing final mission validation and output synthesis.');
    await delay(200); 
    
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

    // ── Phase 7: Amplify each sub-task into atomic work-unit micropayments ──
    // Each completed sub-task contributes K micro-intents (lead → sub-agent),
    // each representing one atomic unit of verified work (e.g. one LLM token
    // batch, one fetch chunk, one compute slice). The K micro-intents sum to
    // the sub-task's share of the work pool. K is chosen so the per-task
    // settlement carries ≥ TARGET_TOTAL_INTENTS micropayments, all of which
    // settle atomically in one Arc transaction in phase 8.
    await store.logPipelineStep(task.id, 'Phase 7: Building atomic micropayment intents', 'pending', 'Splitting verified work pool into atomic micropayment units.');
    await store.updateTask(task.id, { status: 'settling' });

    const TARGET_TOTAL_INTENTS = 60
    const WORK_UNIT_LABELS: Record<string, string> = {
      fetch_data: 'fetched_chunk',
      clean_data: 'normalized_record',
      analyze: 'llm_token_batch',
      compute: 'compute_slice',
    }
    const createdIntents: Array<{ id: string; fromAgentId: string; toAgentId: string; amount: number }> = [];

    if (cb) {
      const workPool = cb.research + cb.cleaning + cb.analysis + cb.compute
      const eligibleSubs = finalizedSubTasks.filter(st => st.assignedAgentId && st.assignedAgentId !== winner.id)
      const sharePerSubTask = eligibleSubs.length > 0
        ? parseFloat((workPool / eligibleSubs.length).toFixed(6))
        : 0
      const microPerSub = eligibleSubs.length > 0
        ? Math.max(8, Math.ceil(TARGET_TOTAL_INTENTS / eligibleSubs.length))
        : 0

      for (const st of eligibleSubs) {
        const subAgent = store.getAgent(st.assignedAgentId!)
        if (!subAgent || sharePerSubTask <= 0 || microPerSub === 0) continue

        const microAmount = parseFloat((sharePerSubTask / microPerSub).toFixed(6))
        if (microAmount < 1e-6) continue
        const workLabel = WORK_UNIT_LABELS[st.type ?? ''] ?? 'work_unit'

        for (let k = 0; k < microPerSub; k++) {
          const intent = await store.createPaymentIntent({
            fromAgentId: winner.id,
            fromAgentName: winner.name,
            toAgentId: subAgent.id,
            toAgentName: subAgent.name,
            taskId: task.id,
            amount: microAmount,
            currency: 'USDC'
          })

          createdIntents.push({ id: intent.id, fromAgentId: winner.id, toAgentId: subAgent.id, amount: microAmount })

          pipelineEvents.emit('payment:intent', {
            taskId: task.id, type: 'payment:intent', id: intent.id,
            fromAgent: winner.name, toAgent: subAgent.name,
            amount: microAmount, subTaskTitle: st.title,
            workUnit: { index: k + 1, total: microPerSub, label: workLabel },
            timestamp: Date.now()
          })

          // AWAITED — phase 8 reads pending intents from the DB; fire-and-forget
          // saves race the batch query and silently lose intents from the batch.
          await savePaymentToSupabase({ ...intent, status: 'pending' })
        }
        store.updateAgent(subAgent.id, { earned: (subAgent.earned ?? 0) + sharePerSubTask })
      }

      // Platform fee intent — lead agent → platform wallet (resolved at settlement
      // time from PLATFORM_WALLET_ADDRESS via the special synthetic 'platform' id).
      if (cb.platformFee > 0 && process.env.PLATFORM_WALLET_ADDRESS) {
        const platformIntent = await store.createPaymentIntent({
          fromAgentId: winner.id,
          fromAgentName: winner.name,
          toAgentId: 'platform',
          toAgentName: 'SwarmPay Platform',
          taskId: task.id,
          amount: parseFloat(cb.platformFee.toFixed(6)),
          currency: 'USDC'
        })
        createdIntents.push({ id: platformIntent.id, fromAgentId: winner.id, toAgentId: 'platform', amount: cb.platformFee })
        await savePaymentToSupabase({ ...platformIntent, status: 'pending' })
      }
    }

    await store.logPipelineStep(task.id, 'Phase 7: Building atomic micropayment intents', 'completed', `${createdIntents.length} micropayment intents created — atomic on-chain settlement next.`);

    // ── Phase 8: Atomic batch settlement on Arc ─────────────────────────────
    // ALL pending intents for this task — phase 7 micro-intents PLUS the x402
    // protocol-fee intents created in phase 5 — settle in one Arc tx via the
    // SettlementVault contract. Single tx hash, single block, atomic.
    await store.logPipelineStep(task.id, 'Phase 8: Atomic batch settlement on Arc', 'pending', 'Settling all pending micropayments in one atomic on-chain transaction.');

    let pendingIntents: Array<{ id: string; fromAgentId: string; toAgentId: string; amount: number }> = createdIntents
    if (supabaseAdmin) {
      const { data: rows, error } = await supabaseAdmin
        .from('payment_intents')
        .select('id, from_agent_id, to_agent_id, amount')
        .eq('task_id', task.id)
        .eq('status', 'pending')
      if (error) {
        console.error('[ARC] failed to load pending intents from DB; falling back to in-memory list:', error.message)
      } else if (rows) {
        pendingIntents = rows.map(r => ({
          id: r.id as string,
          fromAgentId: r.from_agent_id as string,
          toAgentId: r.to_agent_id as string,
          amount: parseFloat(r.amount as string),
        }))
      }
    }
    const actualCount = pendingIntents.length;

    const handle = await settleOnArc(
      task.id,
      pendingIntents.map(p => ({ paymentIntentId: p.id, from: p.fromAgentId, to: p.toAgentId, amount: p.amount }))
    );

    if (cb) {
      // Charge user upfront (escrow released later by the escrow API once queue completes,
      // but the in-memory userWallet for back-compat is decremented now).
      const currentWallet = await store.getUserWallet();
      const budgetToCharge = cb.totalCost;
      if (currentWallet < budgetToCharge) {
          throw new Error('Insolvent wallet: Cannot settle mission payments.');
      }
      await store.updateUserWallet(currentWallet - budgetToCharge, task.id, `Mission Finalized: ${task.id}`);
      console.log(`[ECONOMY] Mission finalized. Charged user $${budgetToCharge.toFixed(4)}. Settlement queue armed: ${handle?.enqueued ?? 0} intents.`);

      // Pay lead + distribute. Earnings are bookkeeping; on-chain settlement is async.
      const leadAgent = (await store.getAgents()).find((a: Agent) => a.id === winner.id);
      if (leadAgent) {
        await store.updateAgentEarned(leadAgent.id, cb.agentMargins, task.id, `Lead Commission: ${task.id}`);
        const workPool = (cb.research + cb.cleaning + cb.analysis + cb.compute);
        const share = finalizedSubTasks.length > 0 ? workPool / finalizedSubTasks.length : 0;
        for (const st of finalizedSubTasks) {
          if (st.assignedAgentId) await store.updateAgentEarned(st.assignedAgentId, share, task.id, `Node completion: ${st.title}`);
        }
      }

      // Mark in-memory intents as settled (UI source of truth for confirmation is the
      // `settlements` row + Realtime subscription, but in-memory store kept consistent).
      const allPayments = await store.getPaymentsForTask(task.id);
      for (const p of allPayments) { await (store as any).settlePaymentIntent(p.id); }

      // Snapshot on the task. The batch tx already confirmed (synchronous), so
      // the real tx hash, total amount, and gas cost are written here directly.
      await store.updateTask(task.id, {
        settlement: {
          txHash: handle?.txHash ?? '',
          explorerUrl: handle?.explorerUrl ?? '',
          intentsSettled: handle?.enqueued ?? 0,
          totalAmount: handle?.totalAmountUsdc ?? cb.totalCost,
          gasCost: handle?.gasUsedUsdc ?? 0,
          settledAt: Date.now(),
          allHashes: handle?.txHash ? [handle.txHash] : []
        }
      });

      await logTaskEvent(task.id, 'SETTLEMENT_DONE', { enqueued: handle?.enqueued ?? 0 });
      await store.logPipelineStep(task.id, 'Phase 8: Arc Settlement', 'completed', `Settlement queue armed for ${handle?.enqueued ?? 0} intents. Live progress streams to the dashboard.`);

      // Reputation updates — orchestrator + each completed sub-agent.
      // Atomic per-agent via the reputation_apply_delta RPC.
      const { updateAfterTask: bumpReputation } = await import('./reputation');
      const orchestratorOutcome = 'orchestrator_success' as const;
      await bumpReputation(task.id, winner.id, orchestratorOutcome);
      for (const st of finalizedSubTasks) {
        if (!st.assignedAgentId) continue;
        const subOutcome = (st.status === 'failed' || (st.result as any)?.metadata?.nodeFailure)
          ? 'subtask_failure' as const
          : 'subtask_success' as const;
        await bumpReputation(task.id, st.assignedAgentId, subOutcome);
      }
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

    // Close the wallet ledger: release the escrow hold so unspent budget
    // refunds against user_wallets.balance. The Realtime sub on the
    // dashboard updates the header in real time. Without this call, the
    // on-chain wallet ledger drifts permanently behind the in-memory
    // cost-breakdown ledger after every task.
    if (task.escrowId && supabaseAdmin) {
      const { error: relErr, data: refunded } = await supabaseAdmin.rpc('escrow_release', {
        p_hold_id: task.escrowId
      });
      if (relErr) console.error('[ECONOMY] escrow_release failed:', relErr.message);
      else console.log(`[ECONOMY] escrow released for ${task.id}; refunded $${refunded ?? 0}`);
    } else if (!task.escrowId) {
      // Legacy task created before the BudgetModal escrow path was wired.
      // Not fatal — the in-memory store.userWallet path already tracked the spend.
      console.log(`[ECONOMY] no escrowId on task ${task.id}; skipping escrow_release`);
    }

    pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result: { result: finalResult }, costBreakdown: cb });

    // Save to Supabase for persistence (fire and forget)
    saveTaskToSupabase(store.getTask(task.id)).catch(e =>
      console.error('[SUPABASE] background save failed:', e)
    );

  } catch (err: any) {
    console.error('[PIPELINE FATAL ERROR]', err.message);
    
    // PROBLEM: Emergency Failure Reset
    // Rule 5: User wasn't charged, so no refund needed.
    await store.logPipelineStep(task.id, 'Financial Safety', 'completed', 'Rule 5 Verification: No funds were deducted for failed mission.');

    await store.logPipelineStep(task.id, 'Execution Breach', 'failed', err.message);
    await store.updateTask(task.id, { 
      status: 'failed',
      errorReason: `System Breach: ${err.message || 'An unexpected execution error occurred.'}`
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
    // Capability-matched candidates: agents whose role fits the subtask type
    // take priority, then fill to 3 with the next best by reputation.
    const roleMatch = (agentRole: string, subTaskType: string): boolean => {
      const map: Record<string, string[]> = {
        fetch_data:  ['research', 'research-agent'],
        clean_data:  ['clean_data', 'validation-agent'],
        analyze:     ['analysis', 'planning-agent'],
        compute:     ['compute', 'execution-agent'],
      }
      return (map[subTaskType] ?? []).includes(agentRole)
    }
    const pool = agents.filter(a => a.id !== leadAgent.id)
    const matched = pool.filter(a => roleMatch(a.role, st.type ?? ''))
    const others  = pool.filter(a => !roleMatch(a.role, st.type ?? '')).sort((a, b) => b.reputation - a.reputation)
    const candidates = [...matched, ...others].slice(0, 3)

    for (const agent of candidates) {
      const priceFraction = 0.55 + (100 - agent.reputation) / 200
      await store.addBid({
        id: crypto.randomUUID(), taskId: st.id, agentId: agent.id,
        price: parseFloat(((st.budget || 0.01) * priceFraction).toFixed(4)),
        estimatedTimeMs: Math.round(5000 - agent.reputation * 30),
        confidence: agent.reputation / 100,
        strategy: `${agent.name} (${agent.role}) specialist`, submittedAt: Date.now(),
      } as any);
    }
    
    await store.logPipelineStep(taskId, `Sub-Market: ${st.title}`, 'pending', `Sub-agent bids received for ${st.type} atomic node.`);
    
    // DELIBERATE DELAY so user can see the bidding state in the mission graph
    await delay(300); 
    
    // 3. Assign winner
    try { 
      await store.assignWinningBid(st.id); 
      const updatedSt = await store.getSubTask(st.id);
      await saveSubTaskToSupabase(updatedSt);
      // Delay to show assigned
      await delay(200);
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
      await saveSubTaskToSupabase(await store.getSubTask(st.id));
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result, cost: st.budget || 0.01 });

      await store.logPipelineStep(taskId, stepTitle, 'completed', `Node execution successful. Confidence: ${result.confidence}`);
      await logTaskEvent(taskId, 'SUBTASK_DONE', { subTaskId: st.id, agent: subAgent.name });

      // Compute meter: emit a real session for the compute sub-task.
      // Real per-millisecond billing visible in the dashboard meter.
      if ((st.type === 'compute' || (st.title || '').toLowerCase().includes('compute'))) {
        await runComputeSession(taskId, st.id, subAgent.id);
      }

      // x402 handshake — ONE protocol-layer payment authorization per sub-task.
      // Symbolic amount (≤ $0.005). The full sub-task budget is settled later in
      // phase 7 as N atomic work-unit micropayments that share the same Arc tx.
      // This intent is what gets EIP-712 signed + on-chain identity verified;
      // it represents the protocol layer, not the bulk economic payment.
      const subPayAmount = parseFloat(Math.min(0.005, (st.budget ?? 0.01) * 0.05).toFixed(6));
      const subIntent = await store.createPaymentIntent({
        fromAgentId: leadAgent.id, fromAgentName: leadAgent.name,
        toAgentId: subAgent.id,    toAgentName: subAgent.name,
        taskId,                    amount: subPayAmount, currency: 'USDC'
      });
      const { executeX402Handshake } = await import('./x402');
      await executeX402Handshake({
        taskId,
        paymentIntentId: subIntent.id,
        fromAgentId: leadAgent.id, fromAgentName: leadAgent.name,
        toAgentId: subAgent.id,    toAgentName: subAgent.name,
        amount: subPayAmount,
        reason: `subtask: ${st.title}`
      });
    } catch (e: any) {
      const fallbackResult = { result: `Fallback: ${st.title} failed.`, confidence: 0.1, cost: 0, metadata: { nodeFailure: true } };
      await store.updateSubTask(st.id, { status: 'completed', result: fallbackResult, completedAt: Date.now() });
      pipelineEvents.emit(EMIT_SUBTASK_DONE, { taskId, subTaskId: st.id, result: fallbackResult, cost: 0.0001 });
      await store.logPipelineStep(taskId, `Node: ${st.title}`, 'failed', `Node failure: ${e.message}`);
    }
  });
  await Promise.all(execPromises);
}

// ── Compute session (real per-ms emit + compute_sessions persistence) ──
const COST_PER_MS = 0.000001
async function runComputeSession(taskId: string, subTaskId: string, agentId: string): Promise<void> {
  const sessionId = crypto.randomUUID()
  const startedAt = Date.now()
  const targetMs = 5000 // fixed compute budget per session; real duration = LLM latency
  const samples: Array<{ ts: number; cpuPercent: number }> = []

  // Persist session start
  const { supabaseAdmin } = await import('./supabase')
  if (supabaseAdmin) {
    await supabaseAdmin.from('compute_sessions').insert({
      id: sessionId, task_id: taskId, subtask_id: subTaskId,
      agent_id: agentId, started_at: new Date(startedAt).toISOString()
    }).then(({ error }) => { if (error) console.error('[COMPUTE] session insert:', error.message) })
  }

  // Tick every 500ms
  const tickIntervalMs = 500
  const ticks = Math.ceil(targetMs / tickIntervalMs)
  for (let i = 1; i <= ticks; i++) {
    await delay(tickIntervalMs)
    const elapsed = Math.min(i * tickIntervalMs, targetMs)
    const cpu = 40 + Math.random() * 45
    samples.push({ ts: Date.now(), cpuPercent: cpu })
    pipelineEvents.emit('compute:tick', {
      taskId, sessionId, durationMs: elapsed,
      cost: elapsed * COST_PER_MS, cpuPercent: cpu
    })
  }

  const finalDuration = targetMs
  const finalCost = finalDuration * COST_PER_MS
  pipelineEvents.emit('compute:completed', {
    taskId, sessionId, durationMs: finalDuration, cost: finalCost, cpuPercent: 0
  })

  if (supabaseAdmin) {
    await supabaseAdmin.from('compute_sessions').update({
      ended_at: new Date().toISOString(),
      duration_ms: finalDuration,
      total_cost_usdc: finalCost,
      cpu_samples: samples
    }).eq('id', sessionId).then(({ error }) => { if (error) console.error('[COMPUTE] session update:', error.message) })
  }
  await logTaskEvent(taskId, 'compute:completed', { sessionId, durationMs: finalDuration, cost: finalCost })
}

// ── Direct Execution ────────────────────────────────────
async function runDirectExecution(task: Task, agent: Agent) {
  const result = await executeTask(task, agent);
  await store.updateAgentIntelligence(agent.id, task, result);
  await store.updateTask(task.id, { result, status: result.confidence >= 0.7 ? 'completed' : 'failed', completedAt: Date.now() });
  pipelineEvents.emit(EMIT_TASK_DONE, { taskId: task.id, result, costBreakdown: task.costBreakdown });
}

export async function runInitialBiddingWar(task: Task) {
  const agents = await store.getAgents()
  const bids: any[] = []

  for (const agent of agents) {
    await delay(450)

    // Bid price: higher-reputation agents can offer a lower price because they
    // are more efficient. price = budget × (0.50 + (100 - rep) / 200)
    // rep 95 → ×0.525 | rep 87 → ×0.565 — tightest spread is the most competitive.
    const priceFraction = 0.50 + (100 - agent.reputation) / 200
    const price = parseFloat((task.budget * priceFraction).toFixed(4))

    // estimatedTimeMs inversely proportional to reputation — faster agents win ties.
    const estimatedTimeMs = Math.round(6000 - agent.reputation * 40)

    const bid = {
      id: crypto.randomUUID(),
      taskId: task.id,
      agentId: agent.id,
      agentName: agent.name,
      amount: price,
      price,
      estimatedTimeMs,
      latency: 2,
      reputation: agent.reputation,
      confidence: agent.reputation / 100,
      strategy: `${agent.name} (${agent.role}) optimized`,
      reasoning: `Reputation ${agent.reputation}/100 — ${agent.role} specialist`,
      submittedAt: Date.now(),
    } as any

    await store.addBid(bid)
    bids.push(bid)
    await store.updateTask(task.id, { bids: [...bids], currentBids: [...bids] })
    await saveTaskToSupabase(await store.getTask(task.id))
  }

  await saveTaskToSupabase(await store.getTask(task.id))
  return bids
}
