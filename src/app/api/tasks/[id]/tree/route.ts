import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Task, SubTask, Agent } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const nodes: any[] = [];
    const edges: any[] = [];
    const visited = new Set<string>();

    const traverse = async (taskId: string) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = await store.getTask(taskId);
      if (!task) return;

      const agents = await store.getAgents();
      const agent = task.assignedAgentId ? agents.find((a: Agent) => a.id === task.assignedAgentId) : null;
      const messages = await store.getMessagesForTask(task.id);

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
      for (const sid of sids) {
        const childTask = await store.getTask(sid);
        edges.push({
          id: `e-${task.id}-${sid}`,
          source: task.id,
          target: sid,
          animated: task.status === 'executing' || childTask?.status === 'executing',
          style: { stroke: '#475569', strokeWidth: 2 },
        });
        await traverse(sid);
      }
    };

    const rootTask = await store.getTask(id);
    if (!rootTask) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    await traverse(id);

    return NextResponse.json({ nodes, edges });
  } catch (err: any) {
    console.error('Tree API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
