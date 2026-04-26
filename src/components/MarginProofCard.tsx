'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

// 60+ micropayments per task. On Eth/Polygon those are 60 individual txs.
// On Arc, the SwarmPay SettlementVault batches all 60 into ONE atomic tx —
// 60 PaymentSettled events emitted, 1 BatchSettled event, single block.
// Measured cost: ~$0.0006 total gas per batch tx on Arc testnet.
const chains = [
  {
    name: 'Ethereum',
    color: 'text-red-500',
    gas: '$30.00',
    viable: false,
    note: '60 individual txs × $0.50 each'
  },
  {
    name: 'Polygon',
    color: 'text-yellow-500',
    gas: '$0.60',
    viable: false,
    note: '60 individual txs × $0.01 each'
  },
  {
    name: 'Arc Network',
    color: 'text-green-500',
    gas: '$0.0006',
    viable: true,
    note: '60 micropayments → 1 atomic tx'
  }
];

export const MarginProofCard: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-6 p-6 bg-slate-950 border border-white/10 rounded-[2rem] overflow-hidden relative group"
    >
      {/* Background glow wrap */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-50 pointer-events-none" />
      
      <div className="relative">
        <div className="mb-6">
          <h4 className="text-lg font-black text-white italic tracking-tight">Why Arc?</h4>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">60 micropayments per task. Per-task gas cost:</p>
        </div>

        <div className="space-y-4">
          {chains.map((chain, b) => (
            <div key={chain.name} className="flex items-center justify-between gap-4 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
              <div className="flex flex-col">
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{chain.name}</span>
                <span className="text-[10px] font-bold text-slate-500">{chain.note}</span>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xl font-mono font-black ${chain.color}`}>
                  {chain.gas}
                </span>
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase
                  ${chain.viable 
                    ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                    : 'bg-red-500/10 border-red-500/20 text-red-400 opacity-60'
                  }`}
                >
                  {chain.viable ? (
                    <>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Viable
                    </>
                  ) : (
                    <>
                      <XCircle className="w-2.5 h-2.5" />
                      Not Viable
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-4 border-t border-white/5 text-center">
            <p className="text-sm font-black text-white tracking-tight">
                60 micropayments → 1 atomic Arc tx via SwarmPay SettlementVault. <span className="text-slate-500">All-or-nothing. 60 PaymentSettled events on-chain.</span>
            </p>
        </div>
      </div>
    </motion.div>
  );
};
