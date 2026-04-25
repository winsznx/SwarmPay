import { sendAgentPayment } from './circleWallets'
import { supabaseAdmin, logTaskEvent } from './supabase'
import { measureIntentGasCost } from './gasMeasurement'
import { pipelineEvents } from './events'

/**
 * Stateless settlement drain.
 *
 * The earlier in-memory queue (`src/lib/settlementQueue.ts`) couldn't
 * survive a Vercel serverless cold start: the queue Map died with the
 * function process before any intent confirmed.
 *
 * New design — distributed worker pattern:
 *   - Queue state lives in `payment_intents.status` (DB).
 *   - `claim_pending_intents` RPC atomically claims a batch via
 *     `FOR UPDATE SKIP LOCKED`, flipping rows from 'pending' → 'signed'.
 *   - Each row is processed serially within its source-wallet bucket
 *     (Circle nonce safety + per-wallet rate limit).
 *   - Successful confirmation: status='settled', append hash via
 *     `settlement_record_confirmed` RPC, schedule gas measurement.
 *   - Permanent failure (retry_count >= MAX_RETRIES): status='failed',
 *     `settlement_record_failed` RPC, error_message persisted.
 *   - Transient error: row released back to 'pending' with
 *     retry_count++ via `release_intent_to_pending` RPC.
 *
 * One drain processes a bounded batch (DRAIN_BATCH_SIZE) within the
 * Vercel function budget. The /api/settlement/drain endpoint
 * self-recurses via fire-and-forget HTTP if more remain.
 *
 * Concurrent drain calls for the same task are SAFE: SKIP LOCKED
 * ensures each row is claimed by exactly one worker.
 */

const PER_WALLET_DELAY_MS = parseInt(process.env.CIRCLE_PER_WALLET_DELAY_MS ?? '250', 10)
const MAX_RETRIES_429     = 3
const MAX_RETRIES_OTHER   = 1
const DRAIN_BATCH_SIZE    = 8

interface ClaimedIntent {
  id: string
  from_agent_id: string
  to_agent_id: string
  amount: number
  retry_count: number
}

export interface DrainResult {
  claimed: number
  confirmed: number
  failed: number
  retried: number
  remaining: number
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * Run one drain pass for a task. Returns counts so the caller can
 * decide whether to dispatch another invocation.
 */
export async function drainOnce(taskId: string): Promise<DrainResult> {
  if (!supabaseAdmin) {
    return { claimed: 0, confirmed: 0, failed: 0, retried: 0, remaining: 0 }
  }

  // 1. Atomically claim a batch of pending intents.
  const { data: claimed, error: claimErr } = await supabaseAdmin.rpc('claim_pending_intents', {
    p_task_id: taskId,
    p_limit:   DRAIN_BATCH_SIZE
  })

  if (claimErr) {
    console.error('[DRAIN] claim_pending_intents failed:', claimErr.message)
    return { claimed: 0, confirmed: 0, failed: 0, retried: 0, remaining: 0 }
  }

  const intents = (claimed ?? []) as ClaimedIntent[]
  if (intents.length === 0) {
    const remaining = await countPending(taskId)
    return { claimed: 0, confirmed: 0, failed: 0, retried: 0, remaining }
  }

  // 2. Bucket by sender wallet so each wallet processes serially
  //    (Circle nonces + per-wallet rate limit). Buckets run in parallel.
  const buckets = new Map<string, ClaimedIntent[]>()
  for (const intent of intents) {
    const arr = buckets.get(intent.from_agent_id) ?? []
    arr.push(intent)
    buckets.set(intent.from_agent_id, arr)
  }

  let confirmed = 0, failed = 0, retried = 0
  await Promise.all(
    Array.from(buckets.values()).map(async (bucketIntents) => {
      for (const intent of bucketIntents) {
        const result = await processOne(taskId, intent)
        if (result === 'confirmed') confirmed++
        else if (result === 'failed') failed++
        else retried++
        if (bucketIntents.length > 1) await sleep(PER_WALLET_DELAY_MS)
      }
    })
  )

  const remaining = await countPending(taskId)
  return { claimed: intents.length, confirmed, failed, retried, remaining }
}

async function processOne(
  taskId: string,
  intent: ClaimedIntent
): Promise<'confirmed' | 'failed' | 'retried'> {
  try {
    const txHash = await sendAgentPayment(intent.from_agent_id, intent.to_agent_id, intent.amount)
    if (txHash) {
      await markConfirmed(intent, txHash, taskId)
      // Background gas measurement — does not block the drain.
      void measureIntentGasCost(intent.id, txHash).catch(() => {})
      return 'confirmed'
    }
    // null hash treated as transient
    return await maybeRetry(intent, taskId, 'sendAgentPayment returned null')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return await maybeRetry(intent, taskId, msg)
  }
}

async function maybeRetry(
  intent: ClaimedIntent,
  taskId: string,
  errorMessage: string
): Promise<'failed' | 'retried'> {
  const is429 = /429|rate limit/i.test(errorMessage)
  const cap = is429 ? MAX_RETRIES_429 : MAX_RETRIES_OTHER
  if (intent.retry_count + 1 > cap) {
    await markFailed(intent, errorMessage, taskId)
    return 'failed'
  }
  // Release back to pending; next drain pass picks it up.
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin.rpc('release_intent_to_pending', {
      p_intent_id: intent.id,
      p_error_message: errorMessage
    })
    if (error) console.error('[DRAIN] release_intent_to_pending failed:', error.message)
  }
  return 'retried'
}

async function markConfirmed(intent: ClaimedIntent, txHash: string, taskId: string): Promise<void> {
  const evt = {
    taskId,
    paymentIntentId: intent.id,
    fromAgentId: intent.from_agent_id,
    toAgentId: intent.to_agent_id,
    amount: intent.amount,
    txHash,
    explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
    timestamp: Date.now()
  }
  pipelineEvents.emit('payment:settled', evt)
  void logTaskEvent(taskId, 'payment:settled', evt).catch(() => {})

  if (!supabaseAdmin) return
  const { error: updErr } = await supabaseAdmin
    .from('payment_intents')
    .update({ status: 'settled' })
    .eq('id', intent.id)
  if (updErr) console.error('[DRAIN] payment_intents settled update failed:', updErr.message)

  const { error: rpcErr } = await supabaseAdmin.rpc('settlement_record_confirmed', {
    p_task_id: taskId,
    p_tx_hash: txHash
  })
  if (rpcErr) console.error('[DRAIN] settlement_record_confirmed RPC failed:', rpcErr.message)
}

async function markFailed(intent: ClaimedIntent, errorMessage: string, taskId: string): Promise<void> {
  const evt = {
    taskId,
    paymentIntentId: intent.id,
    fromAgentId: intent.from_agent_id,
    toAgentId: intent.to_agent_id,
    amount: intent.amount,
    error: errorMessage,
    retryCount: intent.retry_count + 1,
    timestamp: Date.now()
  }
  pipelineEvents.emit('payment:failed', evt)
  void logTaskEvent(taskId, 'payment:failed', evt).catch(() => {})

  if (!supabaseAdmin) return
  const { error: updErr } = await supabaseAdmin
    .from('payment_intents')
    .update({ status: 'failed', error_message: errorMessage, retry_count: intent.retry_count + 1 })
    .eq('id', intent.id)
  if (updErr) console.error('[DRAIN] payment_intents failed update failed:', updErr.message)

  const { error: rpcErr } = await supabaseAdmin.rpc('settlement_record_failed', {
    p_task_id: taskId
  })
  if (rpcErr) console.error('[DRAIN] settlement_record_failed RPC failed:', rpcErr.message)
}

async function countPending(taskId: string): Promise<number> {
  if (!supabaseAdmin) return 0
  const { data, error } = await supabaseAdmin.rpc('count_pending_intents', { p_task_id: taskId })
  if (error) {
    console.error('[DRAIN] count_pending_intents failed:', error.message)
    return 0
  }
  return (data as number) ?? 0
}

/**
 * Resolve the base URL for self-dispatching the next drain. On Vercel
 * VERCEL_URL is auto-injected at runtime; locally we fall back to the
 * dev port. The protocol on Vercel is always https.
 */
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  return `http://localhost:${process.env.PORT ?? 3001}`
}

/**
 * Trigger the first drain for a task. Used by `settleAllIntentsOnArc`
 * after writing the settlements row, and by `submitForSettlement` in
 * x402.ts after a single intent is signed.
 *
 * Fires-and-forgets — the drain endpoint will self-recurse if work
 * remains. We deliberately do NOT await the response; the caller
 * (pipeline) needs to keep moving so the task can complete and the
 * UI can advance.
 */
export function triggerDrain(taskId: string): void {
  const url = `${getBaseUrl()}/api/settlement/drain`
  // Attach the shared secret if configured. The drain endpoint enforces
  // it in prod (any caller without the bearer is rejected 401), so the
  // self-recursion would break without this. Dev runs without the secret
  // — the endpoint is permissive when the env var is unset.
  const secret = process.env.SETTLEMENT_DRAIN_SECRET
  // Fire-and-forget. .catch swallows transport errors; the drain
  // endpoint will be re-invoked from any subsequent caller (other
  // x402 handshakes, follow-up settleAllIntentsOnArc, or the UI's
  // own SettlementProof Realtime sub triggering a manual drain).
  void fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { Authorization: `Bearer ${secret}` } : {})
    },
    body: JSON.stringify({ taskId })
  }).catch(() => { /* drained on next trigger */ })
}
