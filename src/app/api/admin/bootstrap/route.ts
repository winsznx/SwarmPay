/**
 * POST /api/admin/bootstrap
 *
 * One-time endpoint to register all SwarmPay agents in the ERC-8004 Identity
 * Registry on Arc testnet and bind their Circle wallet addresses.
 *
 * Auth: Bearer token must match ADMIN_SECRET env var. The endpoint is a no-op
 * when PLATFORM_PRIVATE_KEY is absent.
 *
 * Idempotent — agents already registered (tokenId in Supabase or env) are
 * skipped. Safe to call multiple times; only unregistered agents are touched.
 *
 * Steps per agent:
 *   1. Call register(agentURI) on Arc testnet → tokenId (ERC-721 mint)
 *   2. Resolve Circle wallet address via Circle API
 *   3. Call bindAgentWallet() — Circle signs AgentWalletSet typed data,
 *      platform EOA submits setAgentWallet() on Arc testnet
 *
 * After success, any judge can verify:
 *   cast call 0x8004A818BFB912233c491871b3d84c89A494BD9e \
 *     "getAgentWallet(uint256)(address)" <tokenId> \
 *     --rpc-url https://rpc.testnet.arc.network
 */

import { NextRequest, NextResponse } from 'next/server'
import { bootstrapAgentIdentities } from '@/lib/erc8004'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// Registration + binding involves multiple Arc testnet transactions (6 agents × 2 txns)
// Each tx can take 15-30s. Set a generous timeout for the serverless function.
export const maxDuration = 300

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET not configured — bootstrap endpoint disabled' },
      { status: 503 }
    )
  }

  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token || token !== secret) return unauthorized()

  if (!process.env.PLATFORM_PRIVATE_KEY) {
    return NextResponse.json(
      {
        ok: false,
        skipped: true,
        reason: 'ERC-8004 integration not configured',
        missing: ['PLATFORM_PRIVATE_KEY'],
      },
      { status: 200 }
    )
  }

  try {
    await bootstrapAgentIdentities()
    return NextResponse.json({ ok: true, message: 'Bootstrap complete — check server logs for per-agent results' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[/api/admin/bootstrap] Fatal error:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
