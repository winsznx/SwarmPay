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


export async function batchSettleOnArc(
  taskId: string,
  intents: Array<{ fromAgentId: string; toAgentId: string; amount: number }>
): Promise<{ txHash: string; explorerUrl: string } | null> {
  const circle = getCircleClient()
  if (!circle) return null

  // Send the largest single payment as the "settlement" transaction
  // This gives us a real verifiable tx hash for the demo
  const largest = intents.reduce((max, i) => i.amount > max.amount ? i : max, intents[0])

  const txHash = await sendAgentPayment(
    largest.fromAgentId,
    largest.toAgentId,
    intents.reduce((sum, i) => sum + i.amount, 0)
  )
  if (!txHash) return null
  
  const explorerUrl = txHash.startsWith('0x')
    ? `https://testnet.arcscan.app/tx/${txHash}`
    : `https://app.circle.com/transactions/${txHash}`

  return {
    txHash,
    explorerUrl
  }
}


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
