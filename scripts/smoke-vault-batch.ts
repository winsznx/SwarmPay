/**
 * Direct vault smoke test — proves the batch settlement contract end-to-end on Arc.
 *
 * Builds a 60-payment batch matching the real pipeline shape:
 *   - 5 sub-tasks × 12 micro-intents each (lead → sub-agent)
 *   - small per-payment amount split from a sub-task share
 * Submits as a single platform-signed `settleBatch` tx, waits for the receipt,
 * decodes the PaymentSettled + BatchSettled events from the logs, and prints
 * the verifiable Arc explorer link.
 *
 * Run:
 *   npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node","esModuleInterop":true}' scripts/smoke-vault-batch.ts
 */
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'
import vaultArtifact from '../artifacts/SettlementVault.json'

dotenv.config({ path: '.env.local' })

interface AgentSpec { id: string; address: string; vaultBalanceUsdc: number }

async function main() {
  const rpc = process.env.ARC_RPC_URL!
  const chainId = parseInt(process.env.ARC_CHAIN_ID ?? '5042002', 10)
  const vaultAddr = process.env.SETTLEMENT_VAULT_ADDRESS
  const platformKey = process.env.PLATFORM_PRIVATE_KEY
  if (!vaultAddr || !platformKey) { console.error('[SMOKE] missing SETTLEMENT_VAULT_ADDRESS or PLATFORM_PRIVATE_KEY'); process.exit(1) }

  const provider = new ethers.JsonRpcProvider(rpc, chainId)
  const platform = new ethers.Wallet(platformKey, provider)
  const vault = new ethers.Contract(vaultAddr, vaultArtifact.abi, platform)

  // Resolve all 6 agent addresses from Circle.
  const { initiateDeveloperControlledWalletsClient } = await import('@circle-fin/developer-controlled-wallets')
  const circle = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  }) as any
  const wallets: Record<string, string | undefined> = {
    'crypto-scout-x':  process.env.WALLET_ID_CRYPTO_SCOUT_X,
    'research-alpha':  process.env.WALLET_ID_RESEARCH_ALPHA,
    'data-miner-pro':  process.env.WALLET_ID_DATA_MINER_PRO,
    'parser-x':        process.env.WALLET_ID_PARSER_X,
    'analysis-node':   process.env.WALLET_ID_ANALYSIS_NODE,
    'compute-grid-4':  process.env.WALLET_ID_COMPUTE_GRID_4,
  }
  const agents: AgentSpec[] = []
  for (const [id, walletId] of Object.entries(wallets)) {
    if (!walletId) continue
    const w = await circle.getWallet({ id: walletId })
    const addr: string = w.data?.wallet?.address
    const bal = (await vault.balanceOf(addr)) as bigint
    agents.push({ id, address: addr, vaultBalanceUsdc: Number(ethers.formatUnits(bal, 18)) })
    console.log(`[SMOKE] ${id} (${addr}): vault $${Number(ethers.formatUnits(bal, 18)).toFixed(6)}`)
  }

  // Pick a lead with the largest vault balance so the batch fits.
  agents.sort((a, b) => b.vaultBalanceUsdc - a.vaultBalanceUsdc)
  const lead = agents[0]
  const subs = agents.slice(1, 6) // 5 sub-agents
  console.log(`[SMOKE] lead: ${lead.id} ($${lead.vaultBalanceUsdc.toFixed(4)} in vault)`)
  console.log(`[SMOKE] subs: ${subs.map(s => s.id).join(', ')}`)

  // Build pipeline-shaped payments — 5 sub-tasks × 12 micro-intents.
  const SUBTASKS = 5
  const MICRO_PER_SUB = 12
  const BATCH_TOTAL_USDC = 0.06 // pipeline workPool ≈ this scale
  const subShareUsdc = BATCH_TOTAL_USDC / SUBTASKS
  const microUsdc = subShareUsdc / MICRO_PER_SUB
  const microWei = ethers.parseUnits(microUsdc.toFixed(18), 18)
  const totalNeeded = microWei * BigInt(SUBTASKS * MICRO_PER_SUB)
  console.log(`[SMOKE] generating ${SUBTASKS}×${MICRO_PER_SUB} = ${SUBTASKS*MICRO_PER_SUB} micro-intents, ` +
    `each $${microUsdc.toFixed(8)} (sub share $${subShareUsdc.toFixed(6)}, total $${ethers.formatUnits(totalNeeded, 18)})`)

  if (BigInt(Math.floor(lead.vaultBalanceUsdc * 1e18)) < totalNeeded) {
    console.error(`[SMOKE] lead vault insufficient: have ~$${lead.vaultBalanceUsdc} need $${ethers.formatUnits(totalNeeded, 18)}`)
    process.exit(1)
  }

  const payments: Array<{ from: string; to: string; amount: bigint }> = []
  for (let s = 0; s < SUBTASKS; s++) {
    const sub = subs[s % subs.length]
    for (let k = 0; k < MICRO_PER_SUB; k++) {
      payments.push({ from: lead.address, to: sub.address, amount: microWei })
    }
  }
  // Add a platform fee intent to mirror the pipeline.
  const platformFeeWei = ethers.parseUnits('0.003', 18)
  payments.push({ from: lead.address, to: process.env.PLATFORM_WALLET_ADDRESS!, amount: platformFeeWei })
  console.log(`[SMOKE] total payments in batch: ${payments.length} (1 platform fee)`)

  const taskIdHex = ethers.id(`smoke-${Date.now()}`)
  const encoded = payments.map(p => [p.from, p.to, p.amount])

  console.log('[SMOKE] estimating gas...')
  const gasEstimate = await vault.settleBatch.estimateGas(taskIdHex, encoded)
  console.log(`[SMOKE] gas estimate: ${gasEstimate.toString()}`)

  console.log('[SMOKE] submitting settleBatch...')
  const tx = await vault.settleBatch(taskIdHex, encoded)
  console.log(`[SMOKE] tx hash: ${tx.hash}`)
  const receipt = await tx.wait()
  if (!receipt) { console.error('[SMOKE] no receipt'); process.exit(1) }

  // Decode events.
  const iface = new ethers.Interface(vaultArtifact.abi)
  let paymentSettledCount = 0
  let batchSettled: ethers.LogDescription | null = null
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log as { topics: string[]; data: string })
      if (parsed?.name === 'PaymentSettled') paymentSettledCount++
      if (parsed?.name === 'BatchSettled') batchSettled = parsed
    } catch { /* foreign log */ }
  }

  const gasUsed = receipt.gasUsed as bigint
  const gasPrice = (receipt.gasPrice ?? receipt.effectiveGasPrice ?? BigInt(0)) as bigint
  const gasCostUsdc = Number(ethers.formatUnits(gasUsed * gasPrice, 18))

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log('  PATH A SMOKE TEST — DIRECT VAULT BATCH SETTLE')
  console.log('═══════════════════════════════════════════════════════════════════════')
  console.log(`  payments submitted     : ${payments.length}`)
  console.log(`  PaymentSettled events  : ${paymentSettledCount}`)
  console.log(`  BatchSettled total     : $${batchSettled ? ethers.formatUnits(batchSettled.args[2], 18) : '?'}`)
  console.log(`  block number           : ${receipt.blockNumber}`)
  console.log(`  gas used               : ${gasUsed.toString()}`)
  console.log(`  gas cost (USDC)        : $${gasCostUsdc.toFixed(6)}`)
  console.log(`  per-payment gas        : $${(gasCostUsdc / payments.length).toFixed(8)}`)
  console.log(`  tx hash                : ${tx.hash}`)
  console.log(`  arcscan                : https://testnet.arcscan.app/tx/${tx.hash}`)
  console.log('═══════════════════════════════════════════════════════════════════════')

  if (paymentSettledCount !== payments.length) {
    console.error(`[SMOKE] EVENT COUNT MISMATCH: expected ${payments.length} PaymentSettled, got ${paymentSettledCount}`)
    process.exit(1)
  }
  if (!batchSettled) {
    console.error('[SMOKE] BatchSettled event missing from receipt')
    process.exit(1)
  }
  console.log('[SMOKE] ✓ all payments settled atomically in 1 Arc tx')

  // Print final vault balances.
  console.log('[SMOKE] final vault balances:')
  for (const a of agents) {
    const bal = (await vault.balanceOf(a.address)) as bigint
    console.log(`  ${a.id}: $${Number(ethers.formatUnits(bal, 18)).toFixed(6)}`)
  }
  const platformBal = (await vault.balanceOf(process.env.PLATFORM_WALLET_ADDRESS!)) as bigint
  console.log(`  platform: $${Number(ethers.formatUnits(platformBal, 18)).toFixed(6)}`)
}

main().catch(e => { console.error(e); process.exit(1) })
