import { supabaseAdmin } from './supabase'

/**
 * Real gas measurement against the Arc RPC.
 *
 * Production note on Arc gas semantics:
 *   Arc charges gas in the native token of the chain. For Arc testnet, USDC
 *   acts as the gas token (USDC has 6 decimals on Arc). The cost in USDC of
 *   a transaction is therefore:
 *     gas_cost_usdc = gasUsed × effectiveGasPrice / 10^6
 *   where effectiveGasPrice is denominated in the chain's smallest unit
 *   (1e-6 USDC, i.e. micro-USDC).
 *
 *   If a future chain swaps native gas (e.g. Arc moves to ETH-denominated
 *   gas), the divisor must change. The math is centralized here for that
 *   reason.
 *
 *   Source for the assumption: Circle Nanopayments docs on Arc state that
 *   USDC is the native token and the SDK does not separately quote gas in
 *   ETH. This is a documented assumption — measurement is still real, only
 *   the unit conversion is a constant.
 */
const NATIVE_DECIMALS = 6 // USDC has 6 decimals on Arc

interface RpcReceipt {
  gasUsed: bigint
  effectiveGasPrice: bigint
  blockNumber: bigint
}

export async function fetchTxReceipt(txHash: string, rpcUrl?: string): Promise<RpcReceipt | null> {
  const url = rpcUrl ?? process.env.ARC_RPC_URL
  if (!url) {
    console.warn('[GAS] ARC_RPC_URL not configured; cannot measure gas')
    return null
  }
  if (!txHash || !txHash.startsWith('0x')) return null

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1
      })
    })
    if (!res.ok) {
      console.warn(`[GAS] receipt fetch HTTP ${res.status} for ${txHash}`)
      return null
    }
    const json = await res.json() as { result?: { gasUsed?: string; effectiveGasPrice?: string; blockNumber?: string } | null }
    const r = json.result
    if (!r) return null
    return {
      gasUsed: BigInt(r.gasUsed ?? '0x0'),
      effectiveGasPrice: BigInt(r.effectiveGasPrice ?? '0x0'),
      blockNumber: BigInt(r.blockNumber ?? '0x0')
    }
  } catch (e) {
    console.error('[GAS] receipt fetch failed:', e)
    return null
  }
}

export function gasCostUsdc(gasUsed: bigint, effectiveGasPrice: bigint): number {
  // gasUsed × effectiveGasPrice (both wei-equivalent) / 10^NATIVE_DECIMALS
  // Use BigInt math to avoid precision loss on large multiplications, then
  // divide to a number at the very end where we know the magnitude is small.
  const totalSmallestUnit = gasUsed * effectiveGasPrice
  // Convert to a NUMERIC-friendly decimal. We keep 9 decimal places of USDC
  // precision (matching the NUMERIC(18,9) column type). Using BigInt() over
  // a literal `10n ** ...` because tsconfig target predates ES2020 BigInt literals.
  const divisor = BigInt(10) ** BigInt(NATIVE_DECIMALS)
  const whole = totalSmallestUnit / divisor
  const remainder = totalSmallestUnit % divisor
  // remainder fits in NATIVE_DECIMALS digits — safe to convert via Number
  const fractional = Number(remainder) / Number(divisor)
  return Number(whole) + fractional
}

/**
 * Fetch the receipt for a confirmed payment intent and persist the gas
 * measurement. The 004 trigger automatically rolls the per-task sum into
 * settlements.total_gas_cost.
 */
export async function measureIntentGasCost(paymentIntentId: string, txHash: string): Promise<void> {
  if (!supabaseAdmin) return
  const receipt = await fetchTxReceipt(txHash)
  if (!receipt) return

  const cost = gasCostUsdc(receipt.gasUsed, receipt.effectiveGasPrice)

  const { error } = await supabaseAdmin
    .from('payment_intents')
    .update({
      gas_used: Number(receipt.gasUsed),
      gas_price: receipt.effectiveGasPrice.toString(), // NUMERIC(38,0) — string-safe
      gas_cost_usdc: cost,
      block_number: Number(receipt.blockNumber)
    })
    .eq('id', paymentIntentId)

  if (error) {
    console.error('[GAS] update failed for', paymentIntentId, error.message)
  }
}
