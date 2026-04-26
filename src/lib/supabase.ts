import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Server-side privileged client. Used by the settlement queue, escrow RPCs,
// reputation RPCs — anywhere we need to bypass RLS on the server. NEVER ship
// this to the browser. Falls back to the anon client if the service key is
// not configured (dev), which means RLS-permissive policies still allow it.
export const supabaseAdmin: SupabaseClient | null = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : supabase

// Task persistence helpers — writes go through supabaseAdmin so RLS doesn't
// reject server-side mutations. Reads stay on the anon client below.
export async function saveTaskToSupabase(task: any) {
  if (!task || !supabaseAdmin) return;
  try {
    const { error } = await supabaseAdmin.from('tasks').upsert({
      id: task.id,
      prompt: task.prompt,
      budget: task.budget,
      status: task.status,
      result: task.result ?? null,
      cost_breakdown: task.costBreakdown ?? null,
      stats: task.stats ?? null,
      settlement: task.settlement ?? null,
      micropayment_count: task.micropaymentCount ?? 0,
      created_at: new Date(task.createdAt).toISOString(),
      completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
      execution_valid: task.status === 'completed',
      winning_bid_id: task.winningBidId ?? null
    }, { onConflict: 'id' })
    if (error) console.error('[SUPABASE] task save error:', error.message)
  } catch (e) {
    console.error('[SUPABASE] task save failed:', e)
  }
}

export async function savePaymentToSupabase(payment: any) {
  if (!payment || !supabaseAdmin) return;
  try {
    // Base fields always present (migration 001 columns).
    // Crypto audit fields (nonce, signature, signer_address) are only included
    // when non-null — they require migration 010. Omitting them when null prevents
    // Supabase from rejecting the entire insert if 010 hasn't been applied yet.
    const row: Record<string, unknown> = {
      id: payment.id,
      task_id: payment.taskId,
      from_agent_id: payment.fromAgentId ?? null,
      from_agent_name: payment.fromAgent ?? null,
      to_agent_id: payment.toAgentId ?? null,
      to_agent_name: payment.toAgent ?? null,
      amount: payment.amount,
      status: payment.status ?? 'pending',
      created_at: new Date(payment.timestamp ?? Date.now()).toISOString(),
    }
    if (payment.nonce)        row.nonce         = payment.nonce
    if (payment.signature)    row.signature     = payment.signature
    if (payment.signerAddress) row.signer_address = payment.signerAddress

    const { error } = await supabaseAdmin.from('payment_intents').upsert(row, { onConflict: 'id' })
    if (error) console.error('[SUPABASE] payment save error:', error.message)
  } catch (e) {
    console.error('[SUPABASE] payment save failed:', e)
  }
}

export async function loadTasksFromSupabase(): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .not('prompt', 'is', null)
      .neq('prompt', '')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[SUPABASE] load tasks error:', error.message)
      return []
    }
    return (data ?? []).map(row => ({
      id: row.id,
      prompt: row.prompt,
      budget: parseFloat(row.budget || '0'),
      status: row.status,
      result: row.result,
      costBreakdown: row.cost_breakdown,
      stats: row.stats,
      settlement: row.settlement,
      micropaymentCount: row.micropayment_count ?? 0,
      createdAt: new Date(row.created_at).getTime(),
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
      winningBidId: row.winning_bid_id,
      subTasks: []
    }))
  } catch (e) {
    console.error('[SUPABASE] load tasks failed:', e)
    return []
  }
}

export async function loadPaymentsFromSupabase(taskId: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    if (error) return []
    return (data ?? []).map(row => ({
      id: row.id,
      taskId: row.task_id,
      fromAgent: row.from_agent_name ?? row.from_agent_id ?? 'Agent',
      toAgent: row.to_agent_name ?? row.to_agent_id ?? 'Node',
      amount: parseFloat(row.amount || '0'),
      timestamp: new Date(row.created_at).getTime()
    }))
  } catch (e) {
    return []
  }
}

export async function getGlobalStats() {
  const empty = { completedTasks: 0, totalUsdcMoved: 0, totalMicropayments: 0, avgGas: 0.0006 };
  if (!supabase) return empty;
  try {
    const [{ data: tasks, error: tErr }, { count: paymentCount, error: pErr }] = await Promise.all([
      supabase
        .from('tasks')
        .select('status, settlement, cost_breakdown, micropayment_count')
        .eq('status', 'completed'),
      supabase
        .from('payment_intents')
        .select('id', { count: 'exact', head: true })
    ]);

    if (tErr) throw tErr;

    const completedTasks = tasks?.length ?? 0;
    const totalUsdcMoved = tasks?.reduce((acc: number, t: any) => {
      const settledAmt = t.settlement?.totalAmount || t.cost_breakdown?.totalCost || 0;
      return acc + settledAmt;
    }, 0) ?? 0;

    // Prefer real payment_intents row count; fall back to per-task counter sum if the query errored.
    const totalMicropayments = pErr
      ? (tasks?.reduce((acc: number, t: any) => acc + (t.micropayment_count ?? 0), 0) ?? 0)
      : (paymentCount ?? 0);

    return {
      completedTasks,
      totalUsdcMoved,
      totalMicropayments,
      avgGas: 0.0006
    };
  } catch (e) {
    return empty;
  }
}

export async function fetchTaskFromSupabase(id: string): Promise<any | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return null;
    return {
      id: data.id,
      prompt: data.prompt,
      budget: parseFloat(data.budget || '0'),
      status: data.status,
      result: data.result,
      costBreakdown: data.cost_breakdown,
      stats: data.stats,
      settlement: data.settlement,
      micropaymentCount: data.micropayment_count ?? 0,
      createdAt: new Date(data.created_at).getTime(),
      completedAt: data.completed_at ? new Date(data.completed_at).getTime() : undefined,
      winningBidId: data.winning_bid_id,
      winningAgentName: data.winning_agent_name,
      subTaskIds: []
    };
  } catch (e) {
    return null;
  }
}

export async function fetchSubtasksFromSupabase(taskId: string): Promise<any[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('subtasks')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data.map(row => ({
      id: row.id,
      taskId: row.task_id,
      type: row.type,
      title: row.title,
      description: row.description,
      budget: parseFloat(row.budget || '0'),
      status: row.status,
      assignedAgentId: row.assigned_agent_id,
      winningAgentName: row.winning_agent_name,
      result: row.result,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      completedAt: row.completed_at ? new Date(row.completed_at).getTime() : undefined,
    }));
  } catch (e) {
    return [];
  }
}

// ── Phase B: Advanced Persistence ──────────────────────────────────────────

export async function saveSubTaskToSupabase(st: any) {
  if (!st || !supabaseAdmin) return;
 
  try {
    const { error } = await supabaseAdmin.from('subtasks').upsert({
      id: st.id,
      task_id: taskId,
      type: st.type,
      title: st.title,
      description: st.description,
      budget: st.budget,
      status: st.status,
      assigned_agent_id: st.assignedAgentId,
      winning_agent_name: st.winningAgentName,
      result: st.result,
      execution_valid: st.status === 'completed',
      created_at: st.createdAt ? new Date(st.createdAt).toISOString() : new Date().toISOString(),
      completed_at: st.completedAt ? new Date(st.completedAt).toISOString() : null
    }, { onConflict: 'id' });
    if (error) console.error('[SUPABASE] subtask error:', error.message);
  } catch (e) {}
}

export async function logTaskEvent(taskId: string, eventType: string, payload: any = {}) {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('task_events').insert({
      task_id: taskId,
      event_type: eventType,
      payload
    });
  } catch (e) {}
}

export async function saveSettlementToSupabase(taskId: string, settlement: any) {
  if (!settlement || !supabaseAdmin) return;
  try {
    await supabaseAdmin.from('settlements').upsert({
      task_id: taskId,
      tx_hash: settlement.txHash,
      explorer_url: settlement.explorerUrl,
      intents_settled: settlement.intentsSettled,
      total_amount: settlement.totalAmount,
      gas_cost: settlement.gasCost,
      status: 'confirmed',
      confirmed_at: new Date().toISOString()
    });
  } catch (e) {}
}
