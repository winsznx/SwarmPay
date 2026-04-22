import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const client = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
})

const AGENTS = [
  'crypto-scout-x',
  'research-alpha',
  'data-miner-pro',
  'parser-x',
  'analysis-node',
  'compute-grid-4',
]

async function setupWallets() {
  console.log('Creating wallets for', AGENTS.length, 'agents...')

  // Create wallet set
  const walletSet = await client.createWalletSet({ name: 'SwarmPay Agents' })
  const walletSetId = walletSet.data?.walletSet?.id
  console.log('Wallet set created:', walletSetId)

  // Create one wallet per agent
  for (const agentId of AGENTS) {
    const wallet = await client.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId: walletSetId!,
      metadata: [{ name: agentId, refId: agentId }]
    })
    const w = wallet.data?.wallets?.[0]
    console.log(`\nAgent: ${agentId}`)
    console.log(`  Wallet ID: ${w?.id}`)
    console.log(`  Address: ${w?.address}`)
    console.log(`  Add to .env.local: WALLET_ID_${agentId.toUpperCase().replace(/-/g, '_')}=${w?.id}`)
  }
}

setupWallets().catch(console.error)
