import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { decomposeTask, initializeSubMarket } from '@/lib/orchestration';

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

    if (task.status !== 'assigned') {
      return NextResponse.json({ 
        error: `Invalid status: ${task.status}. Task must be 'assigned' to decompose.` 
      }, { status: 400 });
    }

    // 1. Perform Decomposition (now async)
    const subTasks = await decomposeTask(task);
    
    // 2. Clear existing sub-tasks if any (though there shouldn't be)
    // and save the new blueprint.
    for (const st of subTasks) {
      await store.createSubTask(st);
    }

    // 3. Initialize the sub-market for bidding
    await initializeSubMarket(task.id);

    // 4. Update parent task status to 'executing'
    await store.updateTask(task.id, { status: 'executing' });

    return NextResponse.json({
      message: 'Decomposition complete. Execution started.',
      subTasks
    });
  } catch (err: any) {
    console.error('Decomposition failed:', err);
    return NextResponse.json({ error: err.message || 'Operation failed' }, { status: 400 });
  }
}
