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
  if ((global as any).wss) {
    return;
  }

  console.log('[WS] Initializing WebSocket server on port 3006...');
  const wss = new WebSocketServer({ port: 3006 });
  (global as any).wss = wss;

  wss.on('connection', (ws, req) => {
    const { query } = parse(req.url || '', true);
    const taskId = query.taskId as string;
    
    (ws as any).taskId = taskId;
    console.log(`[CONN] [WS] Client connected. Filtering by Task: ${taskId || 'all'}`);

    ws.on('error', console.error);
    ws.on('close', () => console.log('[DISC] [WS] Client disconnected.'));
  });

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
      broadcastToTask(taskId, { type: evt.type, ...payload });
    });
  });
}

function broadcastToTask(taskId: string, data: any) {
  const server = (global as any).wss as WebSocketServer;
  if (!server) return;

  const msg = JSON.stringify(data);
  server.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      const clientTaskId = (client as any).taskId;
      if (!clientTaskId || clientTaskId === taskId) {
        client.send(msg);
      }
    }
  });
}
