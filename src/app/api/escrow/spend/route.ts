import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface SpendBody {
  escrowId?: string
  amount?: number
}

export async function POST(req: Request) {
  let body: SpendBody = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { escrowId } = body
  const amount = Number(body.amount)

  if (!escrowId) return NextResponse.json({ error: 'escrowId required' }, { status: 400 })
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  if (!supabaseAdmin) return NextResponse.json({ error: 'persistence not configured' }, { status: 503 })

  const { data, error } = await supabaseAdmin.rpc('escrow_spend', {
    p_hold_id: escrowId,
    p_amount: amount
  })

  if (error) {
    const status = /exceeds hold/i.test(error.message) ? 409 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ escrowId, totalSpent: data })
}
