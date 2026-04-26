import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveAgentAddress, resolveAgentBalance, getAgentSettledTxCount } from '@/lib/agentIdentity';
import { getAgentWallets } from '@/lib/circleWallets';
import { getAgentTokenId } from '@/lib/erc8004';
import { getVaultBalance, getVaultAddress, weiToUsdc } from '@/lib/settlementVault';

const ARC_EXPLORER = 'https://testnet.arcscan.app';
const ERC8004_IDENTITY = process.env.ERC8004_IDENTITY_REGISTRY ?? '0x8004A818BFB912233c491871b3d84c89A494BD9e';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!getAgentWallets()[id]) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const [address, balanceUsdc, settledTxCount, tokenIdRaw] = await Promise.all([
    resolveAgentAddress(id),
    resolveAgentBalance(id),
    getAgentSettledTxCount(id),
    getAgentTokenId(id),
  ]);

  const erc8004TokenId = tokenIdRaw != null ? tokenIdRaw.toString() : null;
  const vaultAddr = getVaultAddress();
  const vaultBalanceUsdc = address && vaultAddr ? weiToUsdc(await getVaultBalance(address)) : 0;

  let dbAgent: { name?: string; role?: string; reputation?: number; tasks_completed?: number } | null = null;
  let totalEarnedUsdc = 0;
  let totalSpentUsdc = 0;
  let lifetimePaymentsReceived = 0;
  let lifetimePaymentsSent = 0;

  if (supabaseAdmin) {
    const { data: agentRow } = await supabaseAdmin
      .from('agents')
      .select('name, role, reputation, tasks_completed')
      .eq('id', id)
      .single();
    dbAgent = agentRow ?? null;

    const { data: rcvAgg } = await supabaseAdmin
      .from('payment_intents')
      .select('amount')
      .eq('to_agent_id', id)
      .eq('status', 'settled');
    if (rcvAgg) {
      lifetimePaymentsReceived = rcvAgg.length;
      totalEarnedUsdc = rcvAgg.reduce((s, r) => s + parseFloat(r.amount as string), 0);
    }

    const { data: sentAgg } = await supabaseAdmin
      .from('payment_intents')
      .select('amount')
      .eq('from_agent_id', id)
      .eq('status', 'settled');
    if (sentAgg) {
      lifetimePaymentsSent = sentAgg.length;
      totalSpentUsdc = sentAgg.reduce((s, r) => s + parseFloat(r.amount as string), 0);
    }
  }

  let recentTxs: Array<{
    id: string; from_agent_id: string; to_agent_id: string; amount: string;
    created_at: string; tx_hash: string | null; nonce: string | null;
    signer_address: string | null; block_number: number | null;
  }> = [];
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('payment_intents')
      .select('id, from_agent_id, to_agent_id, amount, created_at, tx_hash, nonce, signer_address, block_number')
      .or(`from_agent_id.eq.${id},to_agent_id.eq.${id}`)
      .eq('status', 'settled')
      .order('created_at', { ascending: false })
      .limit(15);
    recentTxs = (data ?? []) as typeof recentTxs;
  }

  return NextResponse.json({
    id,
    name: dbAgent?.name ?? id,
    role: dbAgent?.role ?? null,
    walletId: getAgentWallets()[id],
    walletAddress: address,
    walletBalanceUsdc: balanceUsdc,
    vaultBalanceUsdc,
    vaultContract: vaultAddr,
    reputation: dbAgent?.reputation ?? null,
    tasksCompleted: dbAgent?.tasks_completed ?? 0,
    settledTxCount,
    erc8004: {
      tokenId: erc8004TokenId,
      registryContract: ERC8004_IDENTITY,
      tokenExplorerUrl: erc8004TokenId
        ? `${ARC_EXPLORER}/token/${ERC8004_IDENTITY}/instance/${erc8004TokenId}`
        : null,
      verifyCommand: erc8004TokenId
        ? `cast call ${ERC8004_IDENTITY} "getAgentWallet(uint256)(address)" ${erc8004TokenId} --rpc-url https://rpc.testnet.arc.network`
        : null,
    },
    arcExplorerUrl: address ? `${ARC_EXPLORER}/address/${address}` : null,
    isOnChain: !!address,
    economics: {
      totalEarnedUsdc,
      totalSpentUsdc,
      netUsdc: totalEarnedUsdc - totalSpentUsdc,
      lifetimePaymentsReceived,
      lifetimePaymentsSent,
    },
    recentSettlements: recentTxs.map(tx => ({
      intentId: tx.id,
      direction: tx.from_agent_id === id ? 'sent' : 'received',
      counterparty: tx.from_agent_id === id ? tx.to_agent_id : tx.from_agent_id,
      amount: parseFloat(tx.amount),
      settledAt: tx.created_at,
      txHash: tx.tx_hash,
      blockNumber: tx.block_number,
      txExplorerUrl: tx.tx_hash ? `${ARC_EXPLORER}/tx/${tx.tx_hash}` : null,
      nonce: tx.nonce,
      signerAddress: tx.signer_address,
    })),
  });
}

void ethers; // keep import alive in case future revisions touch ethers utils
