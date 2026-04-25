import { settleAllIntentsOnArc } from './circleWallets'

export interface SettlementHandle {
  enqueued: number
  /** UI reads gas/hashes/progress live from Supabase Realtime; this object only describes the start */
}

export async function settleOnArc(
  taskId: string,
  paymentIntents: Array<{ paymentIntentId: string; from: string; to: string; amount: number }>
): Promise<SettlementHandle | null> {
  const real = await settleAllIntentsOnArc(
    taskId,
    paymentIntents.map(p => ({
      paymentIntentId: p.paymentIntentId,
      fromAgentId: p.from,
      toAgentId: p.to,
      amount: p.amount
    }))
  )

  if (real) {
    console.log(`[ARC] queue armed: ${real.enqueued} intents queued for task ${taskId}`)
    return { enqueued: real.enqueued }
  }

  // Mock mode (no Circle keys). Mark the settlement row complete with an empty
  // result so the UI doesn't hang. No fake hashes, no fake gas — observably
  // empty, observably-mock.
  console.log('[ARC] mock mode (no Circle keys) — emitting empty settlement handle')
  return { enqueued: 0 }
}
