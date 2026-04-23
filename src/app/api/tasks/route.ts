import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Task, CostBreakdown } from '@/types';
import { runAutonomousPipeline } from '@/lib/pipeline';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '0');
  
  let tasks = store.getTasks();
  
  if (status) {
    tasks = tasks.filter((t: any) => t.status === status);
  }

  
  if (limit > 0) {
    tasks = tasks.slice(0, limit);
  }
  
  return NextResponse.json(tasks);
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, budget, userId = 'user_1', parentTaskId } = body;

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

    const newTask: Task = {
      id: crypto.randomUUID(),
      userId,
      prompt,
      budget,
      status: 'bidding',
      winningBid: null,
      assignedAgentId: null,
      subTaskIds: [],
      depth: 0,
      result: null,
      costBreakdown: initialCostBreakdown,
      parentTaskId,
      createdAt: Date.now(),
      completedAt: null,
    };

    store.createTask(newTask);

    // DEDUCT budget from the USER'S wallet (not the lead agent)
    const currentWallet = store.getUserWallet();
    store.updateUserWallet(currentWallet - budget);
    console.log(`[ECONOMY] User paid $${budget.toFixed(2)} for mission initialization. Balance: $${(currentWallet - budget).toFixed(2)}`);
    
    // 🎲 Initialize the market war SYNCHRONOUSLY 
    // This ensures real bids exist before the UI first polls.
    const { runInitialBiddingWar } = await import('@/lib/pipeline');
    await runInitialBiddingWar(newTask);
    
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
