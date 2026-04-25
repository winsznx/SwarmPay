import { sendAgentPayment } from './circleWallets'
import { supabaseAdmin, logTaskEvent } from './supabase'
import { measureIntentGasCost } from './gasMeasurement'
import { pipelineEvents } from './events'

/**
 * Production settlement queue.
 *
 * Per-wallet serial queue with exponential backoff on 429s. Replaces the
 * old `Promise.race(25s)` cap that truncated allHashes to whatever
 * confirmed first.
 *
 * Architecture:
 *  - One queue per source wallet (max 6, one per agent).
 *  - Each queue processes intents serially: max 1 in-flight Circle call
 *    per source wallet.
 *  - CIRCLE_PER_WALLET_DELAY_MS (default 250ms) inter-call delay.
 *  - On 429: exp backoff 1s/2s/4s, max 3 retries, then mark failed.
 *  - On other errors: 1 retry, then failed.
 *  - Each successful confirmation hits `settlement_record_confirmed` RPC
 *    (atomic increment + array_append + status promotion).
 *  - Each failure hits `settlement_record_failed` RPC + writes
 *    payment_intents.error_message + retry_count.
 *  - After confirmation, schedules a gas measurement (non-blocking).
 *
 * The pipeline returns immediately after enqueuing; the queue drains
 * in the background. UI subscribes via Supabase Realtime and watches
 * `settlements.confirmed_count` / `all_hashes` grow.
 */

const PER_WALLET_DELAY_MS = parseInt(process.env.CIRCLE_PER_WALLET_DELAY_MS ?? '250', 10)
const MAX_RETRIES_429 = 3
const MAX_RETRIES_OTHER = 1

export interface QueuedIntent {
  paymentIntentId: string
  taskId: string
  fromAgentId: string
  toAgentId: string
  amount: number
}

interface PerWalletQueue {
  pending: QueuedIntent[]
  draining: boolean
}

const queues = new Map<string, PerWalletQueue>()

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

function getQueue(walletId: string): PerWalletQueue {
  let q = queues.get(walletId)
  if (!q) {
    q = { pending: [], draining: false }
    queues.set(walletId, q)
  }
  return q
}

export function enqueueIntents(intents: QueuedIntent[]): void {
  for (const intent of intents) {
    const q = getQueue(intent.fromAgentId)
    q.pending.push(intent)
    if (!q.draining) {
      q.draining = true
      // Drain async; do not await
      void drain(intent.fromAgentId, q)
    }
  }
}

async function drain(walletId: string, q: PerWalletQueue): Promise<void> {
  while (q.pending.length > 0) {
    const intent = q.pending.shift()!
    await processOne(intent)
    if (q.pending.length > 0) await sleep(PER_WALLET_DELAY_MS)
  }
  q.draining = false
}

async function processOne(intent: QueuedIntent): Promise<void> {
  let attempt = 0
  let lastError: string | null = null

  while (true) {
    try {
      const txHash = await sendAgentPayment(intent.fromAgentId, intent.toAgentId, intent.amount)
      if (txHash) {
        await recordConfirmed(intent, txHash)
        // Schedule gas measurement; do not block confirmation.
        void measureIntentGasCost(intent.paymentIntentId, txHash).catch(() => {})
        return
      }
      // null hash = treated as transient
      lastError = 'sendAgentPayment returned null'
      throw new Error(lastError)
    } catch (e: unknown) {
      attempt++
      const msg = e instanceof Error ? e.message : String(e)
      lastError = msg
      const is429 = /429|rate limit/i.test(msg)
      const cap = is429 ? MAX_RETRIES_429 : MAX_RETRIES_OTHER
      if (attempt > cap) break
      // Exp backoff for 429; shorter for other
      const backoff = is429 ? 1000 * Math.pow(2, attempt - 1) : 500
      await sleep(backoff)
    }
  }

  await recordFailed(intent, lastError ?? 'unknown error', attempt)
}

async function recordConfirmed(intent: QueuedIntent, txHash: string): Promise<void> {
  // x402 settled event for the live PaymentStream + audit
  const evt = {
    taskId: intent.taskId,
    paymentIntentId: intent.paymentIntentId,
    fromAgentId: intent.fromAgentId,
    toAgentId: intent.toAgentId,
    amount: intent.amount,
    txHash,
    explorerUrl: `https://testnet.arcscan.app/tx/${txHash}`,
    timestamp: Date.now()
  }
  pipelineEvents.emit('payment:settled', evt)
  void logTaskEvent(intent.taskId, 'payment:settled', evt).catch(() => {})

  if (!supabaseAdmin) return
  const { error: updErr } = await supabaseAdmin
    .from('payment_intents')
    .update({ status: 'settled' })
    .eq('id', intent.paymentIntentId)
  if (updErr) console.error('[QUEUE] payment_intents settled update failed:', updErr.message)

  const { error: rpcErr } = await supabaseAdmin.rpc('settlement_record_confirmed', {
    p_task_id: intent.taskId,
    p_tx_hash: txHash
  })
  if (rpcErr) console.error('[QUEUE] settlement_record_confirmed RPC failed:', rpcErr.message)
}

async function recordFailed(intent: QueuedIntent, errorMessage: string, retryCount: number): Promise<void> {
  const evt = {
    taskId: intent.taskId,
    paymentIntentId: intent.paymentIntentId,
    fromAgentId: intent.fromAgentId,
    toAgentId: intent.toAgentId,
    amount: intent.amount,
    error: errorMessage,
    retryCount,
    timestamp: Date.now()
  }
  pipelineEvents.emit('payment:failed', evt)
  void logTaskEvent(intent.taskId, 'payment:failed', evt).catch(() => {})

  if (!supabaseAdmin) return
  const { error: updErr } = await supabaseAdmin
    .from('payment_intents')
    .update({ status: 'failed', error_message: errorMessage, retry_count: retryCount })
    .eq('id', intent.paymentIntentId)
  if (updErr) console.error('[QUEUE] payment_intents failed update failed:', updErr.message)

  const { error: rpcErr } = await supabaseAdmin.rpc('settlement_record_failed', {
    p_task_id: intent.taskId
  })
  if (rpcErr) console.error('[QUEUE] settlement_record_failed RPC failed:', rpcErr.message)
}

/**
 * Initialize the settlements row for this task and start the queue.
 * Returns immediately. Pipeline does not block on completion.
 */
export async function startSettlement(
  taskId: string,
  intents: QueuedIntent[]
): Promise<{ expected: number }> {
  if (supabaseAdmin) {
    const { error } = await supabaseAdmin
      .from('settlements')
      .upsert({
        task_id: taskId,
        expected_count: intents.length,
        confirmed_count: 0,
        failed_count: 0,
        all_hashes: [],
        status: intents.length > 0 ? 'in_progress' : 'complete',
        started_at: new Date().toISOString(),
        intents_settled: intents.length,
        // total_amount is reported by the caller via saveSettlementToSupabase if needed
      }, { onConflict: 'task_id' })
    if (error) console.error('[QUEUE] settlements row upsert failed:', error.message)
  }
  enqueueIntents(intents)
  return { expected: intents.length }
}
