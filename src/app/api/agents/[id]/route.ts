import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAgentAddress, resolveAgentBalance, getAgentSettledTxCount } from '@/lib/agentIdentity';
import { getAgentWallets } from '@/lib/circleWallets';

const ARC_EXPLORER = 'https://testnet.arcscan.app';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!getAgentWallets()[id]) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const [address, balanceUsdc, settledTxCount] = await Promise.all([
    resolveAgentAddress(id),
    resolveAgentBalance(id),
    getAgentSettledTxCount(id)
  ])

  let dbAgent: any = null
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()
    dbAgent = data
  }

  let recentTxs: any[] = []
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('payment_intents')
      .select('id, from_agent_id, to_agent_id, amount, status, created_at, nonce, signer_address')
      .or(`from_agent_id.eq.${id},to_agent_id.eq.${id}`)
      .eq('status', 'settled')
      .order('created_at', { ascending: false })
      .limit(10)
    recentTxs = data ?? []
  }

  return NextResponse.json({
    id,
    name: dbAgent?.name ?? id,
    role: dbAgent?.role ?? null,
    walletId: getAgentWallets()[id],
    walletAddress: address,
    balanceUsdc,
    reputation: dbAgent?.reputation ?? null,
    tasksCompleted: dbAgent?.tasks_completed ?? 0,
    settledTxCount,
    arcExplorerUrl: address ? `${ARC_EXPLORER}/address/${address}` : null,
    isOnChain: !!address,
    recentSettlements: recentTxs.map(tx => ({
      intentId: tx.id,
      direction: tx.from_agent_id === id ? 'sent' : 'received',
      counterparty: tx.from_agent_id === id ? tx.to_agent_id : tx.from_agent_id,
      amount: parseFloat(tx.amount),
      settledAt: tx.created_at,
      nonce: tx.nonce,
      signerAddress: tx.signer_address,
    }))
  })
}
