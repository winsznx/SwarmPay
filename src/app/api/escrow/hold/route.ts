import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

interface HoldBody {
  userId?: string
  taskId?: string
  amount?: number
}

export async function POST(req: Request) {
  let body: HoldBody = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const userId = body.userId ?? 'user_1'
  const amount = Number(body.amount)
  const taskId = body.taskId ?? null

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'persistence not configured' }, { status: 503 })
  }

  const { data, error } = await supabaseAdmin.rpc('escrow_hold', {
    p_user_id: userId,
    p_task_id: taskId,
    p_amount: amount
  })

  if (error) {
    const status = /insufficient/i.test(error.message) ? 402 : 400
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json({ escrowId: data, userId, amount, taskId })
}
