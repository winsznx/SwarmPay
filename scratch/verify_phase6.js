const fs = require('fs');
const path = require('path');

async function testPhase6() {
  console.log('🚀 Phase 6: Intelligent Agent Network Verification');
  
  const storePath = path.join(process.cwd(), 'store.json');
  if (!fs.existsSync(storePath)) {
    console.log('❌ store.json not found. Run the app first.');
    return;
  }

  const storeData = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const agents = new Map(storeData.agents);
  const messages = new Map(storeData.messages);

  console.log('\n🧠 Memory Audit:');
  agents.forEach((agent, id) => {
    console.log(`- Agent ${agent.name}: Memory Depth=${agent.memory?.pastTasks?.length || 0}, Success=${agent.memory?.successCount || 0}`);
    if (agent.memory?.pastTasks?.length > 0) {
      console.log(`  └─ Last Context: "${agent.memory.pastTasks[0]}"`);
    }
  });

  console.log('\n💬 Communication Audit:');
  console.log(`- Total Messages in Bus: ${messages.size}`);
  if (messages.size > 0) {
    const lastMsg = Array.from(messages.values()).pop();
    console.log(`- Last Message: From ${lastMsg.fromAgentId} -> ${lastMsg.taskId.slice(0,8)}: "${lastMsg.content.slice(0,40)}..."`);
  }

  console.log('\n⭐ Reputation Audit:');
  agents.forEach(agent => {
    console.log(`- ${agent.name}: Reputation Score = ${agent.reputation}`);
  });

  console.log('\n✅ Verification Script Complete.');
}

testPhase6().catch(console.error);
