import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const circle = initiateDeveloperControlledWalletsClient({
  apiKey: process.env.CIRCLE_API_KEY || '',
  entitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
});

async function test() {
  const walletId = process.env.WALLET_ID_CRYPTO_SCOUT_X;
  console.log('Testing wallet:', walletId);
  console.log('USDC_TOKEN_ID:', process.env.USDC_TOKEN_ID);

  try {
    const res = await (circle as any).getWallet({ id: walletId });
    console.log("Wallet data:", JSON.stringify(res.data, null, 2));
    
    const usdcBalance = res.data?.tokenBalances?.find((b: any) => 
      b.token?.id === process.env.USDC_TOKEN_ID || 
      b.token?.symbol?.toUpperCase() === 'USDC'
    );
    
    console.log('Found USDC balance:', usdcBalance);
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
