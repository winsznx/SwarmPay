const testTreeAPI = async () => {
  const API_BASE = 'http://127.0.0.1:3001/api';
  console.log('🚀 Verifying Recursive Tree API...');

  try {
    // 1. Get all tasks
    const tasks = await (await fetch(`${API_BASE}/tasks`)).json();
    if (tasks.length === 0) {
      console.log('⚠️ No tasks found. Skipping.');
      return;
    }

    const taskId = tasks[0].id;
    console.log(`🔍 Checking tree for Task: ${taskId}`);

    const tree = await (await fetch(`${API_BASE}/tasks/${taskId}/tree`)).json();

    console.log(`📊 Nodes found: ${tree.nodes.length}`);
    console.log(`📈 Edges found: ${tree.edges.length}`);

    if (tree.nodes.length > 0) {
      console.log('✅ API returned nodes.');
      tree.nodes.forEach((n, i) => console.log(`  [Node ${i+1}] ${n.data.label} (${n.data.status})`));
    }

    if (tree.edges.length > 0) {
      console.log('✅ API returned edges.');
    }

    console.log('🎉 Tree API Verification Complete.');

  } catch (err) {
    console.error('❌ Tree API failed:', err);
  }
};

testTreeAPI();
