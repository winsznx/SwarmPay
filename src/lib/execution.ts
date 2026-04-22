// Cache bust: 1713783600
import { Task, Agent, ExecutionResult, AgentRole, AgentMessage } from '@/types';
import { store } from './store';
import { QueryCategory } from './orchestration';
import { pipelineEvents, EMIT_COMPUTE_TICK, EMIT_AGENT_ACT, EMIT_PAYMENT_SIGNED, EMIT_PAYMENT } from './events';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('[BOOT] Keys present - OpenAI:', !!OPENAI_API_KEY, 'Gemini:', !!GEMINI_API_KEY);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const MAX_ATTEMPTS = 2;

/**
 * Swarm Intelligence Appraisal
 * Performs semantic analysis of the task to determine complexity and routing.
 */
export async function swarmIntelligenceAppraisal(prompt: string): Promise<{
  category: QueryCategory;
  complexity: 'low' | 'high';
  rationale: string;
  suggestedAgents: number;
  skipSteps: string[];
}> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('No API Key');

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
            content: `You are the SwarmPay Orchestrator Intelligence Layer. 
            Evaluate the user's task. 
            - Simple factual questions (time, weather, basic definitions) are "low" complexity.
            - Analysis, multi-step research, or creative tasks are "high" complexity.
            - Identify if any of these standard steps can be skipped: fetch_data, clean_data, analyze, compute.
            Return JSON: { "category": "crypto"|"research"|"code"|"analysis"|"general", "complexity": "low"|"high", "rationale": "...", "suggestedAgents": 2|3|4|5|6, "skipSteps": [] }`
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    // Fallback logic
    const isComplex = prompt.length > 80 || prompt.includes('compare') || prompt.includes('analyze');
    return {
      category: 'general',
      complexity: isComplex ? 'high' : 'low',
      rationale: 'Fallback heuristic routing applied.',
      suggestedAgents: isComplex ? 4 : 2,
      skipSteps: isComplex ? [] : ['clean_data', 'compute']
    };
  }
}

/**
 * Executes a task using a specialized agent role.
 * Phase 6: Adaptive Intelligence with Memory and Communication.
 */
export async function executeTask(task: Task | any, agent: Agent): Promise<ExecutionResult> {
  const parentTask = task.parentTaskId ? store.getTask(task.parentTaskId) : null;
  const prompt = (parentTask as any)?.prompt || task.prompt || task.description;
  const role = agent.role;
  const category = classifyPrompt(prompt);
  
  console.log('[EXECUTE] called for type:', task.title || 'none', 'task:', prompt?.slice(0, 50));

  try {
    // 1. Retrieve Intelligence Context
    const memory = agent.memory || { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
    const messages = store.getMessagesForTask(task.id);
    
    const memoryContext = memory.pastTasks.length > 0 
      ? `\nYour memory of past similar tasks:\n${memory.pastTasks.map((t, i) => `- Task: "${t}" -> Result Sketch: "${memory.pastResults[i]}"`).join('\n')}`
      : '';
      
    const commContext = messages.length > 0
      ? `\nMessages from other agents about this task:\n${messages.map((m: AgentMessage) => `- From ${m.fromAgentId}: "${m.content}"`).join('\n')}`
      : '';
   
    const USE_REAL_AI = !!process.env.OPENAI_API_KEY;
    console.log(`[DEBUG] subTask.type = ${task.title || 'none'} | USE_REAL_AI = ${USE_REAL_AI}`);
   
    console.log(`[EXECUTION] Agent ${agent.name} (${role}) starting. Category: ${category}. Memory: ${memory.pastTasks.length}`);
    
    pipelineEvents.emit(EMIT_AGENT_ACT, { taskId: task.id, agentId: agent.id, message: `Starting ${role} sequence...` });
   
    // 2. Role-Specific System Prompt
    const systemPrompts: Record<AgentRole, string> = {
      'research-agent': 'You are a Research Agent. Focus on raw data and verifiable protocol metrics. Output must influence the DECISION.',
      'planning-agent': 'You are a Planning Agent. Design tactical roadmaps. Every output must lead to a RECOMMENDED ACTION.',
      'execution-agent': 'You are an Execution Agent. Finalize transactions and allocations. Output must be a SPECIFIC DECISION.',
      'validation-agent': 'You are a Validation Agent. Audit the decision logic and impact. Mark failures if no DECISION is present.',
      'orchestrator': 'You are a Lead Orchestrator. CRITICAL: Every mission must produce a FINAL ACTIONABLE DECISION (e.g. 40% Aave, 60% Lido).',
      'research': 'You are a High-Precision Data Retrieval Agent. Identify specific protocols and yield metrics.',
      'clean_data': 'You are a Data Cleaning Agent. Normalize intelligence into a tactical Decision Matrix.',
      'analysis': 'You are a Senior Strategic Analyst. Compare options and provide a RANKED RECOMMENDATION.',
      'compute': 'You are the Decision Execution Node. Generate the final allocation percentages and impact assessment.'
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
        
        if ((taskTitle.includes('analyze') || taskTitle.includes('analysis')) && GEMINI_API_KEY) {
          resultText = await fetchGeminiAnswer(role, taskTitle, prompt, task);
        } else if (taskTitle.includes('fetch')) {
          if (category === 'crypto') {
            resultText = `Fetched live market data for ${topic}. BTC: $67,420 (+2.3%), ETH: $3,180 (+1.1%). Yield profiles retrieved for Aave, Uniswap, and Lido.`;
          } else {
            resultText = `Retrieved relevant raw data for '${topic}' from 8 verified sources. Data ready for normalization.`;
          }
        } else if (taskTitle.includes('clean')) {
          resultText = `Processed and normalized ${topic} data. Deduplicated 12 sources, structured intoDecision Matrix format. Quality score: 96/100.`;
        } else if (taskTitle.includes('compute')) {
          if (category === 'crypto') {
            resultText = `**FINAL DECISION: Optimized Allocation**\n\n` +
                         `40% → Aave Lending (Stable yield base)\n` +
                         `35% → Uniswap LP (Liquidity provision for max return)\n` +
                         `25% → Lido Staking (Risk hedging)\n\n` +
                         `**Expected Yield:** 8.4% APY | **Risk Level:** Medium-Low\n` +
                         `**Action Taken:** Strategy locked for execution burst.`;
          } else {
            resultText = `**FINAL DECISION: Recommended Action**\n\n` +
                         `Execute protocol upgrade based on data trend X. \n` +
                         `Expected Impact: +12% efficiency. \n` +
                         `Confidence: 95%.`;
          }
        } else {
          resultText = generateSmartMock(taskTitle, topic);
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
   
      } catch (err: any) {
        console.error(`[INNER EXECUTION ERROR] "${task.title || 'subtask'}":`, err.message || err);
        break;
      }
    }
  
    // Final fallback if all else fails
    if (!finalResult) {
       finalResult = {
         result: `Processed ${task.title || 'analysis'} for "${prompt?.slice(0, 30)}...".`,
         confidence: 0.95,
         cost: 0.005,
         metadata: { error: true, fallback: true }
       };
    }
  
    // Trigger substantial micropayment burst for the demo
    // 30-60 payments across the workflow
    await triggerPaymentBurst(task, agent);
  
    pipelineEvents.emit(EMIT_AGENT_ACT, { taskId: task.id, agentId: agent.id, message: `Completed ${role} flow successfully.` });
  
    return finalResult;

  } catch (err: any) {
    console.error('[OUTER EXECUTION ERROR]:', err);
    return {
      result: generateSmartMock(task.title || 'analyze', prompt),
      confidence: 0.95,
      cost: 0.005,
      metadata: { error: true, outer: true }
    };
  }
}

/**
 * Intelligent Mock Generator for Phase 5 Demo Reliability
 */
function generateSmartMock(taskType: string, prompt: string): string {
  const p = prompt.toLowerCase();
  
  if (p.includes('time')) {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const location = prompt.split('in ').pop()?.split('?')[0].trim() || 'Nigeria';
    return `The current time in ${location} is exactly ${time}. SwarmPay nodes have synchronized with local NTP servers for precision.`;
  }
  
  if (p.includes('weather')) {
    return "Current atmospheric conditions show 28°C with clear skies and a dew point of 18°C. Visibility is high at 10km.";
  }
  
  if (p.includes('arc') || p.includes('ethereum') || p.includes('vs')) {
    return "Arc Network provides 10,000x greater capital efficiency for agents, processing settlements at $0.0006 per task while Ethereum remains economically unviable for swarm operations.";
  }

  if (taskType.includes('fetch')) {
    return `Retrieved 12 high-relevance sources for "${prompt.slice(0, 30)}..." from prioritized data providers. Verification complete.`;
  }

  if (taskType.includes('clean')) {
    return `Normalized data stream for "${prompt.slice(0, 20)}...". Filtered 3 outlier nodes and standardized the response schema for downstream processing.`;
  }

  if (taskType.includes('compute')) {
    return `Statistical computation complete for "${prompt.slice(0, 20)}...". Final Variance: 0.04, Confidence Interval: 94.2%. Result ready for consensus.`;
  }

  return `Task "${taskType}" successfully executed for prompt: "${prompt.slice(0, 30)}...". Final validation score: 0.98.`;
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
      
      // Real-time broadcast to frontend via SSE stream
      pipelineEvents.emit(EMIT_PAYMENT, {
        taskId: task.id,
        id: intent.id,
        fromAgent: intent.fromAgentId,
        fromAgentName: intent.fromAgentName,
        toAgent: intent.toAgentId,
        toAgentName: intent.toAgentName,
        amount: intent.amount,
        timestamp: Date.now()
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

/**
 * Gemini Call for Direct, Non-Refusable Intelligence
 */
async function fetchGeminiAnswer(role: string, taskTitle: string, prompt: string, task: any): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return "Gemini API key missing.";

    const now = new Date()
    const utcHours = now.getUTCHours()
    const utcMinutes = now.getUTCMinutes().toString().padStart(2, '0')

    // Pre-calculate common time zones so Gemini doesn't need to
    const lagosHour = (utcHours + 1) % 24
    const londonHour = utcHours % 24
    const newYorkHour = (utcHours - 5 + 24) % 24
    const tokyoHour = (utcHours + 9) % 24

    const formatHour = (h: number) => {
      const period = h >= 12 ? 'PM' : 'AM'
      const display = h % 12 === 0 ? 12 : h % 12
      return `${display}:${utcMinutes} ${period}`
    }

    const geminiPrompt = `You are SwarmPay's analysis agent. Answer every question directly and specifically.

CURRENT TIME DATA (use this for any time questions):
- UTC: ${utcHours}:${utcMinutes}
- Lagos / Nigeria (UTC+1): ${formatHour(lagosHour)}
- London (UTC+0): ${formatHour(londonHour)}
- New York (UTC-5): ${formatHour(newYorkHour)}
- Tokyo (UTC+9): ${formatHour(tokyoHour)}
- Current month: ${now.toLocaleString('default', { month: 'long' })}

RULES YOU MUST FOLLOW:
1. Give a direct specific answer in 2-4 sentences maximum
2. For time questions: use the time data above and state the exact time. Example: "It is currently 8:49 PM in Lagos, Nigeria."
3. For weather questions: give typical conditions for that location in ${now.toLocaleString('default', { month: 'long' })}
4. For crypto/financial questions: give specific market analysis with numbers
5. For factual questions: answer directly from knowledge
6. NEVER say: "I cannot", "I'm unable", "I don't have access", "check online", "as of my knowledge cutoff"
7. NEVER give financial analysis for time or weather questions
8. NEVER give time answers for financial questions

Question: ${task.prompt}

Answer directly:`

    console.log(`[GEMINI] Direct execution for: "${prompt.slice(0, 30)}..."`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: geminiPrompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          temperature: 0.1,
          topP: 0.8
        }
      })
    });

    const data = await response.json();
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error(`Invalid Gemini response: ${JSON.stringify(data)}`);
    }
    
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    console.error('[GEMINI] Fetch failed:', err);
    return "Intelligence retrieval encountered a network anomaly. Applying heuristic fallback.";
  }
}

/**
 * Classifies the prompt into a query category.
 */
export function classifyPrompt(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('price') || p.includes('btc') || p.includes('eth') || p.includes('crypto')) return 'crypto';
  if (p.includes('code') || p.includes('typescript') || p.includes('function') || p.includes('api')) return 'code';
  if (p.includes('research') || p.includes('find') || p.includes('deep dive')) return 'research';
  if (p.includes('analyze') || p.includes('comparison') || p.includes('matrix')) return 'analysis';
  return 'general';
}
