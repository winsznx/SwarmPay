const delay = (ms) => new Promise(res => setTimeout(res, ms));

const testAutonomousEconomy = async () => {
  const API_BASE = 'http://127.0.0.1:3001/api';
  console.log('🚀 Phase 5: Autonomous Agent Economy Verification');

  try {
    // 1. Register Specialized Agents
    console.log('🤖 Registering specialized workers...');
    const roles = ['research-agent', 'planning-agent', 'execution-agent', 'validation-agent'];
    const agents = [];
    for (const role of roles) {
       const res = await fetch(`${API_BASE}/agents`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name: `Worker-${role}`, role })
       });
       agents.push(await res.json());
    }
    console.log(`✅ ${agents.length} specialized agents ready.`);

    // 2. Create Complex Task
    const prompt = "Design a decentralized freelance marketplace with AI agents and crypto payments";
    console.log(`📝 Creating complex task: "${prompt}"`);
    const task = await (await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, budget: 0.50 }),
    })).json();

    // 3. Initial Bidding & Selection for Lead Agent
    console.log('⚖️ Selecting Lead Agent...');
    await fetch(`${API_BASE}/bids`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, agentId: agents[0].id, price: 0.05, strategy: 'Orchestrate the marketplace design' })
    });
    await delay(500);
    await fetch(`${API_BASE}/tasks/${task.id}/select`, { method: 'POST' });

    // 4. Trigger Execution (which triggers Decomposition)
    console.log('🏗️ Triggering Execution Pipeline...');
    const exeRes = await (await fetch(`${API_BASE}/tasks/${task.id}/execute`, { method: 'POST' })).json();
    
    if (exeRes.decomposed) {
      console.log('✨ Parent task decomposed. Starting sub-task engine...');
      await delay(1000);

      // 5. Recursive Execution Loop (Layer 1 Subtasks)
      const subTasks = await (await fetch(`${API_BASE}/tasks/${task.id}/subtasks`)).json();
      console.log(`📊 Found ${subTasks.length} sub-tasks. Processing...`);

      for (const st of subTasks) {
        console.log(`  🔍 Sub-task: ${st.title} (${st.id})`);
        
        // Find matching role agent
        const roleMap = { 'Research': 'research-agent', 'Planning': 'planning-agent', 'Execution': 'execution-agent', 'Validation': 'validation-agent' };
        const worker = agents.find(a => a.role === roleMap[st.title]) || agents[0];

        // Bid, Select, and Execute Sub-task
        await fetch(`${API_BASE}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: st.id, agentId: worker.id, price: 0.02, strategy: 'Specialized execution' })
        });
        await delay(500);
        await fetch(`${API_BASE}/tasks/${st.id}/select`, { method: 'POST' });
        await delay(500);
        
        const stExeRes = await (await fetch(`${API_BASE}/tasks/${st.id}/execute`, { method: 'POST' })).json();
        console.log(`  ✅ ${st.title} finished. Result: ${stExeRes.result?.result?.substring(0, 50)}...`);
      }
    }

    // 6. Verify Rewards & Aggregation
	console.log('\n💰 Economic Audit:');
    const finalAgents = await (await fetch(`${API_BASE}/agents`)).json();
    finalAgents.forEach(a => {
       if (a.wallet > 0) console.log(`  💵 Agent ${a.name} (${a.role}): ${a.wallet.toFixed(4)} USDC Earned`);
    });

    const finalTask = await (await fetch(`${API_BASE}/tasks`)).json().then(tasks => tasks.find(t => t.id === task.id));
    console.log(`\n🏆 Parent Task Status: ${finalTask?.status}`);
    if (finalTask?.status === 'completed') console.log('🎉 SYSTEM TEST PASSED!');

  } catch (err) {
    console.error('❌ Phase 5 Test FAILED:', err);
  }
};

testAutonomousEconomy();
