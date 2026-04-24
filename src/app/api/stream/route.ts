import { NextRequest } from 'next/server';
import { pipelineEvents, EMIT_PAYMENT, EMIT_TASK_DONE, EMIT_SUBTASK_DONE, EMIT_SUBTASK_START, EMIT_AGENT_ACT } from '@/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might be closed
        }
      };

      // Event handlers
      const handlePayment = (p: any) => {
        if (!taskId || taskId === 'global' || p.taskId === taskId) send({ type: 'payment:intent', ...p });
      };
      const handleTaskDone = (t: any) => {
        if (!taskId || t.taskId === taskId) send({ type: 'task:completed', ...t });
      };
      const handleSubTaskStart = (s: any) => {
        if (!taskId || s.taskId === taskId) send({ type: 'subtask:started', ...s });
      };
      const handleSubTaskDone = (s: any) => {
        if (!taskId || s.taskId === taskId) send({ type: 'subtask:completed', ...s });
      };
      const handleAgentAct = (a: any) => {
        if (!taskId || a.taskId === taskId) send({ type: 'agent:activity', ...a });
      };

      // Attach listeners
      pipelineEvents.on(EMIT_PAYMENT, handlePayment);
      pipelineEvents.on(EMIT_TASK_DONE, handleTaskDone);
      pipelineEvents.on(EMIT_SUBTASK_START, handleSubTaskStart);
      pipelineEvents.on(EMIT_SUBTASK_DONE, handleSubTaskDone);
      pipelineEvents.on(EMIT_AGENT_ACT, handleAgentAct);

      // Heartbeat to keep connection alive on Vercel
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup
      req.signal.addEventListener('abort', () => {
        pipelineEvents.off(EMIT_PAYMENT, handlePayment);
        pipelineEvents.off(EMIT_TASK_DONE, handleTaskDone);
        pipelineEvents.off(EMIT_SUBTASK_START, handleSubTaskStart);
        pipelineEvents.off(EMIT_SUBTASK_DONE, handleSubTaskDone);
        pipelineEvents.off(EMIT_AGENT_ACT, handleAgentAct);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch (e) {}
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
