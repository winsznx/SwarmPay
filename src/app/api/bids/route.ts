import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Bid } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, agentId, price, strategy, estimatedTimeMs = 45000 } = body;

    if (!taskId || !agentId || !price || !strategy) {
      return NextResponse.json({ error: 'Missing required bid fields' }, { status: 400 });
    }

    const task = await store.getTask(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status !== 'bidding') {
      return NextResponse.json({ error: 'Task is not open for bidding' }, { status: 400 });
    }

    const newBid: Bid = {
      id: crypto.randomUUID(),
      taskId,
      agentId,
      agentName: agentId, // Fallback to ID if name not provided
      amount: parseFloat(price),
      price: parseFloat(price),
      estimatedTimeMs,
      latency: estimatedTimeMs / 1000,
      reputation: 90, // Default for manual bids
      confidence: 0.95,
      strategy,
      submittedAt: Date.now(),
    };

    await store.addBid(newBid);

    return NextResponse.json(newBid, { status: 201 });
  } catch (error) {
    console.error('Error creating bid:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
