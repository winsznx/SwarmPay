'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

const chains = [
  {
    name: 'Ethereum',
    color: 'text-red-500',
    gasPer63: '$31.50',
    viable: false,
    note: '10,500x task value'
  },
  {
    name: 'Polygon',
    color: 'text-yellow-500',
    gasPer63: '$0.63',
    viable: false,
    note: '2x task value'
  },
  {
    name: 'Arc Network',
    color: 'text-green-500',
    gasPer63: '$0.0006',
    viable: true,
    note: '0.002x task value'
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
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">63 micropayments. One settlement. Cost comparison:</p>
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
                  {chain.gasPer63}
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
                Arc makes nanopayment economies possible. <span className="text-slate-500">Other chains don't.</span>
            </p>
        </div>
      </div>
    </motion.div>
  );
};
