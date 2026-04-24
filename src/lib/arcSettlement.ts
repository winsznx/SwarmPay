import { batchSettleOnArc } from './circleWallets'

export interface SettlementResult {
  txHash: string
  explorerUrl: string
  intentsSettled: number
  totalAmount: number
  gasCost: number
}

export async function settleOnArc(
  taskId: string,
  paymentIntents: Array<{ from: string; to: string; amount: number }>
): Promise<SettlementResult | null> {
  // Try real Circle settlement first
  const realSettlement = await batchSettleOnArc(
    taskId,
    paymentIntents.map(p => ({
      fromAgentId: p.from,
      toAgentId: p.to,
      amount: p.amount
    }))
  )

  if (realSettlement) {
    console.log('[ARC] Real settlement complete:', realSettlement.txHash)
    return {
      txHash: realSettlement.txHash,
      explorerUrl: realSettlement.explorerUrl,
      intentsSettled: paymentIntents.length,
      totalAmount: paymentIntents.reduce((sum, p) => sum + p.amount, 0),
      gasCost: 0.0006
    }
  }

  // Fall back to mock if Circle not configured
  console.log('[ARC] Using mock settlement (Circle not configured)')
  return mockSettlement(taskId, paymentIntents)
}

function mockSettlement(
  taskId: string,
  paymentIntents: Array<{ from: string; to: string; amount: number }>
): SettlementResult {
  const mockHash = '0x' + taskId.replace(/-/g, '').slice(0, 40) + 'arc1'
  console.log('[ARC] Mock settlement — hash:', mockHash)
  return {
    txHash: mockHash,
    explorerUrl: `https://testnet.arcscan.app/tx/${mockHash}`,
    intentsSettled: paymentIntents.length,
    totalAmount: paymentIntents.reduce((sum, p) => sum + p.amount, 0),
    gasCost: 0.0006
  }
}
