import { supabaseAdmin } from './supabase'
import { pipelineEvents } from './events'
import { logTaskEvent } from './supabase'

export type ReputationOutcome =
  | 'subtask_success'
  | 'subtask_failure'
  | 'orchestrator_success'
  | 'orchestrator_failure'

const DELTA: Record<ReputationOutcome, number> = {
  subtask_success: +1,
  subtask_failure: -2,
  orchestrator_success: +3,
  orchestrator_failure: -5
}

/**
 * Dual-layer reputation update:
 *
 * Layer 1 — Supabase (fast, queryable by the UI):
 *   reputation_apply_delta RPC atomically clamps + updates agents.reputation
 *   and writes an audit row to reputation_events. Single round-trip.
 *
 * Layer 2 — ERC-8004 Reputation Registry on Sepolia (on-chain, judge-verifiable):
 *   giveFeedback() writes a signed on-chain reputation entry.
 *   tag1 = outcome, tag2 = taskId — any external party can call
 *   getSummary(tokenId, [platformAddress], outcome, "") on Sepolia
 *   to independently verify an agent's performance history.
 *   This runs fire-and-forget so it doesn't block the pipeline.
 */
export async function updateAfterTask(
  taskId: string,
  agentId: string,
  outcome: ReputationOutcome
): Promise<{ before: number | null; after: number | null }> {
  const delta = DELTA[outcome]
  if (!supabaseAdmin) return { before: null, after: null }

  const { data, error } = await supabaseAdmin.rpc('reputation_apply_delta', {
    p_agent_id: agentId,
    p_task_id: taskId,
    p_delta: delta,
    p_reason: outcome
  })

  if (error) {
    console.error('[REPUTATION] apply_delta failed:', error.message)
    return { before: null, after: null }
  }

  const after = typeof data === 'number' ? data : null
  const before = after != null ? after - delta : null

  pipelineEvents.emit('reputation:updated', {
    taskId, agentId, outcome, delta, before, after, timestamp: Date.now()
  })
  void logTaskEvent(taskId, 'reputation:updated', { agentId, outcome, delta, before, after }).catch(() => {})

  // ERC-8004 on-chain reputation — fire-and-forget, does not block pipeline
  void import('./erc8004').then(({ submitReputationFeedback }) =>
    submitReputationFeedback(agentId, taskId, outcome)
      .then(txHash => {
        if (txHash) console.log(`[REPUTATION] ERC-8004 feedback tx: ${txHash}`)
      })
      .catch(e => console.error('[REPUTATION] ERC-8004 feedback failed:', e))
  )

  return { before, after }
}
