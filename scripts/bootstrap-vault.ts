/**
 * One-time vault funding: each Circle agent wallet sends seed USDC into the
 * SettlementVault. The vault's receive() handler credits balances[msg.sender]
 * so the value lands on the agent's internal ledger ready for batch settles.
 *
 * Idempotent: skips agents that already hold ≥ MIN_BALANCE in the vault.
 *
 * Run:
 *   npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node","esModuleInterop":true}' scripts/bootstrap-vault.ts
 *
 * Requires:
 *   SETTLEMENT_VAULT_ADDRESS (set by deploy-vault.ts)
 *   CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET (Circle developer-controlled wallets)
 *   USDC_TOKEN_ID, WALLET_ID_* env vars (already populated)
 */
import { ethers } from 'ethers'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SEED_USDC = parseFloat(process.env.VAULT_SEED_USDC ?? '0.50')
const MIN_BALANCE_USDC = parseFloat(process.env.VAULT_MIN_BALANCE_USDC ?? '0.30')

interface AgentSpec {
  agentId: string
  walletId: string
}

function listAgents(): AgentSpec[] {
  const map: Record<string, string | undefined> = {
    'crypto-scout-x':  process.env.WALLET_ID_CRYPTO_SCOUT_X,
    'research-alpha':  process.env.WALLET_ID_RESEARCH_ALPHA,
    'data-miner-pro':  process.env.WALLET_ID_DATA_MINER_PRO,
    'parser-x':        process.env.WALLET_ID_PARSER_X,
    'analysis-node':   process.env.WALLET_ID_ANALYSIS_NODE,
    'compute-grid-4':  process.env.WALLET_ID_COMPUTE_GRID_4,
  }
  const out: AgentSpec[] = []
  for (const [agentId, walletId] of Object.entries(map)) {
    if (walletId) out.push({ agentId, walletId })
  }
  return out
}

async function main() {
  const vaultAddr = process.env.SETTLEMENT_VAULT_ADDRESS
  if (!vaultAddr) { console.error('[BOOTSTRAP] SETTLEMENT_VAULT_ADDRESS not set'); process.exit(1) }
  const circle = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  }) as any

  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL!, parseInt(process.env.ARC_CHAIN_ID ?? '5042002', 10))
  // Minimal ABI to read balances
  const vault = new ethers.Contract(
    vaultAddr,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  )

  const agents = listAgents()
  console.log(`[BOOTSTRAP] vault=${vaultAddr} agents=${agents.length} seed=$${SEED_USDC} min=$${MIN_BALANCE_USDC}`)

  for (const { agentId, walletId } of agents) {
    const wallet = await circle.getWallet({ id: walletId })
    const address: string = wallet.data?.wallet?.address
    if (!address) { console.warn(`[BOOTSTRAP] ${agentId}: no address`); continue }

    const onChainBalanceWei = (await vault.balanceOf(address)) as bigint
    const onChainBalanceUsdc = Number(ethers.formatUnits(onChainBalanceWei, 18))

    if (onChainBalanceUsdc >= MIN_BALANCE_USDC) {
      console.log(`[BOOTSTRAP] ✓ ${agentId} (${address}) already holds $${onChainBalanceUsdc.toFixed(4)} in vault — skip`)
      continue
    }

    const need = SEED_USDC - onChainBalanceUsdc
    console.log(`[BOOTSTRAP] depositing $${need.toFixed(4)} from ${agentId} (${walletId}) → vault`)

    let tx
    try {
      tx = await circle.createTransaction({
        walletId,
        destinationAddress: vaultAddr,
        amount: [need.toFixed(6)],
        blockchain: 'ARC-TESTNET' as any,
        tokenId: process.env.USDC_TOKEN_ID ?? '',
        fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
      })
    } catch (e) {
      console.error(`[BOOTSTRAP] ${agentId} createTransaction failed:`, e)
      continue
    }
    const transactionId = (tx.data as any)?.id
    if (!transactionId) { console.warn(`[BOOTSTRAP] ${agentId}: no tx id`); continue }

    let txHash: string | undefined
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const status = await circle.getTransaction({ id: transactionId })
      const state = status.data?.transaction?.state
      const hash = status.data?.transaction?.txHash
      if (hash && hash.toLowerCase().startsWith('0x')) { txHash = hash; break }
      if (state === 'FAILED' || state === 'CANCELLED') {
        console.error(`[BOOTSTRAP] ${agentId}: tx ${state}`, status.data?.transaction?.errorReason)
        break
      }
    }
    if (txHash) {
      console.log(`[BOOTSTRAP] ✓ ${agentId} deposit confirmed: ${txHash}`)
      console.log(`            https://testnet.arcscan.app/tx/${txHash}`)
    } else {
      console.warn(`[BOOTSTRAP] ${agentId}: deposit did not confirm in 60s`)
    }
  }

  console.log('[BOOTSTRAP] verifying final vault balances...')
  for (const { agentId, walletId } of agents) {
    const w = await circle.getWallet({ id: walletId })
    const a: string = w.data?.wallet?.address
    if (!a) continue
    const bal = (await vault.balanceOf(a)) as bigint
    console.log(`  ${agentId} (${a}): $${Number(ethers.formatUnits(bal, 18)).toFixed(6)} in vault`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
