import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

let client: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null

export function getCircleClient() {
  if (!client) {
    const apiKey = process.env.CIRCLE_API_KEY
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET
    if (!apiKey || !entitySecret) {
      console.warn('[CIRCLE] Missing credentials — using mock mode')
      return null
    }
    client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
  }
  return client
}

// Map agent IDs to their Circle wallet IDs
export function getAgentWallets(): Record<string, string> {
  return {
    'crypto-scout-x':  process.env.WALLET_ID_CRYPTO_SCOUT_X  ?? '',
    'research-alpha':  process.env.WALLET_ID_RESEARCH_ALPHA  ?? '',
    'data-miner-pro':  process.env.WALLET_ID_DATA_MINER_PRO  ?? '',
    'parser-x':        process.env.WALLET_ID_PARSER_X        ?? '',
    'analysis-node':   process.env.WALLET_ID_ANALYSIS_NODE   ?? '',
    'compute-grid-4':  process.env.WALLET_ID_COMPUTE_GRID_4  ?? '',
  }
}

export async function getAgentAddress(agentId: string): Promise<string> {
  const circle = getCircleClient()
  if (!circle) return ''
  const walletId = getAgentWallets()[agentId]
  if (!walletId) return ''
  try {
    const res = await (circle as any).getWallet({ id: walletId })
    return res.data?.wallet?.address ?? ''
  } catch (e) {
    console.error(`[CIRCLE] Failed to get address for wallet ${walletId}:`, e)
    return ''
  }
}

export async function sendAgentPayment(
  fromAgentId: string,
  toAgentId: string,
  amount: number
): Promise<string | null> {
  const circle = getCircleClient()
  if (!circle) return null

  const fromWalletId = getAgentWallets()[fromAgentId]
  const destinationAddress = await getAgentAddress(toAgentId)

  if (!fromWalletId || !destinationAddress) {
    console.warn('[CIRCLE] Wallet ID or address missing for', fromAgentId, 'or', toAgentId)
    return null
  }

  try {
    const res = await circle.createTransaction({
      walletId: fromWalletId,
      destinationAddress,
      amount: [amount.toFixed(6)],
      blockchain: 'ARC-TESTNET' as any,
      tokenId: process.env.USDC_TOKEN_ID ?? '',
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } }
    })

    const transactionId = (res.data as any)?.id // Circle internal ID
    if (!transactionId) return null
    
    console.log('[CIRCLE] Transaction initiated, ID:', transactionId)

    // Poll for actual blockchain tx hash (increased to 60 seconds)
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const status = await (circle as any).getTransaction({ id: transactionId })
        const txHash = status.data?.transaction?.txHash
        const state = status.data?.transaction?.state
        
        console.log(`[CIRCLE] Polling ${i+1}/30... State: ${state}, Hash: ${txHash || 'pending'}`)
        
        if (txHash && txHash.toLowerCase().startsWith('0x')) {
          console.log('[CIRCLE] Real Arc tx hash verified:', txHash)
          return txHash
        }
        
        if (state === 'FAILED' || state === 'CANCELLED') {
          console.error('[CIRCLE] Transaction failed on-chain:', status.data?.transaction?.errorReason)
          return null
        }

        if (state === 'COMPLETE' && !txHash) {
          console.warn('[CIRCLE] Transaction marked COMPLETE but no txHash found yet. Retrying...')
        }
    }

    console.warn('[CIRCLE] Timed out waiting for txHash, returning internal ID:', transactionId)
    return transactionId // Fallback to internal ID if hash not ready

  } catch (e) {
    console.error('[CIRCLE] Payment process failed:', e)
    return null
  }
}


/**
 * Arm the settlement for a task and trigger the first drain pass.
 *
 * Architecture: queue state lives in `payment_intents.status` (DB).
 * Intents are already inserted by the pipeline before this is called
 * (status='pending'). We just need to:
 *   1. Create / update the `settlements` progress row.
 *   2. Trigger the first /api/settlement/drain invocation.
 *
 * The drain endpoint (src/app/api/settlement/drain/route.ts) processes
 * a bounded batch via the `claim_pending_intents` RPC and self-recurses
 * via fire-and-forget HTTP if more remain. This survives Vercel
 * serverless function teardown — every drain invocation is a fresh
 * function with the queue state durable in Postgres.
 *
 * Returns the planned intent count; actual hashes land asynchronously
 * into `settlements.all_hashes` via the drain's RPC calls. The UI
 * subscribes to the settlements row via Supabase Realtime.
 */
export async function settleAllIntentsOnArc(
  taskId: string,
  intents: Array<{ paymentIntentId: string; fromAgentId: string; toAgentId: string; amount: number }>
): Promise<{ enqueued: number } | null> {
  const circle = getCircleClient()
  if (!circle) {
    console.warn('[ARC] Circle unavailable; settlement skipped (mock mode)')
    return null
  }

  // Upsert the settlements progress row so the UI sub sees expected_count immediately.
  const { supabaseAdmin } = await import('./supabase')
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
        intents_settled: intents.length
      }, { onConflict: 'task_id' })
    if (error) console.error('[ARC] settlements row upsert failed:', error.message)
  }

  // Kick the first drain. The endpoint will self-recurse until DB count = 0.
  const { triggerDrain } = await import('./settlementDrain')
  triggerDrain(taskId)
  console.log(`[ARC] settlement armed for ${intents.length} intents on task ${taskId}; drain dispatched`)
  return { enqueued: intents.length }
}

/** @deprecated kept for build compatibility — use settleAllIntentsOnArc */
export const batchSettleOnArc = settleAllIntentsOnArc


export async function getAgentBalances(): Promise<Record<string, number>> {
  const wallets = getAgentWallets()
  console.log('[CIRCLE] Current AGENT_WALLETS config:', wallets)
  const circle = getCircleClient()
  if (!circle) return {}

  const balances: Record<string, number> = {}
  
  try {
    for (const [agentId, walletId] of Object.entries(wallets)) {
      if (!walletId) continue
      
      const res = await (circle as any).getWalletTokenBalance({ id: walletId })
      const usdcBalance = res.data?.tokenBalances?.find((b: any) => 
        b.token?.id === process.env.USDC_TOKEN_ID || 
        b.token?.symbol?.toUpperCase() === 'USDC'
      )
      
      if (usdcBalance) {
        balances[agentId] = parseFloat(usdcBalance.amount)
        console.log(`[CIRCLE] Agent ${agentId} balance: ${balances[agentId]} USDC`)
      } else {
        console.warn(`[CIRCLE] No USDC found for ${agentId}. Raw tokens:`, 
          res.data?.tokenBalances?.map((b: any) => b.token?.symbol).join(', ') || 'none'
        )
      }
    }
    console.log('[CIRCLE] Balance sync summary:', balances)
  } catch (e) {
    console.error('[CIRCLE] Failed to fetch agent balances:', e)
  }

  
  return balances
}
