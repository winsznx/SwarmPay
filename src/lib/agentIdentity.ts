import { getCircleClient, getAgentWallets } from './circleWallets'
import { supabaseAdmin } from './supabase'

export interface AgentIdentity {
  agentId: string
  walletId: string
  address: string
  balanceUsdc: number
  arcExplorerUrl: string
}

const ARC_EXPLORER = 'https://testnet.arcscan.app'

const addressCache = new Map<string, string>()

/**
 * Fetch and cache the on-chain EVM address for a single agent wallet.
 * Results are cached in-process to reduce Circle API round trips.
 * Also persists to Supabase agents.wallet_address so the address
 * survives serverless cold starts.
 */
export async function resolveAgentAddress(agentId: string): Promise<string | null> {
  if (addressCache.has(agentId)) return addressCache.get(agentId)!

  const circle = getCircleClient()
  if (!circle) return null
  const walletId = getAgentWallets()[agentId]
  if (!walletId) return null

  try {
    const res = await (circle as any).getWallet({ id: walletId })
    const address: string | undefined = res.data?.wallet?.address
    if (!address) return null

    addressCache.set(agentId, address)

    if (supabaseAdmin) {
      await supabaseAdmin
        .from('agents')
        .update({ wallet_address: address })
        .eq('id', agentId)
    }

    return address
  } catch (e) {
    console.error(`[IDENTITY] Failed to resolve address for ${agentId}:`, e)
    return null
  }
}

/**
 * Fetch USDC balance for one agent from Circle and persist it.
 */
export async function resolveAgentBalance(agentId: string): Promise<number> {
  const circle = getCircleClient()
  if (!circle) return 0
  const walletId = getAgentWallets()[agentId]
  if (!walletId) return 0

  try {
    const res = await (circle as any).getWalletTokenBalance({ id: walletId })
    const usdcEntry = (res.data?.tokenBalances ?? []).find(
      (b: any) =>
        b.token?.id === process.env.USDC_TOKEN_ID ||
        b.token?.symbol?.toUpperCase() === 'USDC'
    )
    const balance = usdcEntry ? parseFloat(usdcEntry.amount) : 0

    if (supabaseAdmin) {
      await supabaseAdmin
        .from('agents')
        .update({
          last_balance_usdc: balance,
          last_balance_synced_at: new Date().toISOString()
        })
        .eq('id', agentId)
    }

    return balance
  } catch (e) {
    console.error(`[IDENTITY] Failed to resolve balance for ${agentId}:`, e)
    return 0
  }
}

/**
 * Resolve the full on-chain identity for every configured agent.
 * Called once at pipeline boot and from the /api/agents endpoint.
 * Runs address + balance fetches in parallel per agent.
 */
export async function resolveAllAgentIdentities(): Promise<AgentIdentity[]> {
  const agentIds = Object.keys(getAgentWallets())

  const results = await Promise.all(
    agentIds.map(async (agentId): Promise<AgentIdentity | null> => {
      const walletId = getAgentWallets()[agentId]
      if (!walletId) return null

      const [address, balanceUsdc] = await Promise.all([
        resolveAgentAddress(agentId),
        resolveAgentBalance(agentId)
      ])

      if (!address) return null

      return {
        agentId,
        walletId,
        address,
        balanceUsdc,
        arcExplorerUrl: `${ARC_EXPLORER}/address/${address}`
      }
    })
  )

  return results.filter((r): r is AgentIdentity => r !== null)
}

/**
 * Returns a settled transaction count for an agent from payment_intents.
 * Uses Supabase — no RPC needed, just a count query.
 */
export async function getAgentSettledTxCount(agentId: string): Promise<number> {
  if (!supabaseAdmin) return 0
  const { count } = await supabaseAdmin
    .from('payment_intents')
    .select('id', { count: 'exact', head: true })
    .or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
    .eq('status', 'settled')

  return count ?? 0
}
