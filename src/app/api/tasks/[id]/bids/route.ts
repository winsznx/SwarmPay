import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Bid, Agent } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bids = store.getBidsForTask(id);
  
  // Also get agent names for the UI to display
  const bidsWithAgentInfo = bids.map((bid: Bid) => {
    const agent = store.getAgents().find((a: Agent) => a.id === bid.agentId);
    return {
      ...bid,
      agentName: agent ? agent.name : 'Unknown Agent'
    };
  });

  return NextResponse.json(bidsWithAgentInfo);
}
