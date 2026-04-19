const delay = (ms) => new Promise(res => setTimeout(res, ms));

const testAIOrchestration = async () => {
  const API_BASE = 'http://127.0.0.1:3001/api';
  console.log('🚀 Phase 4.5: Real-World LLM Integration Test');

  try {
    // 1. Setup Agents
    console.log('🤖 Registering agents...');
    const agentA = await (await fetch(`${API_BASE}/agents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'GPT-Lead-Agent', type: 'orchestrator' }) })).json();
    await delay(500);

    // 2. Create Task
    const prompt = 'How can I optimize my supply chain using zero-knowledge proofs?';
    console.log(`📝 Creating complex task: "${prompt}"`);
    const task = await (await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, budget: 1.00 }),
    })).json();
    await delay(500);

    // 3. Bid & Select
    console.log('⚖️ Selecting AI Lead Agent...');
    const bidRes = await fetch(`${API_BASE}/bids`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, agentId: agentA.id, price: 0.10, strategy: 'Use GPT-4o for deep reasoning', estimatedTimeMs: 5000 }) });
    if (!bidRes.ok) throw new Error(`Bid failed: ${await bidRes.text()}`);
    await delay(500);

    const selectRes = await fetch(`${API_BASE}/tasks/${task.id}/select`, { method: 'POST' });
    if (!selectRes.ok) throw new Error(`Selection failed: ${await selectRes.text()}`);
    console.log('✅ Selection confirmed.');
    await delay(500);

    // 4. Trigger AI Decomposition
    console.log('🏗️ Triggering Real AI Decomposition...');
    const decompRes = await fetch(`${API_BASE}/tasks/${task.id}/decompose`, { method: 'POST' });
    const decompData = await decompRes.json();
    
    if (!decompRes.ok) throw new Error(decompData.error);

    // 5. Verification
    const subTasks = await (await fetch(`${API_BASE}/tasks/${task.id}/subtasks`)).json();
    
    console.log('\n📊 AI Decomposition Results:');
    subTasks.forEach((st, i) => {
       console.log(`  ${i+1}. ${st.title}: ${st.description}`);
    });

    const isSmart = subTasks.some(st => st.description.toLowerCase().includes('zero-knowledge') || st.description.toLowerCase().includes('zk'));
    
    if (isSmart) {
      console.log('\n🎉 SUCCESS: AI successfully integrated original context (ZK proofs).');
    } else {
      console.warn('\n⚠️ WARNING: Descriptions look generic. Fallback might have been triggered.');
    }

  } catch (err) {
    console.error('\n❌ AI Integration Test FAILED:', err.message);
  }
};

testAIOrchestration();
