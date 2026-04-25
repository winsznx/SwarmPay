import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { fetchTaskFromSupabase } from '@/lib/supabase';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const memTask = await store.getTask(id);
    if (memTask) return NextResponse.json(memTask);

    const dbTask = await fetchTaskFromSupabase(id);
    if (!dbTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(dbTask);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
