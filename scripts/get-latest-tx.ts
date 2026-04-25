import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function getLatestTx() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;

  if (!apiKey || !entitySecret) {
    console.error('Missing Circle credentials in .env.local');
    return;
  }

  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  const walletId = process.env.WALLET_ID_CRYPTO_SCOUT_X;
  console.log(`🔍 Fetching latest transactions for wallet: ${walletId}...`);

  try {
    const res = await (client as any).listTransactions({
        walletIds: [walletId],
        pageSize: 5
    });

    const txs = res.data?.transactions || [];
    if (txs.length === 0) {
      console.log('No transactions found for this wallet.');
      return;
    }

    console.log(`\nFound ${txs.length} recent transactions:\n`);

    txs.forEach((tx: any, i: number) => {
      console.log(`${i+1}. ID: ${tx.id}`);
      console.log(`   State: ${tx.state}`);
      console.log(`   Amount: ${tx.amounts?.[0] || 'N/A'}`);
      console.log(`   TxHash: ${tx.txHash || 'PENDING'}`);
      if (tx.txHash && tx.txHash.startsWith('0x')) {
        console.log(`   ✅ VERIFIED ON ARC: https://testnet.arcscan.app/tx/${tx.txHash}`);
      }
      console.log('-------------------');
    });

  } catch (err) {
    console.error('Failed to fetch transactions:', err);
  }
}

getLatestTx();
