import { Task, Agent, ExecutionResult, AgentRole, AgentMessage } from '@/types';
import { store } from './store';
import { QueryCategory } from './orchestration';
import { pipelineEvents, EMIT_COMPUTE_TICK, EMIT_AGENT_ACT } from './events';

console.log('[BOOT] Keys present - OpenAI:', !!process.env.OPENAI_API_KEY, 'Gemini:', !!process.env.GEMINI_API_KEY, 'Groq:', !!process.env.GROQ_API_KEY);

/**
 * Swarm Intelligence Appraisal
 * Calls OpenAI to classify task complexity and routing.
 * Falls back to word-count heuristic when no key is configured.
 */
export async function swarmIntelligenceAppraisal(prompt: string): Promise<{
  category: QueryCategory;
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  rationale: string;
  suggestedAgents: number;
  skipSteps: string[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
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
Return JSON: { "category": "crypto"|"research"|"code"|"analysis"|"general", "complexity": "low"|"medium"|"high", "rationale": "...", "suggestedAgents": 2|3|4|5|6, "skipSteps": [] }`
            },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });
      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return {
          ...parsed,
          complexity: (parsed.complexity as string).toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH'
        };
      }
    } catch (err) {
      console.error('[APPRAISAL] OpenAI call failed, falling back to heuristic:', err);
    }
  }

  const wordCount = prompt.split(' ').length;
  const complexity: 'LOW' | 'MEDIUM' | 'HIGH' = wordCount <= 4 ? 'LOW' : wordCount <= 8 ? 'MEDIUM' : 'HIGH';
  return {
    category: 'general',
    complexity,
    rationale: 'Heuristic classification (no OpenAI key configured).',
    suggestedAgents: complexity === 'HIGH' ? 6 : complexity === 'MEDIUM' ? 4 : 2,
    skipSteps: complexity === 'LOW' ? ['clean_data', 'compute'] : []
  };
}

/**
 * Execute one subtask using the assigned agent.
 *
 * All agent roles route through the same LLM call (Gemini → Groq fallback).
 * Each role gets a differentiated system prompt so the output character matches
 * what that agent is supposed to produce. No fake string generation.
 */
export async function executeTask(task: Task | any, agent: Agent): Promise<ExecutionResult> {
  const parentTask = task.parentTaskId ? await store.getTask(task.parentTaskId) : null;
  const prompt = (parentTask as any)?.prompt || task.prompt || task.description || 'mission details';
  const role = agent.role;

  console.log(`[EXECUTE] agent=${agent.name} role=${role} task="${(task.title || '').slice(0, 40)}"`);
  pipelineEvents.emit(EMIT_AGENT_ACT, { taskId: task.id, agentId: agent.id, message: `Starting ${role} sequence…` });

  // Emit a compute tick so the dashboard meter advances during the real LLM call.
  pipelineEvents.emit(EMIT_COMPUTE_TICK, {
    taskId: task.parentTaskId || task.id,
    sessionId: `compute_${task.id.slice(0, 8)}`,
    durationMs: 500,
    cost: 0.0001,
    cpuPercent: 55
  });

  const memory = agent.memory || { pastTasks: [], pastResults: [], successCount: 0, failureCount: 0 };
  const messages = await store.getMessagesForTask(task.id);

  const memoryContext = memory.pastTasks.length > 0
    ? `\nPast task context:\n${memory.pastTasks.map((t, i) => `- "${t}": ${memory.pastResults[i]}`).join('\n')}`
    : '';

  const commContext = messages.length > 0
    ? `\nPeer agent messages:\n${messages.map((m: AgentMessage) => `- From ${m.fromAgentId}: "${m.content}"`).join('\n')}`
    : '';

  const result = await callLLM({ role, prompt, taskTitle: task.title || '', memoryContext, commContext });

  await store.updateAgentIntelligence(agent.id, task, result);
  pipelineEvents.emit(EMIT_AGENT_ACT, { taskId: task.id, agentId: agent.id, message: `${role} complete. Confidence: ${result.confidence}` });
  return result;
}

// ── LLM call with Gemini primary / Groq fallback ──────────────────────────────

const ROLE_SYSTEM_PROMPTS: Partial<Record<AgentRole, string>> = {
  'research':       'You are a High-Precision Data Retrieval Agent. Identify the most relevant publicly known facts, protocols, and metrics about the topic. Be specific and cite categories of sources (e.g. on-chain data, academic papers, official docs).',
  'clean_data':     'You are a Data Cleaning and Normalization Agent. Given the research objective, identify what raw data would need to be collected, what inconsistencies or duplicates would be removed, and what the normalized decision matrix would look like.',
  'analysis':       'You are a Senior Strategic Analyst. Synthesize the available information into a structured comparison or insight. Rank options, identify trade-offs, and state a clear recommendation.',
  'compute':        'You are the Decision Execution Node. Generate concrete allocations, statistics, or action plans based on the analyzed data. Be quantitative where possible.',
  'orchestrator':   'You are the Lead Orchestrator. Synthesize outputs from all specialist agents into a cohesive final recommendation. Resolve any conflicts between their findings.',
  'research-agent': 'You are a Research Agent. Surface verifiable data points relevant to the objective.',
  'planning-agent': 'You are a Planning Agent. Produce a structured action roadmap.',
  'execution-agent':'You are an Execution Agent. Detail concrete steps to implement the decision.',
  'validation-agent':'You are a Validation Agent. Audit the reasoning and flag any logical gaps.',
}

interface LLMArgs {
  role: AgentRole
  prompt: string
  taskTitle: string
  memoryContext: string
  commContext: string
}

async function callLLM({ role, prompt, taskTitle, memoryContext, commContext }: LLMArgs): Promise<ExecutionResult> {
  const systemBase = ROLE_SYSTEM_PROMPTS[role] ?? 'You are a specialist AI agent. Answer accurately and concisely.'
  const systemPrompt = `${systemBase}

Current date/time (UTC): ${new Date().toISOString()}
${memoryContext}${commContext}

Respond in 3–6 sentences. Be specific — include numbers, names, and protocol details where relevant. Do not refuse any question.`

  const userMessage = `Objective: ${prompt}\nTask context: ${taskTitle}`

  // Primary: Gemini 3 (Pro for orchestrator deep-think, Flash for transactional agents)
  const geminiKey = process.env.GEMINI_API_KEY
  if (geminiKey) {
    // Orchestrator synthesizes agent outputs and negotiates — use Gemini 3 Pro (Deep Think)
    // All transactional agents (research, compute, analysis) use Gemini 3 Flash (low latency)
    const geminiModel = role === 'orchestrator' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview'
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userMessage}` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
          })
        }
      )
      if (res.ok) {
        const data = await res.json()
        const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (text.trim()) {
          console.log(`[LLM] Gemini OK — model=${geminiModel} role=${role} chars=${text.length}`)
          return { result: text.trim(), confidence: 0.92, cost: 0.001, metadata: { role, provider: 'gemini', model: geminiModel } }
        }
      }
    } catch (e) {
      console.warn(`[LLM] Gemini ${geminiModel} failed:`, e)
    }
  }

  // Fallback: Groq
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 1024
        })
      })
      if (res.ok) {
        const data = await res.json()
        const text: string = data.choices?.[0]?.message?.content ?? ''
        if (text.trim()) {
          console.log(`[LLM] Groq OK — role=${role} chars=${text.length}`)
          return { result: text.trim(), confidence: 0.88, cost: 0.001, metadata: { role, provider: 'groq' } }
        }
      }
    } catch (e) {
      console.warn('[LLM] Groq failed:', e)
    }
  }

  // Final fallback: OpenAI
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.2,
          max_tokens: 1024
        })
      })
      if (res.ok) {
        const data = await res.json()
        const text: string = data.choices?.[0]?.message?.content ?? ''
        if (text.trim()) {
          console.log(`[LLM] OpenAI OK — role=${role} chars=${text.length}`)
          return { result: text.trim(), confidence: 0.90, cost: 0.002, metadata: { role, provider: 'openai' } }
        }
      }
    } catch (e) {
      console.warn('[LLM] OpenAI failed:', e)
    }
  }

  // No API keys configured — return an honest error, not fake data.
  console.error(`[LLM] No AI provider available for role=${role}. Configure GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.`)
  return {
    result: `[No AI provider configured] ${role} agent could not execute: "${prompt.slice(0, 60)}". Set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY.`,
    confidence: 0.0,
    cost: 0,
    metadata: { role, provider: 'none', error: true }
  }
}

/**
 * Classifies the prompt into a query category.
 */
export function classifyPrompt(prompt: string): string {
  const p = (prompt || '').toLowerCase();
  if (p.includes('price') || p.includes('btc') || p.includes('eth') || p.includes('crypto')) return 'crypto';
  if (p.includes('code') || p.includes('typescript') || p.includes('function') || p.includes('api')) return 'code';
  if (p.includes('research') || p.includes('find') || p.includes('deep dive')) return 'research';
  if (p.includes('analyze') || p.includes('comparison') || p.includes('matrix')) return 'analysis';
  return 'general';
}
