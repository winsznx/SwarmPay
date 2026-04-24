import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Task persistence helpers
export async function saveTaskToSupabase(task: any) {
  if (!task) return;
  try {
    const { error } = await supabase.from('tasks').upsert({
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
  if (!payment) return;
  try {
    const { error } = await supabase.from('payment_intents').upsert({
      id: payment.id,
      task_id: payment.taskId,
      from_agent_id: payment.fromAgentId ?? null,
      from_agent_name: payment.fromAgent ?? null,
      to_agent_id: payment.toAgentId ?? null,
      to_agent_name: payment.toAgent ?? null,
      amount: payment.amount,
      status: 'completed',
      created_at: new Date(payment.timestamp ?? Date.now()).toISOString()
    }, { onConflict: 'id' })
    if (error) console.error('[SUPABASE] payment save error:', error.message)
  } catch (e) {
    console.error('[SUPABASE] payment save failed:', e)
  }
}

export async function loadTasksFromSupabase(): Promise<any[]> {
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
