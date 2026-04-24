import { NextResponse } from 'next/server';
import { getGlobalStats } from '@/lib/supabase';
import { store } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = await getGlobalStats();
  const agents = await store.getAgents();
  
  return NextResponse.json({
    ...stats,
    activeAgents: agents.length
  });
}
