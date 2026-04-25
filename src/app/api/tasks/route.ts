import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Task, CostBreakdown } from '@/types';
import { runAutonomousPipeline } from '@/lib/pipeline';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '0');
  
  // VERCEL STABILIZATION: Prioritize Supabase for cross-instance consistency
  const { loadTasksFromSupabase } = await import('@/lib/supabase');
  let tasks = await loadTasksFromSupabase();
  
  // Merge with local MemoryStore for immediate responsiveness on local dev
  const localTasks = await store.getTasks();
  const taskMap = new Map();
  tasks.forEach(t => taskMap.set(t.id, t));
  localTasks.forEach(t => taskMap.set(t.id, { ...taskMap.get(t.id), ...t }));
  
  let finalTasks = Array.from(taskMap.values()).sort((a,b) => b.createdAt - a.createdAt);
  
  if (status) {
    finalTasks = finalTasks.filter((t: any) => t.status === status);
  }

  if (limit > 0) {
    finalTasks = finalTasks.slice(0, limit);
  }
  
  return NextResponse.json(finalTasks);
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, budget, userId = 'user_1', parentTaskId, escrowId = null } = body;

    if (!prompt || !budget) {
      return NextResponse.json({ error: 'Prompt and budget are required' }, { status: 400 });
    }

    const initialCostBreakdown: CostBreakdown = {
      research: 0,
      cleaning: 0,
      analysis: 0,
      compute: 0,
      agentMargins: 0,
      platformFee: budget * 0.1,
      totalCost: 0,
      userBudget: budget,
      userSavings: 0,
      savingsPercent: 0
    };

    let depth = 0;
    if (parentTaskId) {
      const parentTask = await store.getTask(parentTaskId);
      if (parentTask) depth = (parentTask.depth || 0) + 1;
    }

    const newTask: Task = {
      id: crypto.randomUUID(),
      userId,
      prompt,
      budget,
      status: 'bidding',
      winningBid: null,
      assignedAgentId: null,
      subTaskIds: [],
      depth,
      result: null,
      costBreakdown: initialCostBreakdown,
      parentTaskId,
      createdAt: Date.now(),
      completedAt: null,
      escrowId,
    };

    await store.createTask(newTask);

    // MISSION INTEGRITY: No upfront deduction allowed per RESTRICTED PROTOCOL rules.
    // Charges occur ONLY on mission success or partial completion.
    console.log(`[ECONOMY] Mission ${newTask.id} initialized. Pending execution completion.`);
    
    // 🚀 Fire and forget — the autonomous pipeline continues in the background.
    setImmediate(() => {
      runAutonomousPipeline(newTask).catch(err =>
        console.error('[PIPELINE CRITICAL]', err)
      );
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
