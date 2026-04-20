'use client';

import React, { useState } from 'react';
import { Task } from '@/types';
import { Send } from 'lucide-react';

interface FollowUpInputProps {
  task: Task;
  onNewTask?: (prompt: string, budget: number, parentTaskId?: string) => void;
}

export const FollowUpInput: React.FC<FollowUpInputProps> = ({ task, onNewTask }) => {
  console.log('[FOLLOWUP] task.prompt:', task?.prompt, 'task.id:', task?.id);
  const [followUp, setFollowUp] = useState('');
  const followUpBudget = Math.max(0.05, (task.budget || 0) * 0.5);

  const handleSubmit = () => {
    if (!followUp.trim()) return;
    const contextualPrompt = `Follow-up on "${task.prompt}": ${followUp}`;
    onNewTask?.(contextualPrompt, followUpBudget, task.id);
    setFollowUp('');
  };

  return (
    <div className="mt-8 p-6 bg-slate-900/30 border border-white/5 rounded-[2rem] relative overflow-hidden group">
      {/* Background focus glow */}
      <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
      
      <div className="relative">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
          Continue Mission
        </h4>

        <div className="flex gap-3">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder={`Ask a follow-up... ($${followUpBudget.toFixed(2)} USDC)`}
            className="flex-1 bg-[#0a0f1e] border border-white/5 rounded-2xl px-6 py-3.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 transition-all font-medium"
          />
          <button
            onClick={handleSubmit}
            disabled={!followUp.trim()}
            className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all whitespace-nowrap flex items-center gap-2 group shadow-xl shadow-blue-900/40 active:scale-95"
          >
            Ask ↗
          </button>
        </div>
        
        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
            Agents will re-bid · ${followUpBudget.toFixed(2)} USDC · Unused Budget Refunded
          </p>
        </div>
      </div>
    </div>
  );
};
