import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Task, SubTask } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rootTask = store.getTask(id);

    if (!rootTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const nodes: any[] = [];
    const edges: any[] = [];
    const visited = new Set<string>();

    const traverse = (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = store.getTask(taskId);
      if (!task) return;

      const agent = task.assignedAgentId ? store.getAgents().find(a => a.id === task.assignedAgentId) : null;
      const messages = store.getMessagesForTask(task.id);

      // Create Node
      nodes.push({
        id: task.id,
        type: 'taskNode',
        data: {
          label: (task as any).title || (task as any).prompt,
          status: task.status,
          budget: (task as any).budget || 0,
          assignedAgentId: (task as any).assignedAgentId,
          depth: (task as any).depth || 0,
          result: (task as any).result,
          agentMemory: agent?.memory,
          messagesReceived: messages
        },
        position: { x: 0, y: 0 }, // Positioned by Dagre in frontend
      });

      // Handle Edges and Children
      const sids = (task as any).subTaskIds || [];
      sids.forEach((sid: string) => {
        edges.push({
          id: `e-${task.id}-${sid}`,
          source: task.id,
          target: sid,
          animated: (task as any).status === 'executing' || (store.getTask(sid) as any)?.status === 'executing',
          style: { stroke: '#475569', strokeWidth: 2 },
        });
        traverse(sid);
      });
    };

    traverse(id);

    return NextResponse.json({ nodes, edges });
  } catch (err: any) {
    console.error('Tree API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
