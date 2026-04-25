import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getCircleClient } from '@/lib/circleWallets'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SubsystemStatus {
  name: 'supabase' | 'circle' | 'arc_rpc'
  ok: boolean
  detail?: string
  latencyMs?: number
}

async function checkSupabase(): Promise<SubsystemStatus> {
  if (!supabase) return { name: 'supabase', ok: false, detail: 'no client (missing env)' }
  const t0 = Date.now()
  try {
    const { error } = await supabase.from('agents').select('id', { count: 'exact', head: true })
    if (error) return { name: 'supabase', ok: false, detail: error.message, latencyMs: Date.now() - t0 }
    return { name: 'supabase', ok: true, latencyMs: Date.now() - t0 }
  } catch (e) {
    return { name: 'supabase', ok: false, detail: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - t0 }
  }
}

async function checkCircle(): Promise<SubsystemStatus> {
  const client = getCircleClient()
  if (!client) return { name: 'circle', ok: false, detail: 'mock mode (missing env)' }
  // Just confirm we can construct a client. We avoid hitting the Circle API
  // on every health check to stay below their free-tier rate limits.
  return { name: 'circle', ok: true, detail: 'client initialised' }
}

async function checkArcRpc(): Promise<SubsystemStatus> {
  const url = process.env.ARC_RPC_URL
  if (!url) return { name: 'arc_rpc', ok: false, detail: 'ARC_RPC_URL not set' }
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return { name: 'arc_rpc', ok: false, detail: `HTTP ${res.status}`, latencyMs: Date.now() - t0 }
    const json = await res.json() as { result?: string; error?: unknown }
    if (json.error) return { name: 'arc_rpc', ok: false, detail: 'rpc error', latencyMs: Date.now() - t0 }
    return { name: 'arc_rpc', ok: true, detail: `block ${parseInt(json.result ?? '0x0', 16)}`, latencyMs: Date.now() - t0 }
  } catch (e) {
    return { name: 'arc_rpc', ok: false, detail: e instanceof Error ? e.message : String(e), latencyMs: Date.now() - t0 }
  }
}

export async function GET() {
  const [supa, circle, arc] = await Promise.all([checkSupabase(), checkCircle(), checkArcRpc()])
  const subsystems = [supa, circle, arc]
  const allOk = subsystems.every(s => s.ok)
  return NextResponse.json({
    ok: allOk,
    timestamp: new Date().toISOString(),
    subsystems
  }, { status: allOk ? 200 : 503 })
}
