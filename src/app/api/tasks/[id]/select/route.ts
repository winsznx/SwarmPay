import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const task = await store.getTask(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Race condition / double-selection prevention
    if (task.status !== 'bidding') {
      return NextResponse.json({ 
        error: `Cannot select winner: Task is in '${task.status}' state. Expected 'bidding'.` 
      }, { status: 400 });
    }

    if (task.winningBid) {
      return NextResponse.json({ error: 'Task already has a winning bid assigned' }, { status: 400 });
    }

    const bids = await store.getBidsForTask(id);
    if (bids.length === 0) {
      return NextResponse.json({ error: 'Cannot select winner: No bids submitted' }, { status: 400 });
    }

    try {
      await store.assignWinningBid(id);
      
      const updatedTask = await store.getTask(id);
      const winner = await store.selectWinningBid(id);

      return NextResponse.json({
        message: 'Winner selected successfully',
        task: updatedTask,
        winner: {
          agent: winner.agent.name,
          agentId: winner.agent.id,
          bidId: winner.bid.id,
          price: winner.bid.price,
          score: winner.score.toFixed(4)
        }
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Selection failed' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in selection API:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
