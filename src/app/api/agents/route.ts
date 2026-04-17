import { NextResponse } from 'next/server';
import { store } from '@/lib/store';
import { Agent, AgentRole } from '@/types';

export async function GET() {
  const agents = store.getAgents();
  return NextResponse.json(agents);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, role, capabilities = [] } = body;

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
    }

    const newAgent: Agent = {
      id: crypto.randomUUID(),
      name,
      role: role as AgentRole,
      capabilities,
      walletAddress: `0x${Math.random().toString(16).slice(2, 42)}`, // Mock Circle wallet
      wallet: 0,
      reputation: 90, // Start with a decent reputation
      totalEarned: 0,
      tasksCompleted: 0,
      avgResponseTimeMs: 0,
    };

    store.addAgent(newAgent);

    return NextResponse.json(newAgent, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
