import dotenv from 'dotenv';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

dotenv.config({ path: '.env.local' });

async function main() {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    
    if (!apiKey || !entitySecret) {
        console.error('Missing credentials');
        return;
    }

    const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
    const txId = '1a521552-feaa-5868-92fc-00d01a3a1f29';

    try {
        console.log('Fetching transaction:', txId);
        const status = await (client as any).getTransaction({ id: txId });
        console.log('Response:', JSON.stringify(status.data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
