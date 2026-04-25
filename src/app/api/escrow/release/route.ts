import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface ReleaseBody {
  escrowId?: string
}

export async function POST(req: Request) {
  let body: ReleaseBody = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { escrowId } = body
  if (!escrowId) return NextResponse.json({ error: 'escrowId required' }, { status: 400 })

  if (!supabaseAdmin) return NextResponse.json({ error: 'persistence not configured' }, { status: 503 })

  const { data, error } = await supabaseAdmin.rpc('escrow_release', {
    p_hold_id: escrowId
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ escrowId, refunded: data })
}
