import { NextResponse } from 'next/server';
import { fetchTaskFromSupabase, fetchSubtasksFromSupabase } from '@/lib/supabase';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rootTask = await fetchTaskFromSupabase(id);
    if (!rootTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const subtasks = await fetchSubtasksFromSupabase(id);

    const nodes: unknown[] = [];
    const edges: unknown[] = [];

    nodes.push({
      id: rootTask.id,
      type: 'taskNode',
      data: {
        label: rootTask.prompt,
        status: rootTask.status,
        budget: rootTask.budget,
        depth: 0,
        result: rootTask.result,
        isRoot: true,
      },
      position: { x: 0, y: 0 },
    });

    for (const st of subtasks) {
      nodes.push({
        id: st.id,
        type: 'taskNode',
        data: {
          label: st.title || st.description || st.type,
          status: st.status,
          budget: st.budget,
          depth: 1,
          result: st.result,
          assignedAgentId: st.assignedAgentId,
          winningAgentName: st.winningAgentName,
          type: st.type,
        },
        position: { x: 0, y: 0 },
      });

      edges.push({
        id: `e-${rootTask.id}-${st.id}`,
        source: rootTask.id,
        target: st.id,
        animated: st.status === 'executing' || st.status === 'bidding',
        style: { stroke: '#475569', strokeWidth: 2 },
      });
    }

    return NextResponse.json({ nodes, edges });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[TREE] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
