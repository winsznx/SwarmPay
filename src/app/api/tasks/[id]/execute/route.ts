import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { executeTask } from '@/lib/execution';
import { decomposeTask, isTaskComplex, initializeSubMarket } from '@/lib/orchestration';
import { Task, SubTask, Agent } from '@/types';

const DEMO_MODE = true;
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Autonomous Execution Pipeline
 * Assignment -> Execution -> Result -> Payment -> Potential Recursion
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = store.getTask(id);

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.status !== 'assigned') return NextResponse.json({ error: 'Task must be assigned to execute.' }, { status: 400 });

    const agent = store.getAgents().find((a: Agent) => a.id === task.assignedAgentId);
    if (!agent) return NextResponse.json({ error: 'Assigned agent not found.' }, { status: 400 });

    // 1. Recursive Check - Should this task be decomposed BEFORE execution?
    const hasSubTasks = ((task as any).subTaskIds?.length || 0) > 0;
    const taskPrompt = (task as any).prompt || (task as any).description || '';

    if (isTaskComplex(task) && task.depth < 3 && !hasSubTasks) {
      console.log(`[PIPELINE] Task "${taskPrompt.substring(0, 20)}" is complex. Decomposing...`);
      store.updateTask(task.id, { status: 'executing' }); // Mark parent as executing
      const subTasks = await decomposeTask(task);
      subTasks.forEach(st => store.createSubTask(st));
      initializeSubMarket(task.id);
      
      return NextResponse.json({ 
         message: 'Task was too complex. Decomposed into sub-tasks.',
         decomposed: true 
      });
    }

    // 2. Execute Task
    store.updateTask(task.id, { status: 'executing' });
    if (DEMO_MODE) await delay(1200); // Process Storytelling
    const result = await executeTask(task, agent);

    // 3. Evolve Intelligence & Store Result
    if (DEMO_MODE) await delay(800);
    
    // Phase 6: Automatic Evolution
    store.updateAgentIntelligence(agent.id, task, result);

    store.updateTask(task.id, { 
      result, 
      status: result.confidence >= 0.7 ? 'completed' : 'failed',
      completedAt: Date.now()
    });

    const reward = (task as any).budget || store.calculateBudgetHeuristic((task as any).prompt || (task as any).description);
    store.distributePayment(agent.id, reward);

    // Phase 6: Inter-Agent Communication (Message Hand-off)
    const isSubTask = !!(task as any).parentTaskId;
    const parentId = isSubTask ? (task as any).parentTaskId : task.id;
    const subTasks = store.getSubTasks(parentId);
    
    subTasks.forEach((st: SubTask) => {
      if (st.id !== id) {
        store.addMessage({
          id: Math.random().toString(36).substring(7),
          fromAgentId: agent.name,
          toAgentId: 'network', 
          taskId: st.id,
          content: `Node "${(task as any).title || 'Previous'}" results: ${result.result.slice(0, 100)}...`,
          createdAt: Date.now()
        });
      }
    });

    return NextResponse.json({
      message: result.confidence >= 0.7 ? 'Execution complete.' : 'Execution failed - insufficient confidence.',
      result,
      payment: reward,
      reputationUpdate: result.confidence >= 0.7 ? +1 : -1
    });

  } catch (err: any) {
    console.error('[PIPELINE-ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
