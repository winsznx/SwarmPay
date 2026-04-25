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
 * Atomic reputation update via the `reputation_apply_delta` RPC defined
 * in migrations/005_reputation.sql. Reads current → clamps → writes the
 * audit row → updates agents row → recomputes success_rate, all in one
 * Postgres function. Single round-trip; safe under concurrent settlement.
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

  // Live UI signal — sidebar + leaderboard subscribe and animate +N/-N pop
  pipelineEvents.emit('reputation:updated', {
    taskId, agentId, outcome, delta, before, after, timestamp: Date.now()
  })
  void logTaskEvent(taskId, 'reputation:updated', { agentId, outcome, delta, before, after }).catch(() => {})

  return { before, after }
}
