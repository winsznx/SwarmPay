import { Task, SubTask, Agent } from '@/types';
import { store } from './store';

export type QueryCategory = 'crypto' | 'research' | 'code' | 'analysis' | 'general';
const MAX_DEPTH = 3;
const FIXED_SUBTASKS = [
  { type: 'fetch_data',  label: 'Data Retrieval',      description: 'Fetch and retrieve relevant data from distributed sources' },
  { type: 'clean_data',  label: 'Data Normalization',   description: 'Clean, deduplicate and normalize retrieved data' },
  { type: 'analyze',     label: 'Intelligence Analysis', description: 'Analyze data and generate insights' },
  { type: 'compute',     label: 'Statistical Compute',  description: 'Run statistical models and compute confidence scores' },
];

/**
 * Advanced Orchestration Engine
 * Enforces exactly 4 fixed sub-tasks for every mission.
 */
export async function decomposeTask(
  task: Task | SubTask, 
  depth: number = 0, 
  assignedAgentId?: string
): Promise<SubTask[]> {
  const currentDepth = (task as any).depth || depth;
  const prompt = (task as any).prompt || (task as any).description;

  if (currentDepth >= MAX_DEPTH) {
    return [];
  }

  console.log(`🧠 [ORCHESTRATION] Deploying Fixed 4-Node Swarm for: "${prompt.substring(0, 40)}..."`);

  const parentBudget = (task as any).budget || 0;
  const subTaskBudget = parentBudget > 0 ? (parentBudget * 0.9) / FIXED_SUBTASKS.length : 0.01; 

  const subTasks: SubTask[] = FIXED_SUBTASKS.map((st) => {
    return {
      id: crypto.randomUUID(),
      parentTaskId: task.id,
      parentAgentId: assignedAgentId || (task as any).assignedAgentId || 'system',
      type: st.type,
      title: st.label,
      description: st.description,
      budget: subTaskBudget,
      status: 'pending',
      depth: currentDepth + 1,
      createdAt: Date.now()
    };
  });

  return subTasks;
}

/**
 * Complexity Heuristic
 * Determines if a task needs further decomposition.
 */
export function isTaskComplex(task: Task | SubTask): boolean {
  const prompt = (task as any).prompt || (task as any).description || '';
  const keywords = ['decentralized', 'marketplace', 'architect', 'complex', 'optimize', 'system'];
  
  const hasKeywords = keywords.some(k => prompt.toLowerCase().includes(k));
  const isLong = prompt.length > 100;

  return hasKeywords || isLong;
}

/**
 * Initializes sub-marketplace for any task level.
 */
export async function initializeSubMarket(taskId: string): Promise<void> {
  const subTasks = await store.getSubTasks(taskId);
  for (const st of subTasks) {
    await store.updateSubTask(st.id, { status: 'bidding' });
  }
}
