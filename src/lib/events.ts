import { EventEmitter } from 'events';

class AppEventEmitter extends EventEmitter {}

// Global singleton to ensure it's shared across the server-side runtime in dev
// Note: Only define 'pipelineEvents' once here.
export const pipelineEvents = (global as any).appEvents || ( (global as any).appEvents = new AppEventEmitter() );

// PRD Spec events
export const EMIT_PAYMENT        = 'payment:intent';
export const EMIT_PAYMENT_SIGNED = 'payment:signed';
export const EMIT_SUBTASK_START  = 'subtask:started';
export const EMIT_SUBTASK_DONE   = 'subtask:completed';
export const EMIT_COMPUTE_TICK   = 'compute:tick';
export const EMIT_TASK_DONE      = 'task:completed';
export const EMIT_AGENT_ACT      = 'agent:activity';
