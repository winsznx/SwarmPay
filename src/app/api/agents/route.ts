import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAllAgentIdentities, getAgentSettledTxCount } from '@/lib/agentIdentity';
import { getAgentWallets } from '@/lib/circleWallets';

const ARC_EXPLORER = 'https://testnet.arcscan.app';

export async function GET() {
  const [memAgents, identities] = await Promise.all([
    store.getAgents(),
    resolveAllAgentIdentities()
  ])

  const identityMap = new Map(identities.map(i => [i.agentId, i]))

  const enrichedAgents = await Promise.all(
    memAgents.map(async (agent: any) => {
      const identity = identityMap.get(agent.id)
      const txCount = await getAgentSettledTxCount(agent.id)

      let dbReputation: number | null = null
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('agents')
          .select('reputation, tasks_completed, wallet_address, last_balance_usdc, last_balance_synced_at')
          .eq('id', agent.id)
          .single()
        if (data) {
          dbReputation = data.reputation
        }
      }

      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        capabilities: agent.capabilities,
        reputation: dbReputation ?? agent.reputation,
        totalEarned: agent.totalEarned ?? agent.earned ?? 0,
        tasksCompleted: agent.tasksCompleted ?? 0,
        walletId: getAgentWallets()[agent.id] ?? null,
        walletAddress: identity?.address ?? null,
        balanceUsdc: identity?.balanceUsdc ?? null,
        settledTxCount: txCount,
        arcExplorerUrl: identity ? `${ARC_EXPLORER}/address/${identity.address}` : null,
        isOnChain: !!identity?.address,
      }
    })
  )

  return NextResponse.json(enrichedAgents)
}
