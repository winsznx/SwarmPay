import { settleAllIntentsOnArc } from './circleWallets'

export interface SettlementHandle {
  enqueued: number
  skipped: number
  txHash?: string
  blockNumber?: number
  gasUsedUsdc?: number
  totalAmountUsdc?: number
  explorerUrl?: string
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
    if (real.txHash) {
      console.log(`[ARC] batch settled ${real.enqueued} intents in tx ${real.txHash}`)
    } else {
      console.log(`[ARC] batch returned no tx hash for task ${taskId} (enqueued=${real.enqueued} skipped=${real.skipped})`)
    }
    return {
      enqueued: real.enqueued,
      skipped: real.skipped,
      txHash: real.txHash,
      blockNumber: real.blockNumber,
      gasUsedUsdc: real.gasUsedUsdc,
      totalAmountUsdc: real.totalAmountUsdc,
      explorerUrl: real.explorerUrl,
    }
  }

  console.log('[ARC] settlement returned null (vault unconfigured or transient failure)')
  return { enqueued: 0, skipped: paymentIntents.length }
}
