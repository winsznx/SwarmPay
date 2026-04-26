/**
 * Deploy SettlementVault to Arc testnet.
 *
 * Reads the compiled artifact from artifacts/SettlementVault.json,
 * deploys via PLATFORM_PRIVATE_KEY (which becomes vault owner),
 * waits for the receipt, prints the address + tx hash, and writes
 * SETTLEMENT_VAULT_ADDRESS into .env.local (idempotent).
 *
 * Run: npx ts-node --transpile-only --compiler-options '{"module":"CommonJS","moduleResolution":"Node","esModuleInterop":true}' scripts/deploy-vault.ts
 */
import * as fs from 'fs'
import * as path from 'path'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const ARTIFACT = path.resolve(__dirname, '../artifacts/SettlementVault.json')
const ENV_FILE = path.resolve(__dirname, '../.env.local')

async function main() {
  const rpc = process.env.ARC_RPC_URL
  const key = process.env.PLATFORM_PRIVATE_KEY
  if (!rpc || !key) {
    console.error('[DEPLOY] missing ARC_RPC_URL or PLATFORM_PRIVATE_KEY')
    process.exit(1)
  }

  if (process.env.SETTLEMENT_VAULT_ADDRESS) {
    console.log(`[DEPLOY] SETTLEMENT_VAULT_ADDRESS already set: ${process.env.SETTLEMENT_VAULT_ADDRESS}`)
    console.log('[DEPLOY] re-deploying anyway — pass SKIP_REDEPLOY=1 to skip')
    if (process.env.SKIP_REDEPLOY === '1') return
  }

  const provider = new ethers.JsonRpcProvider(rpc, parseInt(process.env.ARC_CHAIN_ID ?? '5042002', 10))
  const wallet = new ethers.Wallet(key, provider)
  const balance = await provider.getBalance(wallet.address)
  console.log(`[DEPLOY] deployer ${wallet.address} balance ${ethers.formatUnits(balance, 18)} USDC`)

  const artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'))
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)

  console.log('[DEPLOY] deploying SettlementVault...')
  const contract = await factory.deploy()
  const tx = contract.deploymentTransaction()
  console.log(`[DEPLOY] tx: ${tx?.hash}`)
  const deployed = await contract.waitForDeployment()
  const addr = await deployed.getAddress()
  const receipt = await tx?.wait()
  console.log(`[DEPLOY] vault deployed at ${addr}`)
  console.log(`[DEPLOY] gas used: ${receipt?.gasUsed?.toString()} | block: ${receipt?.blockNumber}`)
  console.log(`[DEPLOY] explorer: https://testnet.arcscan.app/tx/${tx?.hash}`)

  // Persist to .env.local — replace existing line or append.
  const env = fs.readFileSync(ENV_FILE, 'utf8')
  const line = `SETTLEMENT_VAULT_ADDRESS=${addr}`
  const updated = env.includes('SETTLEMENT_VAULT_ADDRESS=')
    ? env.replace(/SETTLEMENT_VAULT_ADDRESS=.*/g, line)
    : env.trimEnd() + `\n\n# SwarmPay SettlementVault on Arc testnet (one-tx batch settlement)\n${line}\n`
  fs.writeFileSync(ENV_FILE, updated)
  console.log(`[DEPLOY] wrote SETTLEMENT_VAULT_ADDRESS to ${ENV_FILE}`)
}

main().catch(e => { console.error(e); process.exit(1) })
