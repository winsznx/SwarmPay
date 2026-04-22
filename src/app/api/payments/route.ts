import { store } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET() {
  // Get all payment intents, sorted by newest first, limited to 50 for the feed
  const payments = Array.from((store as any).payments?.values() || [])
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
    .slice(0, 50);
    
  return NextResponse.json(payments);
}
