import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function checkRawBalance() {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  })

  const walletId = process.env.WALLET_ID_CRYPTO_SCOUT_X
  console.log(`🔍 Raw check for wallet: ${walletId}...`)
  
  try {
    const res = await (client as any).getWalletTokenBalance({ id: walletId })
    console.log('📦 Raw Response:', JSON.stringify(res.data, null, 2))
    
    const usdc = res.data?.tokenBalances?.find((b: any) => 
      b.token?.id === process.env.USDC_TOKEN_ID || b.token?.symbol === 'USDC'
    )
    console.log('\n📊 Found USDC:', usdc ? `${usdc.amount} ${usdc.token?.symbol}` : 'NOT FOUND')
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

checkRawBalance()
