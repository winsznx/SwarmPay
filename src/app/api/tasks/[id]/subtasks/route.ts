import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { fetchSubtasksFromSupabase } from '@/lib/supabase';
import { SubTask } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const memSubtasks = await store.getSubTasks(id);

    if (memSubtasks.length > 0) {
      const subTasksWithBids = await Promise.all(
        memSubtasks.map(async (st: SubTask) => ({
          ...st,
          bids: await store.getSubBids(st.id)
        }))
      );
      return NextResponse.json(subTasksWithBids);
    }

    const dbSubtasks = await fetchSubtasksFromSupabase(id);
    return NextResponse.json(dbSubtasks);
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
