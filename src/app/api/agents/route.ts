import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAllAgentIdentities, getAgentSettledTxCount } from '@/lib/agentIdentity';
import { getAgentWallets } from '@/lib/circleWallets';
import { getAgentTokenId } from '@/lib/erc8004';
import { getVaultAddress, getVaultBalance, weiToUsdc } from '@/lib/settlementVault';

const ARC_EXPLORER = 'https://testnet.arcscan.app';
const ERC8004_IDENTITY = process.env.ERC8004_IDENTITY_REGISTRY ?? '0x8004A818BFB912233c491871b3d84c89A494BD9e';

export async function GET() {
  const [memAgents, identities] = await Promise.all([
    store.getAgents(),
    resolveAllAgentIdentities()
  ]);

  const identityMap = new Map(identities.map(i => [i.agentId, i]));
  const vaultAddr = getVaultAddress();

  const enrichedAgents = await Promise.all(
    memAgents.map(async (agent: { id: string; name: string; role: string; capabilities: string[]; reputation: number; totalEarned?: number; earned?: number; tasksCompleted?: number }) => {
      const identity = identityMap.get(agent.id);
      const [txCount, tokenIdRaw, vaultBalWei] = await Promise.all([
        getAgentSettledTxCount(agent.id),
        getAgentTokenId(agent.id),
        identity?.address && vaultAddr ? getVaultBalance(identity.address) : Promise.resolve(BigInt(0)),
      ]);
      const erc8004TokenId = tokenIdRaw != null ? tokenIdRaw.toString() : null;

      let dbReputation: number | null = null;
      let totalEarnedUsdc = 0;
      let lifetimePaymentsReceived = 0;
      if (supabaseAdmin) {
        const { data: agentRow } = await supabaseAdmin
          .from('agents')
          .select('reputation')
          .eq('id', agent.id)
          .single();
        if (agentRow) dbReputation = agentRow.reputation as number;

        // Real earned: sum of received settled payment_intent amounts.
        const { data: rcv } = await supabaseAdmin
          .from('payment_intents')
          .select('amount')
          .eq('to_agent_id', agent.id)
          .eq('status', 'settled');
        if (rcv) {
          lifetimePaymentsReceived = rcv.length;
          totalEarnedUsdc = rcv.reduce((s, r) => s + parseFloat(r.amount as string), 0);
        }
      }

      return {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        capabilities: agent.capabilities,
        reputation: dbReputation ?? agent.reputation,
        // legacy field kept for back-compat — same value as totalEarnedUsdc now (real, not in-memory)
        totalEarned: totalEarnedUsdc,
        totalEarnedUsdc,
        lifetimePaymentsReceived,
        tasksCompleted: agent.tasksCompleted ?? 0,
        walletId: getAgentWallets()[agent.id] ?? null,
        walletAddress: identity?.address ?? null,
        walletBalanceUsdc: identity?.balanceUsdc ?? null,
        vaultBalanceUsdc: weiToUsdc(vaultBalWei),
        settledTxCount: txCount,
        erc8004TokenId,
        erc8004TokenExplorerUrl: erc8004TokenId
          ? `${ARC_EXPLORER}/token/${ERC8004_IDENTITY}/instance/${erc8004TokenId}`
          : null,
        arcExplorerUrl: identity ? `${ARC_EXPLORER}/address/${identity.address}` : null,
        isOnChain: !!identity?.address,
      };
    })
  );

  return NextResponse.json(enrichedAgents);
}
