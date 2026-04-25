import { NextResponse } from 'next/server';
import { getGlobalStats } from '@/lib/supabase';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = await getGlobalStats();
  const agents = await store.getAgents();

  // Local-dev fallback: without Supabase credentials getGlobalStats returns zeros. Back-fill
  // from the in-memory store so landing counters animate to real numbers during `next dev`.
  const memoryTasks = await store.getTasks();
  const memoryCompleted = memoryTasks.filter((t: any) => t.status === 'completed');
  const memoryUsdc = memoryCompleted.reduce((acc: number, t: any) => {
    return acc + (t.settlement?.totalAmount ?? t.costBreakdown?.totalCost ?? 0);
  }, 0);
  const memoryPaymentCount = store.getAllPayments().length;

  return NextResponse.json({
    completedTasks: stats.completedTasks || memoryCompleted.length,
    totalMicropayments: stats.totalMicropayments || memoryPaymentCount,
    totalAgents: agents.length,
    totalUsdcMoved: stats.totalUsdcMoved || memoryUsdc,
    avgGas: stats.avgGas
  });
}
