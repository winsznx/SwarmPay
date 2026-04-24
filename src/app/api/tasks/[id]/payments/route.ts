import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { loadPaymentsFromSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Try Memory Store first (for live/local dev)
    let payments = await store.getPaymentsForTask(id);
    
    // 2. If empty or on Vercel, fallback to Supabase
    if (!payments || payments.length === 0) {
      payments = await loadPaymentsFromSupabase(id);
    }
    
    return NextResponse.json(payments, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
