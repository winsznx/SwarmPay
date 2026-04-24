import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabase) return NextResponse.json([]);
  
  try {
    const { data, error } = await supabase
      .from('payment_intents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
      
    if (error) throw error;
    
    return NextResponse.json((data || []).map(row => ({
      id: row.id,
      taskId: row.task_id,
      fromAgent: row.from_agent_name || 'Agent',
      toAgent: row.to_agent_name || 'Node',
      amount: parseFloat(row.amount || '0'),
      timestamp: new Date(row.created_at).getTime()
    })));
  } catch (e) {
    return NextResponse.json([]);
  }
}
