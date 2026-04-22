import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function findTokenId() {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  })

  // Use the first agent's wallet ID
  const walletId = process.env.WALLET_ID_CRYPTO_SCOUT_X
  if (!walletId) {
    console.error('❌ No WALLET_ID_CRYPTO_SCOUT_X found in .env.local')
    return
  }

  console.log(`🔍 Fetching balances for wallet ${walletId}...`)
  
  try {
    const res = await client.getWalletTokenBalance({
      id: walletId
    })

    const balance = res.data?.tokenBalances?.[0]
    if (balance) {
      console.log('✅ Found Token ID for', balance.token?.symbol)
      console.log(`🚀 Token ID: ${balance.token?.id}`)
      console.log(`\nAdd this to your .env.local: USDC_TOKEN_ID=${balance.token?.id}`)
    } else {
      console.warn('⚠️ No tokens found in this wallet yet. Please fund it first at https://faucet.circle.com')
      console.warn('Address to fund:', '0x6150b2a7167c7e5a7b7fbf39c91e685dc6509cf4')
    }
  } catch (error) {
    console.error('❌ Error fetching balances:', error)
  }
}

findTokenId()
