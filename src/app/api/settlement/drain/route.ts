import { NextResponse } from 'next/server'
import { drainOnce, triggerDrain } from '@/lib/settlementDrain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Hobby caps unconfigured functions at 10s. The drain processes
// a small batch (~8 intents) and returns; the response is the trigger
// for the next invocation. Keep this small — bigger batches risk hitting
// timeout under Circle 429 backoff.
//
// On Pro: bump CIRCLE_PER_WALLET_DELAY_MS down and DRAIN_BATCH_SIZE up
// for faster drain throughput.
export const maxDuration = 30

interface DrainBody {
  taskId?: string
}

export async function POST(req: Request) {
  // Shared-secret auth. If SETTLEMENT_DRAIN_SECRET is set in env (prod),
  // every drain caller must present the bearer token. The internal
  // triggerDrain() in src/lib/settlementDrain.ts attaches it automatically.
  // If the secret is unset (dev/mock mode), the endpoint is open — same
  // permissive-default pattern as supabaseAdmin's anon-key fallback.
  const secret = process.env.SETTLEMENT_DRAIN_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
  }

  let body: DrainBody = {}
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }

  const { taskId } = body
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  // Process one bounded batch.
  const result = await drainOnce(taskId)

  // If work remains, dispatch the next drain. Fire-and-forget — we
  // don't block the response on the kicked invocation. The dispatch
  // happens *before* `return` so the outbound HTTP request is in flight
  // by the time this function instance is torn down.
  //
  // Recursion stop conditions (audited in PR description):
  //   1. Every claimed intent becomes 'settled' → not in 'pending' → remaining=0
  //   2. Every claimed intent becomes 'failed' (retry_count >= 4) → not in 'pending' → remaining=0
  //   3. count_pending_intents RPC fails → drainOnce returns remaining=0 → stops
  //   4. Vercel function timeout kills mid-flight drain → no further trigger fires
  // No path produces remaining > 0 indefinitely.
  if (result.remaining > 0) {
    triggerDrain(taskId)
  }

  return NextResponse.json(result)
}
