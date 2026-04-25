'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePaymentStream, X402Event } from '@/hooks/useWebSocket';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, ArrowRight, Clock, Zap, Activity } from 'lucide-react';
import { Task } from '@/types';

export const PaymentStream: React.FC<{ activeTaskId: string | null; task?: Task }> = ({ activeTaskId, task }) => {
  const { payments, x402Events, connected } = usePaymentStream(activeTaskId);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Group x402 events by paymentIntentId. Show the most recently active
  // triplet first. Each triplet shows the three-phase handshake clearly.
  const triplets = useMemo(() => {
    const byIntent = new Map<string, { '402'?: X402Event; signed?: X402Event; settled?: X402Event; failed?: X402Event; lastTs: number }>();
    for (const e of x402Events) {
      const cur = byIntent.get(e.paymentIntentId) ?? { lastTs: 0 };
      cur[e.phase] = e;
      cur.lastTs = Math.max(cur.lastTs, e.timestamp);
      byIntent.set(e.paymentIntentId, cur);
    }
    return Array.from(byIntent.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.lastTs - a.lastTs)
      .slice(0, 8);
  }, [x402Events]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; 
    }
  }, [payments]);

  const formatTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return '--:--';
    return (
      <span suppressHydrationWarning>
        {new Date(timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}
      </span>
    );
  };

  const validPayments = payments.filter(p =>
    (p.amount ?? 0) > 0 &&
    p.fromAgent &&
    p.toAgent &&
    p.fromAgent !== 'Agent' &&
    p.toAgent !== 'Node'
  );

  const displayPayments = validPayments.slice(0, 20);

  const aggregated = validPayments
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
    .toFixed(6);

  return (
    <div className="flex flex-col h-[400px] glass-panel rounded-[2rem] border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Nanopayment Stream</h3>
            <p className="text-[8px] font-bold text-slate-500 uppercase">Live Arc Network Feed</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded-md">
           <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse" />
           <span className="text-[8px] font-black text-green-400 uppercase">Real-time</span>
        </div>
      </div>

      {/* x402 protocol triplets — real handshake, real signatures, real txHashes */}
      {triplets.length > 0 && (
        <div className="px-4 pt-4 pb-2 space-y-2 border-b border-white/5">
          <div className="text-[8px] font-black text-blue-400/70 uppercase tracking-[0.3em]">x402 Handshakes (live)</div>
          {triplets.map(t => (
            <X402TripletRow key={t.id} triplet={t} />
          ))}
        </div>
      )}

      {/* Feed List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide custom-scrollbar"
      >
        <AnimatePresence initial={false}>
          {displayPayments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
              <CreditCard className="w-8 h-8" />
              <span className="text-[9px] font-black uppercase tracking-widest">Awaiting Transactions...</span>
            </div>
          ) : (
            displayPayments.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="group relative flex items-center justify-between p-3 bg-white/[0.01] border border-white/[0.03] rounded-xl hover:bg-white/[0.03] hover:border-blue-500/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="text-[9px] font-mono font-bold text-slate-500 flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(p.timestamp)}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-200">{p.fromAgent ?? 'Agent'}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-slate-600" />
                    <span className="text-[10px] font-black text-blue-400">{p.toAgent ?? 'Node'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-black text-white bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                    ${(p.amount ?? 0).toFixed(4)}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Stats */}
      <div className="p-4 bg-slate-950/40 border-t border-white/5 flex items-center justify-between">
         <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
           Live Intents: <span className="text-white ml-1">Showing {Math.min(20, payments.length)} of {task?.micropaymentCount ?? payments.length}</span>
         </div>
         <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none text-right">
           Aggregated<br />
           <span className="text-blue-400 font-black font-mono text-xs">
             ${aggregated}
           </span>
         </div>
      </div>

      {/* see X402TripletRow below */}
      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

interface TripletRow {
  id: string;
  '402'?: X402Event;
  signed?: X402Event;
  settled?: X402Event;
  failed?: X402Event;
  lastTs: number;
}

const X402TripletRow: React.FC<{ triplet: TripletRow }> = ({ triplet }) => {
  const meta = triplet['402'] ?? triplet.signed ?? triplet.settled ?? triplet.failed!
  const sigShort = triplet.signed?.signature ?? ''
  const txHashShort = triplet.settled?.txHash
    ? `${triplet.settled.txHash.slice(0, 8)}…${triplet.settled.txHash.slice(-4)}`
    : null
  return (
    <div className="relative pl-3 py-1.5 border-l-2 border-blue-500/40 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[8px] font-black text-slate-400">{meta.fromAgent}</span>
        <ArrowRight className="w-2 h-2 text-slate-600" />
        <span className="text-[8px] font-black text-slate-400">{meta.toAgent}</span>
        <span className="text-[10px] font-mono font-black text-blue-400 ml-auto">${meta.amount.toFixed(4)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest">
        <Chip color="yellow" active={!!triplet['402']}  label="402 Required" />
        <Chip color="blue"   active={!!triplet.signed} label={sigShort ? `Signed ${sigShort}` : 'Signed'} />
        {triplet.failed
          ? <Chip color="red" active label={`Failed${triplet.failed.error ? `: ${triplet.failed.error.slice(0, 24)}` : ''}`} />
          : triplet.settled?.txHash
            ? (
              <a href={triplet.settled.explorerUrl ?? `https://testnet.arcscan.app/tx/${triplet.settled.txHash}`}
                 target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25">
                <span>Settled {txHashShort}</span>
                <Activity className="w-2 h-2" />
              </a>
            )
            : <Chip color="slate" active={false} label="Settled (pending)" />
        }
      </div>
    </div>
  )
}

const Chip: React.FC<{ color: 'yellow' | 'blue' | 'green' | 'red' | 'slate'; active: boolean; label: string }> = ({ color, active, label }) => {
  const cls = !active
    ? 'bg-slate-900 border-slate-800 text-slate-600'
    : color === 'yellow' ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400'
    : color === 'blue'   ? 'bg-blue-500/15   border-blue-500/30   text-blue-400'
    : color === 'green'  ? 'bg-green-500/15  border-green-500/30  text-green-400'
    : color === 'red'    ? 'bg-red-500/15    border-red-500/30    text-red-400'
    : 'bg-slate-900 border-slate-800 text-slate-600'
  return <span className={`inline-block px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
}
