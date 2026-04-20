import { WebSocketServer, WebSocket } from 'ws';
import { 
  pipelineEvents, 
  EMIT_PAYMENT, 
  EMIT_PAYMENT_SIGNED,
  EMIT_SUBTASK_START, 
  EMIT_SUBTASK_DONE, 
  EMIT_COMPUTE_TICK, 
  EMIT_TASK_DONE, 
  EMIT_AGENT_ACT 
} from './events';
import { parse } from 'url';


export function startWsServer() {
  if (process.env.VERCEL) {
    console.log('[WS] Running on Vercel: Skipping WebSocket server initialization.');
    return;
  }
  
  if ((global as any).wss) return; // already started

  console.log('[WS] Initializing WebSocket server on port 3006...');
  try {
    const wss = new WebSocketServer({ port: 3006 });
    (global as any).wss = wss;

    console.log('[WS] Server started on port 3006');
    
    wss.on('connection', (ws, req) => {
      const { query } = parse(req.url || '', true);
      const taskId = query.taskId as string;
      (ws as any).taskId = taskId;
      
      console.log('[WS] Client connected');
      ws.on('error', console.error);
      ws.on('close', () => console.log('[WS] Client disconnected'));
    });
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.warn('[WS] Port 3006 already in use.');
    } else {
      console.error('[WS] Critical initialization error:', err.message);
    }
  }

  // Bridge internal event bus to WebSocket broadcast
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

export function broadcastEvent(taskId: string, event: object) {
  const message = JSON.stringify({ taskId, ...event });
  console.log('[WS] broadcasting:', message.slice(0, 100));
  
  const server = (global as any).wss as WebSocketServer;
  if (!server) return;

  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}
