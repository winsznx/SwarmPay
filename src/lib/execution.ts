// Cache bust
import { Task, Agent, ExecutionResult, AgentRole, AgentMessage } from '@/types';
import { store } from './store';
import { pipelineEvents, EMIT_COMPUTE_TICK, EMIT_AGENT_ACT, EMIT_PAYMENT_SIGNED } from './events';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const MAX_ATTEMPTS = 2;

export type QueryCategory = 'crypto' | 'research' | 'code' | 'analysis' | 'general';

export function classifyPrompt(prompt: string): QueryCategory {
  const p = prompt.toLowerCase();
  if (/bitcoin|ethereum|crypto|defi|token|blockchain|layer.?[0-9]|sol\b|btc|eth\b|nft|web3|usdc|wallet/.test(p)) return 'crypto';
  if (/explain|what is|how does|define|overview|tell me about/.test(p)) return 'research';
  if (/build|create|implement|code|develop|write a|make a/.test(p)) return 'code';
  if (/analyze|compare|evaluate|assess|review|best|top/.test(p)) return 'analysis';
  return 'general';
}

/**
 * Executes a task using a specialized agent role.
 * Phase 6: Adaptive Intelligence with Memory and Communication.
 */
export async function executeTask(task: Task | any, agent: Agent): Promise<ExecutionResult> {
  const prompt = task.prompt || task.description;
  const role = agent.role;
  const category = classifyPrompt(prompt);
  
  // 1. Retrieve Intelligence Context
  const memory = agent.memory || { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
  const messages = store.getMessagesForTask(task.id);
  
  const memoryContext = memory.pastTasks.length > 0 
    ? `\nYour memory of past similar tasks:\n${memory.pastTasks.map((t, i) => `- Task: "${t}" -> Result Sketch: "${memory.pastResults[i]}"`).join('\n')}`
    : '';
    
  const commContext = messages.length > 0
    ? `\nMessages from other agents about this task:\n${messages.map(m => `- From ${m.fromAgentId}: "${m.content}"`).join('\n')}`
    : '';
 
  console.log(`[EXECUTION] Agent ${agent.name} (${role}) starting. Category: ${category}. Memory: ${memory.pastTasks.length}`);
  
  pipelineEvents.emit(EMIT_AGENT_ACT, { taskId: task.id, agentId: agent.id, message: `Starting ${role} sequence...` });
 
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
      // User explicitly requested to simulate all results and avoid real API calls
      // to ensure the demo is reliable and doesn't fail due to missing keys or network issues.
 
      await delay(Math.random() * 500 + 500); // Simulate processing time
 
      // Emit compute ticks during processing
      pipelineEvents.emit(EMIT_COMPUTE_TICK, {
        taskId: task.parentTaskId || task.id,
        sessionId: `compute_${task.id.slice(0, 4)}`,
        durationMs: 500,
        cost: 0.0001,
        cpuPercent: 15 + Math.random() * 20
      });
 
      let resultText = '';
      const taskTitle = (task as any).title?.toLowerCase() || '';
      const parentTask = (task as any).parentTaskId ? store.getTask((task as any).parentTaskId) : null;
      const topicSource = (parentTask as any)?.prompt || prompt || 'the request';
      
      // Smarter keyword extraction with stopwords
      const stopwords = ['analyze','get','find','show','what','is','the','a','an',
        'me','top','best','latest','give','explain','describe','how','why','for'];
      const keywords = topicSource.toLowerCase().split(' ')
        .filter((w: string) => !stopwords.includes(w) && w.length > 2);
      const topic = keywords.slice(0, 3).join(' ') || topicSource.slice(0, 20);
      
      if (taskTitle.includes('fetch')) {
        if (category === 'crypto') {
          resultText = `Fetched live data for ${topic}:\nBTC: $67,420 (+2.3% 24h), ETH: $3,180 (+1.1%), SOL: $142 (+4.7%),\nBNB: $412 (-0.8%), MATIC: $0.89 (+3.2%). Volume: $84B. Dominance: BTC 52.1%`;
        } else if (category === 'research') {
          resultText = `Retrieved 12 sources for '${topic}': Wikipedia, academic papers, news articles. Relevance score: 94%`;
        } else if (category === 'code') {
          resultText = `Fetched documentation for '${topic}': MDN, GitHub repos (4), Stack Overflow threads (7). API specs loaded.`;
        } else if (category === 'analysis') {
          resultText = `Gathered comparison data for '${topic}': 5 data sources, 23 metrics collected, 3 time periods.`;
        } else {
          resultText = `Retrieved relevant information for '${topic}' from 8 sources. Confidence: 91%`;
        }
      } else if (taskTitle.includes('clean')) {
        if (category === 'crypto') {
          resultText = `Normalized data for ${topic}. Removed 12 outlier spikes. Imstandardized timestamps. Formatted to standard JSON. Data quality score: 94/100.`;
        } else if (category === 'research') {
          resultText = `Deduplicated 12 sources → 9 unique. Extracted key claims. Removed paywalled content. Structured: 3 sections.`;
        } else if (category === 'code') {
          resultText = `Parsed documentation. Extracted 14 code examples. Removed deprecated APIs. Normalized to TypeScript types.`;
        } else if (category === 'analysis') {
          resultText = `Normalized 23 metrics across 5 sources. Removed 2 outliers. Standardized units. Data quality: 96/100.`;
        } else {
          resultText = `Processed retrieved data. Removed duplicates, structured into 4 categories. Quality score: 93/100.`;
        }
      } else if (taskTitle.includes('analyze')) {
        if (category === 'crypto') {
          resultText = `Top opportunities for ${topic}:\n1. ${topic.toUpperCase()} showing strong momentum indicators.\n2. Key support levels holding above psychological resistance.\n3. Bullish divergence detected on 4h timeframe. Risk level: Medium. Confidence: 87%`;
        } else if (category === 'research') {
          resultText = `Summary for '${topic}':\n1. Primary investigation reveals significant adoption of ${topic}\n2. Main consensus across sources agrees on core principles\n3. Notable debate: implementation vs theory\nConfidence: 89%`;
        } else if (category === 'code') {
          resultText = `Architecture recommendation for '${topic}':\n1. Use modular component structure\n2. Implement error boundaries and validation\n3. Suggested stack: TypeScript + tested framework\nComplexity: Medium`;
        } else if (category === 'analysis') {
          resultText = `Comparative analysis for '${topic}':\n1. Option A leads on performance metrics (+34%)\n2. Option B stronger on cost efficiency\n3. Recommendation: hybrid approach\nConfidence: 91%`;
        } else {
          resultText = `Agent findings for '${topic}':\n1. Primary insight based on retrieved data\n2. Secondary pattern identified\n3. Recommended next step\nConfidence: 88%`;
        }
      } else if (taskTitle.includes('compute')) {
        if (category === 'crypto') {
          resultText = `Correlation matrix computed for ${topic}. BTC/ETH: 0.91, ${topic}/USD: 0.74.\nSharpe ratio (7d): 1.43. Volatility index: 23.4. Processing: 8,247ms.`;
        } else if (category === 'research') {
          resultText = `Semantic similarity computed. Source agreement: 78%. Contradiction index: 0.12. Readability score: 67. Processing: 3,421ms.`;
        } else if (category === 'code') {
          resultText = `Complexity analysis complete. Cyclomatic complexity: 4. Estimated LOC: 180. Test coverage target: 85%. Processing: 2,847ms.`;
        } else if (category === 'analysis') {
          resultText = `Statistical model complete. R²: 0.91. P-value: 0.003. Margin of error: ±2.4%. Processing: 5,123ms.`;
        } else {
          resultText = `Computation complete. Confidence interval: 94%. Processing time: 4,201ms. Result quality score: 88/100.`;
        }
      } else {
        resultText = `[${role.toUpperCase()}] Result for ${topic}... Task completed successfully with ${agent.name}.`;
      }

      finalResult = {
        result: resultText,
        confidence: attempt === 1 ? 0.65 : 0.92, // Force one retry for the log, then succeed
        cost: 0.005,
        metadata: { role, agentId: agent.id, attempt }
      };

      console.log(`[ATTEMPT ${attempt}] Confidence: ${finalResult.confidence}`);

      // SUCCESS THRESHOLD
      if (finalResult && finalResult.confidence >= 0.70) {
        break;
      }

      attempt++;
      if (attempt <= MAX_ATTEMPTS) {
        console.log(`[RETRY] Low confidence detected. Retrying with refinement...`);
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

  // Trigger substantial micropayment burst for the demo
  // 30-60 payments across the workflow
  await triggerPaymentBurst(task, agent);

  pipelineEvents.emit(EMIT_AGENT_ACT, { taskId: task.id, agentId: agent.id, message: `Completed ${role} flow successfully.` });

  return finalResult;
}

/**
 * Triggers a burst of micropayments to simulate agent-to-agent activity.
 */
async function triggerPaymentBurst(task: any, agent: Agent) {
  const subAgents = [
    { name: "Researcher-Alpha", id: "agent_r1" },
    { name: "Parser-X", id: "agent_p1" },
    { name: "Analysis-Node", id: "agent_a1" },
    { name: "Compute-Grid-4", id: "agent_c1" }
  ];

  const paymentCount = Math.floor(Math.random() * 8) + 8; // 8-15 payments per sub-task
  for (let i = 0; i < paymentCount; i++) {
      const subAgent = subAgents[Math.floor(Math.random() * subAgents.length)];
      const intent = store.createPaymentIntent({
          fromAgentId: agent.id,
          fromAgentName: agent.name,
          toAgentId: subAgent.id,
          toAgentName: subAgent.name,
          taskId: task.id,
          amount: 0.0001 * (Math.random() * 5 + 1),
          currency: 'USDC'
      });
      
      // Simulate cryptographic signing delay and broadcast
      await new Promise(r => setTimeout(r, 40));
      pipelineEvents.emit(EMIT_PAYMENT_SIGNED, { taskId: task.id, paymentId: intent.id });
      // Tiny variability in timing to make the feed look alive
      await new Promise(r => setTimeout(r, Math.random() * 100 + 50));
  }
  // Simulation pause
  await new Promise(r => setTimeout(r, 400));
}
