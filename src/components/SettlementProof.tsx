'use client'

import React, { useEffect, useState } from 'react'
import { Task } from '@/types'
import { Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface SettlementRow {
  task_id: string
  expected_count: number
  confirmed_count: number
  failed_count: number
  all_hashes: string[]
  total_gas_cost: number | null
  total_amount: number | null
  status: 'pending' | 'in_progress' | 'complete' | 'partial' | 'failed'
}

// Live settlement summary card. Reads from the `settlements` row via Supabase
// Realtime so confirmed_count / total_gas_cost / all_hashes update without a
// page refresh. Falls back to task.settlement snapshot if the row hasn't
// landed yet (e.g. mock mode without Circle keys).
export function SettlementProof({ task }: { task: Task }) {
  const [row, setRow] = useState<SettlementRow | null>(null)

  useEffect(() => {
    if (!task?.id || !supabase) return
    let active = true

    void (async () => {
      const { data } = await supabase
        .from('settlements')
        .select('task_id, expected_count, confirmed_count, failed_count, all_hashes, total_gas_cost, total_amount, status')
        .eq('task_id', task.id)
        .maybeSingle()
      if (active && data) setRow(data as SettlementRow)
    })()

    const channel = supabase
      .channel(`settlements:${task.id}:proof`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `task_id=eq.${task.id}` },
        (payload) => {
          if (!active) return
          const next = (payload.new ?? payload.old) as SettlementRow | undefined
          if (next) setRow(next)
        }
      )
      .subscribe()

    return () => {
      active = false
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [task?.id])

  if (!task.settlement && !row) return null

  // Source of truth: live row when available, snapshot fallback otherwise.
  const expected = row?.expected_count ?? task.settlement?.intentsSettled ?? 0
  const confirmed = row?.confirmed_count ?? task.settlement?.allHashes?.length ?? 0
  const failed = row?.failed_count ?? 0
  const allHashes: string[] = row?.all_hashes ?? task.settlement?.allHashes ?? []
  const gas = row?.total_gas_cost
  const totalAmount = row?.total_amount ?? task.settlement?.totalAmount ?? 0
  const status = row?.status ?? 'pending'

  const headerLabel = status === 'complete' ? 'Settled on Arc'
    : status === 'partial' ? 'Partially settled on Arc'
    : status === 'failed' ? 'Settlement failed'
    : status === 'in_progress' ? 'Settling on Arc — live'
    : 'Settlement queued'

  const headerColor = status === 'complete' ? 'text-green-400'
    : status === 'partial' ? 'text-amber-400'
    : status === 'failed' ? 'text-red-400'
    : 'text-blue-400'

  return (
    <div className="border border-green-900/50 rounded-xl p-4 bg-green-950/20 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full animate-pulse ${
          status === 'complete' ? 'bg-green-400'
          : status === 'partial' ? 'bg-amber-400'
          : status === 'failed' ? 'bg-red-400'
          : 'bg-blue-400'
        }`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${headerColor}`}>
          {headerLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500">On-chain settlements</p>
          <p className="text-lg font-bold text-white tabular-nums">
            {confirmed}<span className="text-sm text-gray-500">/{expected}</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total gas (measured)</p>
          <p className="text-lg font-bold text-green-400 tabular-nums">
            {gas != null ? `$${gas.toFixed(6)}` : 'Measuring…'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total settled</p>
          <p className="text-lg font-bold text-white tabular-nums">${totalAmount.toFixed(4)} USDC</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Failed</p>
          <p className={`text-lg font-bold tabular-nums ${failed > 0 ? 'text-red-400' : 'text-white'}`}>
            {failed}
          </p>
        </div>
      </div>

      <div className="border-t border-green-900/30 pt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500">
            {allHashes.length > 0
              ? (allHashes.length === 1 ? `Atomic batch transaction (${expected} micropayments)` : `On-chain transactions (${allHashes.length})`)
              : status === 'failed' ? 'Batch reverted on-chain' : 'Awaiting tx confirmation'}
          </p>
          <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${
            status === 'complete' ? 'bg-green-500/10 text-green-400 border-green-500/20'
            : status === 'failed'  ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : status === 'partial' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
          }`}>
            {status === 'complete' ? 'Verified On-Chain'
             : status === 'failed'  ? 'Settlement Failed'
             : status === 'partial' ? 'Partial Settlement'
             : 'Confirming on Arc'}
          </span>
        </div>
        <div className="space-y-1">
          {allHashes.slice(0, 5).map(h => (
            <a
              key={h}
              href={`https://testnet.arcscan.app/tx/${h}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between text-[11px] font-mono text-blue-400 hover:text-blue-300 group"
            >
              <span className="truncate">{h.slice(0, 10)}…{h.slice(-8)}</span>
              <Activity className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
          {allHashes.length > 5 && (
            <p className="text-[10px] text-gray-600 italic">
              + {allHashes.length - 5} more — view all in the audit panel below
            </p>
          )}
          {allHashes.length === 0 && status !== 'failed' && (
            <p className="text-[10px] text-gray-600 italic">Awaiting first confirmation…</p>
          )}
          {allHashes.length === 0 && status === 'failed' && (
            <p className="text-[10px] text-red-400/80 italic">Batch reverted before landing on-chain — no tx hash to verify. Check vault balance + retry.</p>
          )}
        </div>
      </div>

      <div className="mt-3 p-2 bg-gray-900/50 rounded-lg">
        <p className="text-xs text-gray-500 text-center">
          {status === 'complete'
            ? `${expected} micropayments → 1 atomic Arc tx · ${gas != null ? `$${gas.toFixed(6)} gas` : 'gas measuring'}`
            : status === 'failed'
            ? `Batch of ${expected} reverted — refund issued, vault balances unchanged`
            : `${confirmed} of ${expected} on-chain settlements on Arc · ${gas != null ? `$${gas.toFixed(6)} total gas` : 'gas measuring'}`}
        </p>
      </div>
    </div>
  )
}
