import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { store } from '../src/lib/store';

async function debugSync() {
    console.log('--- Debug Sync Start ---');
    try {
        await store.refreshAgentWallets();
        const balances = registry.reduce((acc: any, agent: any) => ({
            ...acc,
            [agent.id]: agent.wallet
        }), {});
        const agents = store.getAgents();
        console.log('Final Agent States:');
        agents.forEach(agent => {
            console.log(`- ${agent.id}: ${agent.wallet} USDC (${agent.walletAddress})`);
        });
    } catch (e) {
        console.error('Sync Failed:', e);
    }
    console.log('--- Debug Sync End ---');
}

debugSync();
