'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, Zap, AlertCircle, RotateCcw } from 'lucide-react'
import { Task } from '@/types'
import { supabase } from '@/lib/supabase'

interface SettlementRow {
  task_id: string
  expected_count: number
  confirmed_count: number
  failed_count: number
  all_hashes: string[]
  total_gas_cost: number | null
  status: 'pending' | 'in_progress' | 'complete' | 'partial' | 'failed'
}

interface SettlementAnimationProps {
  task?: Task
}

// Reactive panel: subscribes to the `settlements` row for the current task
// and animates dots green/red as confirmations land. No setTimeout fakery.
export const SettlementAnimation: React.FC<SettlementAnimationProps> = ({ task }) => {
  const [row, setRow] = useState<SettlementRow | null>(null)

  useEffect(() => {
    if (!task?.id || !supabase) return
    let active = true

    // Initial fetch
    void (async () => {
      const { data } = await supabase
        .from('settlements')
        .select('task_id, expected_count, confirmed_count, failed_count, all_hashes, total_gas_cost, status')
        .eq('task_id', task.id)
        .maybeSingle()
      if (active && data) setRow(data as SettlementRow)
    })()

    // Realtime subscription
    const channel = supabase
      .channel(`settlements:${task.id}`)
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

  // Fallback to task.settlement snapshot if Realtime/Supabase unavailable
  const expected = row?.expected_count ?? task?.settlement?.intentsSettled ?? 0
  const confirmed = row?.confirmed_count ?? task?.settlement?.allHashes?.length ?? 0
  const failed = row?.failed_count ?? 0
  const status = row?.status ?? 'pending'
  const allHashes = row?.all_hashes ?? task?.settlement?.allHashes ?? []
  const gas = row?.total_gas_cost

  // Dot grid: one dot per expected intent. State: idle | confirmed | failed.
  const dots = useMemo(() => {
    const arr: Array<{ key: number; state: 'idle' | 'confirmed' | 'failed'; hash?: string }> = []
    for (let i = 0; i < expected; i++) {
      if (i < confirmed) arr.push({ key: i, state: 'confirmed', hash: allHashes[i] })
      else if (i < confirmed + failed) arr.push({ key: i, state: 'failed' })
      else arr.push({ key: i, state: 'idle' })
    }
    return arr
  }, [expected, confirmed, failed, allHashes])

  return (
    <div className="relative w-full overflow-hidden bg-slate-950/80 border border-blue-500/20 rounded-[2.5rem] p-8 min-h-[300px]">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 0)', backgroundSize: '24px 24px' }} />

      <div className="relative flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusBadge status={status} />
            <div>
              <h3 className="text-lg font-black text-white italic tracking-tight">
                {headerText(status, expected)}
              </h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                {confirmed} of {expected} confirmed{failed > 0 ? ` · ${failed} failed` : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Gas (measured)</div>
            <div className="text-sm font-mono font-black text-blue-400 tabular-nums">
              {gas != null ? `$${gas.toFixed(4)}` : 'Measuring…'}
            </div>
          </div>
        </div>

        {/* Batch tx hash banner — prominent on success.
            Vault.settleBatch lands ALL N micropayments in one Arc tx, so
            allHashes is length-1 and that hash is the audit-link. */}
        {status === 'complete' && allHashes[0] && (
          <div className="bg-linear-to-br from-green-500/15 to-emerald-500/5 border border-green-500/30 rounded-2xl p-5">
            <div className="text-[9px] font-black text-green-400 uppercase tracking-[0.3em] mb-2">Atomic batch settlement on Arc</div>
            <div className="font-mono text-[11px] text-white/90 break-all leading-tight mb-3">
              {allHashes[0]}
            </div>
            <div className="text-[10px] font-bold text-slate-400 mb-4">
              {confirmed} micropayments · 1 atomic tx · {gas != null ? `$${gas.toFixed(4)} gas` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://testnet.arcscan.app/tx/${allHashes[0]}?tab=token_transfers`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-green-300 hover:text-white bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 rounded-lg px-3 py-2 transition-all"
              >
                View {confirmed} token transfers&nbsp;↗
              </a>
              <a
                href={`https://testnet.arcscan.app/tx/${allHashes[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-all"
              >
                Tx details
              </a>
              <a
                href={`https://testnet.arcscan.app/tx/${allHashes[0]}?tab=logs`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-all"
              >
                {confirmed} PaymentSettled events
              </a>
            </div>
          </div>
        )}

        {/* Dot grid */}
        <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-1.5">
          {dots.length === 0 ? (
            <div className="col-span-full text-center py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">
              {status === 'pending' ? 'Awaiting intents…' : 'No intents queued'}
            </div>
          ) : dots.map(d => (
            <Dot key={d.key} state={d.state} hash={d.hash} />
          ))}
        </div>

        {/* Footer */}
        <FooterMessage status={status} expected={expected} confirmed={confirmed} failed={failed} />
      </div>
    </div>
  )
}

const Dot: React.FC<{ state: 'idle' | 'confirmed' | 'failed'; hash?: string }> = ({ state, hash }) => {
  const className =
    state === 'confirmed'
      ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] cursor-pointer hover:scale-150 transition-transform'
      : state === 'failed'
      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
      : 'bg-slate-800'
  const dot = (
    <motion.div
      initial={{ scale: 0.4, opacity: 0.6 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 14 }}
      className={`w-3 h-3 rounded-full ${className}`}
    />
  )
  if (state === 'confirmed' && hash) {
    return (
      <a
        href={`https://testnet.arcscan.app/tx/${hash}`}
        target="_blank"
        rel="noopener noreferrer"
        title={hash}
      >
        {dot}
      </a>
    )
  }
  return dot
}

const StatusBadge: React.FC<{ status: SettlementRow['status'] }> = ({ status }) => {
  if (status === 'complete') return (
    <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-500/40 flex items-center justify-center">
      <ShieldCheck className="w-6 h-6 text-green-400" />
    </div>
  )
  if (status === 'failed') return (
    <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
      <AlertCircle className="w-6 h-6 text-red-400" />
    </div>
  )
  if (status === 'partial') return (
    <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
      <AlertCircle className="w-6 h-6 text-amber-400" />
    </div>
  )
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center"
    >
      <Zap className="w-6 h-6 text-blue-400" />
    </motion.div>
  )
}

const headerText = (status: SettlementRow['status'], expected: number): string => {
  switch (status) {
    case 'pending':     return `Queueing ${expected} intents for settlement`
    case 'in_progress': return `Settling on Arc — confirmations landing live`
    case 'complete':    return `Settled on Arc`
    case 'partial':     return `Partially settled`
    case 'failed':      return `Settlement failed`
  }
}

const FooterMessage: React.FC<{ status: SettlementRow['status']; expected: number; confirmed: number; failed: number }> =
  ({ status, expected, confirmed, failed }) => {
    if (status === 'complete') return (
      <div className="text-[10px] font-black text-green-400/80 bg-green-500/5 border border-green-500/10 rounded-lg py-2 px-3 text-center uppercase tracking-widest">
        {confirmed} of {expected} confirmed · 100% success
      </div>
    )
    if (status === 'partial') return (
      <div className="flex items-center justify-between text-[10px] font-black bg-amber-500/5 border border-amber-500/10 rounded-lg py-2 px-3 uppercase tracking-widest">
        <span className="text-amber-400/90">{confirmed} of {expected} confirmed · {failed} failed</span>
        <button className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5">
          <RotateCcw className="w-3 h-3" /> Retry failed
        </button>
      </div>
    )
    if (status === 'failed') return (
      <div className="flex items-center justify-between text-[10px] font-black bg-red-500/5 border border-red-500/10 rounded-lg py-2 px-3 uppercase tracking-widest">
        <span className="text-red-400/90">All {expected} intents failed</span>
        <button className="text-red-400 hover:text-red-300 flex items-center gap-1.5">
          <RotateCcw className="w-3 h-3" /> Retry
        </button>
      </div>
    )
    return (
      <div className="text-[10px] font-black text-blue-400/70 bg-blue-500/5 border border-blue-500/10 rounded-lg py-2 px-3 text-center uppercase tracking-widest">
        {confirmed} / {expected} confirmed — green dots are clickable to verify on Arc
      </div>
    )
  }
