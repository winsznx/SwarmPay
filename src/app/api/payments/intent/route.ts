import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const limit = parseInt(searchParams.get('limit') || '50');

  const payments = taskId ? await store.getPaymentsForTask(taskId) : await store.getPaymentsForTask('');
  
  return NextResponse.json(payments.slice(0, limit));
}

// Support for manual intent creation if needed via REST
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fromAgentId, fromAgentName, toAgentId, toAgentName, taskId, amount } = body;
        
        const intent = await store.createPaymentIntent({
            fromAgentId,
            fromAgentName,
            toAgentId,
            toAgentName,
            taskId,
            amount,
            currency: 'USDC'
        });
        
        return NextResponse.json(intent);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
    }
}
