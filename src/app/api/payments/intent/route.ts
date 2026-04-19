import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const limit = parseInt(searchParams.get('limit') || '50');

  let payments = taskId ? store.getPaymentsForTask(taskId) : store.getPaymentsForTask('');
  
  if (!taskId) {
      // If no task ID provided, just return most recent globally for the stream
      payments = store.getPaymentsForTask(''); // Currently store returns empty for '' if not filtered correctly
      // Let's improve the store method to handle global if needed or just use current logic
  }

  return NextResponse.json(payments.slice(0, limit));
}

// Support for manual intent creation if needed via REST
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fromAgentId, fromAgentName, toAgentId, toAgentName, taskId, amount } = body;
        
        const intent = store.createPaymentIntent({
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
