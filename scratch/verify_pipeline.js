const http = require('http');
const fs = require('fs');
const path = require('path');

async function postTask(prompt, budget) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ prompt, budget });
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/tasks',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function run() {
    try {
        console.log('🚀 Starting verification script...');
        const t1 = await postTask("How to make pancakes", 0.30);
        console.log('✅ Submitted Pancake Task:', t1.id);
        
        const t2 = await postTask("Build a REST API with authentication", 0.30);
        console.log('✅ Submitted API Task:', t2.id);

        console.log('⏳ Waiting 60s for autonomous pipeline to complete...');
        await new Promise(r => setTimeout(r, 60000));

        console.log('🔍 Checking store.json for results...');
        const storePath = path.join(process.cwd(), 'store.json');
        const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

        const r1 = store.tasks.find(([id, t]) => id === t1.id)?.[1];
        const r2 = store.tasks.find(([id, t]) => id === t2.id)?.[1];

        console.log('\n--- RESULT: PANCAKES ---');
        console.log(r1?.result?.result || 'FAIL: No result found');
        
        console.log('\n--- RESULT: REST API ---');
        console.log(r2?.result?.result || 'FAIL: No result found');

        if (r1?.result?.result && !r1.result.result.includes('BTC') && r1.result.result.includes('pancakes')) {
            console.log('\n✅ VERIFICATION SUCCESS: Topic-aware logic is working.');
        } else {
            console.log('\n❌ VERIFICATION FAILURE: Output still mentions crypto or topic missing.');
        }

    } catch (e) {
        console.error('❌ Script Error:', e.message);
    }
}

run();
