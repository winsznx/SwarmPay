import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET() {
  const balance = store.getUserWallet();
  return NextResponse.json({ balance });
}
