import { Task, Agent, ExecutionResult, AgentRole, AgentMessage } from '@/types';
import { store } from './store';

const MAX_ATTEMPTS = 2;

/**
 * Executes a task using a specialized agent role.
 * Phase 6: Adaptive Intelligence with Memory and Communication.
 */
export async function executeTask(task: Task | any, agent: Agent): Promise<ExecutionResult> {
  const prompt = task.prompt || task.description;
  const role = agent.role;
  
  // 1. Retrieve Intelligence Context
  const memory = agent.memory || { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
  const messages = store.getMessagesForTask(task.id);
  
  const memoryContext = memory.pastTasks.length > 0 
    ? `\nYour memory of past similar tasks:\n${memory.pastTasks.map((t, i) => `- Task: "${t}" -> Result Sketch: "${memory.pastResults[i]}"`).join('\n')}`
    : '';
    
  const commContext = messages.length > 0
    ? `\nMessages from other agents about this task:\n${messages.map(m => `- From ${m.fromAgentId}: "${m.content}"`).join('\n')}`
    : '';

  console.log(`[EXECUTION] Agent ${agent.name} (${role}) starting. Memory: ${memory.pastTasks.length}, Messages: ${messages.length}`);

  // 2. Role-Specific System Prompt
  const systemPrompts: Record<AgentRole, string> = {
    'research-agent': 'You are a Research Agent. Your goal is to gather key insights and background knowledge.',
    'planning-agent': 'You are a Planning Agent. Design roadmaps and logic based on research inputs.',
    'execution-agent': 'You are an Execution Agent. Perform technical compute actions and produce concrete outputs.',
    'validation-agent': 'You are a Validation Agent. Review quality and ensure requirements are met.',
    'orchestrator': 'You are a Lead Orchestrator. Manage the swarm and ensure quality.'
  };

  const systemContent = systemPrompts[role] || systemPrompts['orchestrator'];
  const baseInstructions = `${systemContent} Return a JSON object with "result" (string), "confidence" (number 0-1), and "cost" (number).`;

  let attempt = 1;
  let finalResult: ExecutionResult | null = null;

  while (attempt <= MAX_ATTEMPTS) {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      const isSimulated = !apiKey || apiKey === 'your_key_here';

      if (isSimulated) {
        // Fallback Simulation for Dev/Demo
        console.log(`[EXECUTION-SIM] Agent ${agent.name} Attempt ${attempt}`);
        const result = `[${role.toUpperCase()}] Result for: ${prompt.slice(0, 30)}... using ${messages.length} messages.`;
        finalResult = {
          result,
          confidence: attempt === 1 ? 0.65 : 0.88, // Force retry simulation
          cost: 0.001,
          metadata: { role, agentId: agent.id, attempt }
        };
      } else {
        const retryInstruction = attempt > 1 ? "\nIMPORTANT: Your previous attempt had low confidence. Please refine, clarify, and improve your technical depth." : "";
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: baseInstructions + retryInstruction },
              { role: 'user', content: `Context:${memoryContext}${commContext}\n\nTask: "${prompt}"` }
            ],
            response_format: { type: 'json_object' }
          })
        });

        const data = await response.json();
        const content = JSON.parse(data.choices[0].message.content);
        
        finalResult = {
          result: content.result,
          confidence: content.confidence,
          cost: content.cost || 0.005,
          metadata: { role, agentId: agent.id, attempt }
        };
      }

      console.log(`[ATTEMPT ${attempt}] Confidence: ${finalResult?.confidence}`);

      // SUCCESS THRESHOLD
      if (finalResult && finalResult.confidence >= 0.70) {
        break;
      }

      attempt++;
      if (attempt <= MAX_ATTEMPTS) {
        console.log(`🔄 [RETRY] Low confidence detected. Retrying with refinement...`);
      }

    } catch (err) {
      console.error('Execution Error:', err);
      break;
    }
  }

  // Final fallback if all else fails
  if (!finalResult) {
     return {
       result: "Agent reached execution timeout or error.",
       confidence: 0,
       cost: 0,
       metadata: { error: true }
     };
  }

  return finalResult;
}
