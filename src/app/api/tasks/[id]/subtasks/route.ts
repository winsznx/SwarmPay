import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { SubTask } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const subTasks = store.getSubTasks(id);
    
    // Enrich with sub-bids
    const subTasksWithBids = subTasks.map((st: SubTask) => ({
      ...st,
      bids: store.getSubBids(st.id)
    }));

    return NextResponse.json(subTasksWithBids);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
