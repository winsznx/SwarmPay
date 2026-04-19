const testOrchestration = async () => {
  const API_BASE = 'http://127.0.0.1:3001/api';
  console.log('🚀 Phase 4 Orchestration & Decomposition Test');

  try {
    // 1. Setup Agents
    console.log('🤖 Registering agents...');
    const agentA = await (await fetch(`${API_BASE}/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Lead-Agent', type: 'orchestrator' }) })).json();
    const agentB = await (await fetch(`${API_BASE}/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Sub-Agent', type: 'research' }) })).json();

    // 2. Create Task
    const prompt = 'Analyze BTC Trends for Q2';
    const task = await (await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, budget: 0.50 }),
    })).json();

    // 3. Bid & Select Lead Agent
    console.log('⚖️ Selecting Lead Agent...');
    await fetch(`${API_BASE}/bids`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, agentId: agentA.id, price: 0.20, strategy: 'Lead the project', estimatedTimeMs: 10000 }) });
    await fetch(`${API_BASE}/tasks/${task.id}/select`, { method: 'POST' });

    // 4. Trigger Decomposition
    console.log('🏗️ Triggering Decomposition...');
    const decompRes = await fetch(`${API_BASE}/tasks/${task.id}/decompose`, { method: 'POST' });
    const decompData = await decompRes.json();
    
    if (!decompRes.ok) throw new Error(decompData.error);

    // 5. Assertions
    console.log('✅ Verifying Sub-Tasks...');
    const subTasks = await (await fetch(`${API_BASE}/tasks/${task.id}/subtasks`)).json();
    
    if (subTasks.length === 4) {
      console.log('🎉 SUCCESS: Exactly 4 sub-tasks created.');
    } else {
      throw new Error(`Invalid sub-task count: ${subTasks.length}`);
    }

    const allLinked = subTasks.every(st => 
        st.parentTaskId === task.id && 
        st.parentAgentId === agentA.id &&
        st.status === 'bidding'
    );
    
    if (allLinked) {
      console.log('🎉 SUCCESS: All sub-tasks correctly linked to Lead Agent.');
    } else {
      throw new Error('Sub-task linkage failed.');
    }

    const contextPreserved = subTasks.some(st => st.description.toLowerCase().includes('btc trends'));
    if (contextPreserved) {
      console.log('🎉 SUCCESS: Descriptions include original prompt context.');
    } else {
      throw new Error(`Description generation lost context. Found: ${subTasks[0].description}`);
    }

    // 6. Parent Status Check
    console.log('⚛️ Verifying Parent Task Status...');
    const finalTask = await (await fetch(`${API_BASE}/tasks/${task.id}`)).json();
    if (finalTask.status === 'executing') {
      console.log('🎉 SUCCESS: Parent task transitioned to EXECUTING.');
    } else {
      throw new Error(`Invalid parent status: ${finalTask.status}`);
    }

  } catch (err) {
    console.error('❌ Orchestration Test FAILED:', err.message);
  }
};

testOrchestration();
