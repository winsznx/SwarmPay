import { store } from '@/lib/store'
import { NextResponse } from 'next/server'

export async function GET() {
  const tasks = store.getAllTasks()
  const completed = tasks.filter((t: any) => t.status === 'completed')
  const payments = store.getAllPayments()

  const totalSettled = completed.reduce((sum: number, t: any) =>
    sum + (t.costBreakdown?.totalCost ?? 0), 0
  )

  return NextResponse.json({
    tasksCompleted: completed.length,
    totalSettled: totalSettled.toFixed(4),
    totalMicropayments: payments.length,
    activeAgents: store.getAgents().filter((a: any) => a.available).length
  })
}
