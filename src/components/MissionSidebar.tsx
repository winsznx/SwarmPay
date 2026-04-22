'use client';

import React from 'react';
import { Task } from '@/types';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, Loader2, Zap, AlertCircle, History } from 'lucide-react';

interface MissionSidebarProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
}

const statusColors = {
  pending: 'bg-slate-500',
  bidding: 'bg-blue-500',
  assigned: 'bg-purple-500',
  executing: 'bg-yellow-500',
  settling: 'bg-blue-400',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  open: 'bg-slate-700'
};

const statusIcons = {
  pending: <Clock className="w-3 h-3" />,
  bidding: <Zap className="w-3 h-3" />,
  assigned: <Zap className="w-3 h-3" />,
  executing: <Loader2 className="w-3 h-3 animate-spin" />,
  settling: <Loader2 className="w-3 h-3 animate-spin" />,
  completed: <CheckCircle2 className="w-3 h-3" />,
  failed: <AlertCircle className="w-3 h-3" />,
  open: <Clock className="w-3 h-3" />
};

export const MissionSidebar: React.FC<MissionSidebarProps> = ({ tasks, selectedTaskId, onSelectTask }) => {
  return (
    <aside className="group/sidebar flex flex-col h-full bg-slate-950/20 border-r border-white/5 
      w-full lg:w-20 lg:hover:w-72 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative z-50">
      
      <div className="p-6 border-b border-white/5 flex items-center justify-between overflow-hidden whitespace-nowrap">
        <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
          <History className="w-4 h-4 shrink-0 text-blue-500" />
          <motion.span 
            className="lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-opacity duration-300"
          >
            Mission Records
          </motion.span>
        </h2>
        <span className="text-[9px] font-mono text-slate-700 lg:hidden lg:group-hover/sidebar:block">{tasks.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className={`w-full text-left p-3 rounded-xl transition-all duration-300 group relative overflow-hidden flex items-center gap-3
              ${selectedTaskId === task.id 
                ? 'bg-blue-500/10 border border-blue-500/20' 
                : 'hover:bg-white/[0.03] border border-transparent'}
            `}
          >
            {selectedTaskId === task.id && (
              <motion.div 
                layoutId="activeTask"
                className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"
              />
            )}
            
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
              ${statusColors[task.status as keyof typeof statusColors]} bg-opacity-20 text-white
              ${task.status === 'executing' || task.status === 'settling' ? 'animate-pulse' : ''}
              ${selectedTaskId === task.id ? 'ring-1 ring-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : ''}
            `}>
              {statusIcons[task.status as keyof typeof statusIcons]}
            </div>
            
            <div className="flex-1 min-w-0 lg:opacity-0 lg:group-hover/sidebar:opacity-100 transition-all duration-300 whitespace-nowrap">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider
                  ${selectedTaskId === task.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}
                `}>
                  #{task.id.slice(0, 4)}
                </span>
                <span className="text-[8px] font-mono text-slate-600">
                  {new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400 group-hover:text-slate-200 truncate pr-4">
                {task.prompt?.slice(0, 35)}{task.prompt?.length > 35 ? '...' : ''}
              </p>

            </div>
          </button>
        ))}
      </div>
    </aside>
  );
};
