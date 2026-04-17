import { Task, SubTask, Agent } from '@/types';
import { store } from './store';

const MAX_DEPTH = 3;
const BLUEPRINT = ["Research", "Planning", "Execution", "Validation"];

/**
 * Advanced Orchestration Engine
 * Supports depth 3 recursion and complexity-based triggers.
 */
export async function decomposeTask(
  task: Task | SubTask, 
  depth: number = 0, 
  assignedAgentId?: string
): Promise<SubTask[]> {
  const currentDepth = (task as any).depth ?? depth;
  const prompt = (task as any).prompt || (task as any).description;

  if (currentDepth >= MAX_DEPTH) {
    console.log(`[ORCHESTRATION] Max depth ${MAX_DEPTH} reached for "${prompt.substring(0, 20)}..."`);
    return [];
  }

  console.log(`🧠 [ORCHESTRATION] Decomposing at depth ${currentDepth}: "${prompt.substring(0, 40)}..."`);

  let descriptions: string[] = [];

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'your_key_here') throw new Error('No API Key');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Decompose this task into 4 distinct phases: Research, Planning, Execution, and Validation. 
            Return JSON with "descriptions" array.`
          },
          { role: 'user', content: `Task: "${prompt}"` }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    descriptions = parsed.descriptions;

  } catch (err) {
    descriptions = BLUEPRINT.map(title => `Fallback: Process ${title} for "${prompt.substring(0, 20)}..."`);
  }

  const parentBudget = (task as any).budget || 0;
  const subTaskBudget = parentBudget > 0 ? parentBudget / 5 : 0.01; // Simple split

  const subTasks: SubTask[] = BLUEPRINT.map((title, index) => {
    return {
      id: crypto.randomUUID(),
      parentTaskId: task.id,
      parentAgentId: assignedAgentId || (task as any).assignedAgentId || 'system',
      title,
      description: descriptions[index] || `Process ${title}`,
      budget: subTaskBudget,
      status: 'bidding',
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
export function initializeSubMarket(taskId: string): void {
  const subTasks = store.getSubTasks(taskId);
  subTasks.forEach(st => {
    store.updateSubTask(st.id, { status: 'bidding' });
  });
}
