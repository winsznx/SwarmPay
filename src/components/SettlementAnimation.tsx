'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Zap, ArrowRight, Coins } from 'lucide-react';

export const SettlementAnimation: React.FC = () => {
  const [stage, setStage] = useState<'batching' | 'compressing' | 'settled'>('batching');
  
  useEffect(() => {
    const timer1 = setTimeout(() => setStage('compressing'), 1500);
    const timer2 = setTimeout(() => setStage('settled'), 3500);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden bg-slate-950/80 border border-blue-500/20 rounded-[2.5rem] p-8 min-h-[300px] flex flex-col items-center justify-center">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#3b82f6 1px, transparent 0)', backgroundSize: '24px 24px' }} />
      
      <AnimatePresence mode="wait">
        {stage === 'batching' && (
          <motion.div
            key="batching"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="flex gap-2">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    y: [0, -10, 0],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity, 
                    delay: i * 0.1 
                  }}
                  className="w-2 h-8 bg-blue-500 rounded-full"
                />
              ))}
            </div>
            <div className="text-center">
              <h3 className="text-xl font-black text-white italic tracking-tight">Capturing Intents</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">63 off-chain micropayments detected</p>
            </div>
          </motion.div>
        )}

        {stage === 'compressing' && (
          <motion.div
            key="compressing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex items-center justify-center w-full"
          >
            <div className="absolute inset-0 flex items-center justify-center">
               {[...Array(20)].map((_, i) => (
                 <motion.div
                    key={i}
                    initial={{ 
                      x: (Math.random() - 0.5) * 400, 
                      y: (Math.random() - 0.5) * 400,
                      opacity: 0
                    }}
                    animate={{ 
                      x: 0, 
                      y: 0,
                      opacity: [0, 1, 0]
                    }}
                    transition={{ 
                      duration: 1, 
                      repeat: Infinity, 
                      delay: i * 0.05 
                    }}
                    className="w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_10px_#3b82f6]"
                 />
               ))}
            </div>
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: 360
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="z-10 w-24 h-24 rounded-full border-4 border-blue-500/30 flex items-center justify-center bg-blue-500/10 backdrop-blur-xl"
            >
              <Zap className="w-10 h-10 text-blue-400 fill-blue-400/20" />
            </motion.div>
            <div className="absolute -bottom-16 text-center w-full">
              <h3 className="text-xl font-black text-white italic tracking-tight">Arc Batch Settlement</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Compressing complex intents into atomic tx...</p>
            </div>
          </motion.div>
        )}

        {stage === 'settled' && (
          <motion.div
            key="settled"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="relative">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.4)]"
                >
                    <ShieldCheck className="w-10 h-10 text-white" />
                </motion.div>
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-4 border border-dashed border-green-500/30 rounded-full"
                />
            </div>
            
            <div className="text-center">
              <h3 className="text-2xl font-black text-white italic tracking-tight">Settled on Arc</h3>
              <div className="mt-4 p-4 bg-slate-900 border border-white/5 rounded-2xl flex flex-col gap-2 min-w-[320px]">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Transaction Hash</span>
                    <span className="text-blue-400 cursor-pointer hover:underline">0x8f2d...4e1a</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-2">
                    <div className="flex flex-col items-start">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Intents</span>
                        <span className="text-lg font-black text-white italic">63</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-700" />
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Transactions</span>
                        <span className="text-lg font-black text-white italic">1</span>
                    </div>
                </div>
                <div className="mt-2 text-[10px] font-bold text-green-500/80 bg-green-500/5 py-1 rounded-lg">
                    BATCH COMPLETE · GAS: $0.0006
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
