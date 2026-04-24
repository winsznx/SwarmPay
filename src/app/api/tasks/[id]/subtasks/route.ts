import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { SubTask } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const subTasks = await store.getSubTasks(id);
    
    // Enrich with sub-bids asynchronously
    const subTasksWithBids = await Promise.all(subTasks.map(async (st: SubTask) => ({
      ...st,
      bids: await store.getSubBids(st.id)
    })));

    return NextResponse.json(subTasksWithBids);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
