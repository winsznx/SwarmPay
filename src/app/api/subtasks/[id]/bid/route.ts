import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: subTaskId } = await params;
    const body = await request.json();
    const { agentId, price, estimatedTimeMs } = body;

    if (!agentId || price === undefined || !estimatedTimeMs) {
      return NextResponse.json({ error: 'Missing required bid fields' }, { status: 400 });
    }

    // Verify sub-task exists
    const subTask = await store.getTask(subTaskId); 
    if (!subTask) {
        return NextResponse.json({ error: 'Sub-task not found' }, { status: 404 });
    }
    
    const bidId = crypto.randomUUID();
    await store.addBid({
      id: bidId,
      subTaskId,
      agentId,
      price,
      estimatedTimeMs,
      createdAt: Date.now()
    } as any);

    return NextResponse.json({ message: 'Sub-bid submitted', bidId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Bid failed' }, { status: 400 });
  }
}
