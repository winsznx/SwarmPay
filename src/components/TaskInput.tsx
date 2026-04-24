'use client';

import React, { useState } from 'react';
import { Send, DollarSign, Sparkles, Activity, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Task } from '@/types';

interface TaskInputProps {
  onTaskCreated: (task: Task) => void;
}

export const TaskInput: React.FC<TaskInputProps> = ({ onTaskCreated }) => {
  const [prompt, setPrompt] = useState('');
  const [budget, setBudget] = useState<number | ''>('')

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || !budget) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, budget }),
      });

      if (response.ok) {
        const newTask = await response.json();
        onTaskCreated(newTask);
        setPrompt('');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinBudget = (p: string): number => {
    const words = p.trim().split(' ').length;
    const hasComplexKeywords = /analyz|research|compar|invest|strateg|market|crypto|defi|blockchain|predict|forecast|explain|comprehensive|detailed/i.test(p);
    if (words <= 5 && !hasComplexKeywords) return 0.05;
    if (words <= 10 || !hasComplexKeywords) return 0.10;
    return 0.20;
  };

  const minBudget = getMinBudget(prompt);
  const budgetTooLow = budget !== '' && budget < minBudget;

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div className="group relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-10 group-focus-within:opacity-25 transition duration-1000"></div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Analyze top 5 DeFi protocols on the Arc Network... or Compare Ethereum L2 gas costs vs Arc."
            className="relative w-full h-24 md:h-36 px-3 md:px-6 py-3 md:py-5 bg-[#0a0f1e] border border-white/5 rounded-2xl text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none transition-all text-sm md:text-base leading-relaxed"
            required
          />
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 md:gap-6">
          <div className="flex-1 flex flex-col">
            <div className={`flex items-center bg-[#0a0f1e] border rounded-2xl px-3 md:px-5 py-2.5 md:py-3.5 group focus-within:border-blue-500/30 transition-all ${budgetTooLow ? 'border-amber-500/50' : 'border-white/5'}`}>
              <DollarSign className="w-3.5 h-3.5 text-blue-500/60 mr-2" />
              <input
                type="number"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="bg-transparent text-slate-100 focus:outline-none w-full text-base font-mono font-bold"
                placeholder="0.30"
                required
              />
              <span className="text-[9px] md:text-[10px] font-black text-slate-600 uppercase ml-2 tracking-widest whitespace-nowrap">
                USDC <span className="hidden xs:inline">Allocated</span>
              </span>
            </div>
            <p className={`text-[9px] md:text-[10px] font-bold mt-2 ml-1 uppercase tracking-tight transition-colors ${budgetTooLow ? 'text-amber-400' : 'text-slate-600'}`}>
              {budgetTooLow 
                ? `⚠ Minimum $${minBudget.toFixed(2)} USDC required for this complexity`
                : `Suggested minimum: $${minBudget.toFixed(2)} USDC`
              }
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !prompt.trim() || budget === '' || budget < minBudget}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 md:px-8 md:py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[9px] md:text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-900/40 group active:scale-95 self-start sm:self-center"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 animate-pulse" />
                Initializing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Launch Mission
              </span>
            )}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 px-3">
           <div className="flex items-center gap-2">
             <Sparkles className="w-3 h-3 text-yellow-500/50" />
             <p className="text-[10px] text-slate-600 font-bold uppercase tracking-tight">AI agents will automatically decompose this request into executable sub-tasks.</p>
           </div>
        </div>
      </form>
    </div>
  );
};
