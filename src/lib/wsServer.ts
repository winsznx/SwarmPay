import { pipelineEvents, EMIT_PAYMENT, EMIT_PAYMENT_SIGNED, EMIT_SUBTASK_START, EMIT_SUBTASK_DONE, EMIT_COMPUTE_TICK, EMIT_TASK_DONE, EMIT_AGENT_ACT } from './events';
import { parse } from 'url';

export async function startWsServer() {
  if (process.env.VERCEL) {
    console.log('[WS] Running on Vercel: Skipping WebSocket server initialization.');
    return;
  }
  
  if ((global as any).wss) return; // already started

  try {
    // Dynamic import to prevent 'ws' from loading in environments that don't support it
    // or as a top-level dependency in serverless functions.
    const { WebSocketServer } = await import('ws');
    
    console.log('[WS] Initializing WebSocket server on port 3006...');
    const wss = new WebSocketServer({ port: 3006 });
    (global as any).wss = wss;

    console.log('[WS] Server started on port 3006');
    
    wss.on('connection', (ws, req) => {
      const { query } = parse(req.url || '', true);
      const taskId = query.taskId as string;
      (ws as any).taskId = taskId;
      
      console.log('[WS] Client connected for task:', taskId);
      ws.on('error', console.error);
    });
  } catch (err: any) {
    console.warn('[WS] Optimization: WebSocket server could not be started:', err.message);
  }

  // Bridge internal event bus to WebSocket broadcast
  setupEventListeners();
}

function setupEventListeners() {
  const mappedEvents = [
    { name: EMIT_PAYMENT,        type: 'payment:intent' },
    { name: EMIT_PAYMENT_SIGNED, type: 'payment:signed' },
    { name: EMIT_SUBTASK_START,  type: 'subtask:started' },
    { name: EMIT_SUBTASK_DONE,   type: 'subtask:completed' },
    { name: EMIT_COMPUTE_TICK,   type: 'compute:tick' },
    { name: EMIT_TASK_DONE,      type: 'task:completed' },
    { name: EMIT_AGENT_ACT,      type: 'agent:activity' }
  ];

  mappedEvents.forEach(evt => {
    pipelineEvents.on(evt.name, (payload: any) => {
      const taskId = payload.taskId || payload.id;
      broadcastEvent(taskId, { type: evt.type, ...payload });
    });
  });
}

export async function broadcastEvent(taskId: string, event: object) {
  const server = (global as any).wss;
  if (!server) return;

  const { WebSocket } = await import('ws');
  const message = JSON.stringify({ taskId, ...event });
  
  server.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN && client.taskId === taskId) {
      client.send(message);
    }
  });
}
