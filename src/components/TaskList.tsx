'use client';

import React, { useState, useEffect } from 'react';
import { Task, Bid, SubTask, SubBid, Agent } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, CheckCircle2, AlertCircle, Loader2, Gavel, TrendingUp, Hash, Layers, Zap, Code, Star, ShieldAlert } from 'lucide-react';
import { ExecutionGraph } from './ExecutionGraph';
import { ResultCard } from './ResultCard';
import { SettlementAnimation } from './SettlementAnimation';

interface TaskListProps {
  tasks: Task[];
  agents: Agent[];
  onNewTask?: (prompt: string, budget: number, parentTaskId?: string) => void;
  isLatest?: boolean;
}

const statusIcons = {
  pending: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  bidding: <TrendingUp className="w-3.5 h-3.5 text-blue-400 animate-pulse" />,
  assigned: <Gavel className="w-3.5 h-3.5 text-purple-400" />,
  executing: <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  settling: <Zap className="w-3.5 h-3.5 text-blue-400 animate-pulse" />,
  failed: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  open: <Hash className="w-3.5 h-3.5 text-slate-500" />,
};

const DEMO_BIDS = [
  { agent: 'CryptoScout-X',  price: '0.22', time: '40', rep: 95 },
  { agent: 'Research-Alpha', price: '0.25', time: '45', rep: 92 },
  { agent: 'DataMiner-Pro',  price: '0.18', time: '60', rep: 87 },
];


export const TaskCard: React.FC<{ 
  task: Task; 
  agents: Agent[]; 
  onNewTask?: (prompt: string, budget: number, parentTaskId?: string) => void;
  isLatest?: boolean;
}> = ({ task, agents, onNewTask, isLatest }) => {
  const [bids, setBids] = useState<(Bid & { agentName?: string })[]>([]);
  const [subTasks, setSubTasks] = useState<(SubTask & { bids?: SubBid[] })[]>([]);
  const [assignedAgent, setAssignedAgent] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    // Only fetch if task is in active state and we don't have data yet
    const isActive = ['bidding', 'assigned', 'completed', 'executing', 'settling'].includes(task.status);
    
    if (isActive && bids.length === 0) {
      const controller = new AbortController();
      fetch(`/api/tasks/${task.id}/bids`, { signal: controller.signal })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setBids(data.map((b: Bid) => ({ 
            ...b, 
            agentName: agents.find(a => a.id === b.agentId)?.name || 'Agent' 
          })));
        })
        .catch(err => {
          if (err.name !== 'AbortError') console.error('Failed to fetch bids:', err);
        });
      return () => controller.abort();
    }
    
    const isRunning = ['executing', 'settling'].includes(task.status);
    
    if (['executing', 'settling', 'completed'].includes(task.status)) {
      const fetchSubTasks = () => {
        const controller = new AbortController();
        fetch(`/api/tasks/${task.id}/subtasks`, { signal: controller.signal })
          .then(res => res.ok ? res.json() : [])
          .then(setSubTasks)
          .catch(err => {
            if (err.name !== 'AbortError') console.error('Failed to fetch subtasks:', err);
          });
        return controller;
      };

      // Initial fetch
      const initialController = fetchSubTasks();

      // Poll if running
      let interval: NodeJS.Timeout | null = null;
      if (isRunning) {
        interval = setInterval(fetchSubTasks, 2000);
      }

      return () => {
        initialController.abort();
        if (interval) clearInterval(interval);
      };
    }

    if (task.assignedAgentId) {
      const a = agents.find(ag => ag.id === task.assignedAgentId);
      if (a) setAssignedAgent(a.name);
    }
  }, [task.id, task.status, agents, task.assignedAgentId]);

  const winningBid = bids.find(b => b.id === task.winningBid);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-8 hover:border-blue-500/20 transition-all duration-500 group relative overflow-hidden flex flex-col gap-4 md:gap-6"
    >
      {/* Background ID Watermark */}
      <div className="absolute top-4 right-4 text-[40px] font-black text-white/[0.02] pointer-events-none select-none italic tracking-tighter">
        #{task.id.slice(0, 4)}
      </div>

      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2">
             <div className="px-2 py-0.5 bg-slate-800 rounded text-[9px] font-black text-slate-400 uppercase tracking-widest border border-white/5">
               Task Layer 0{task.depth || 1}
             </div>
             <div className="w-1 h-1 bg-slate-700 rounded-full" />
             <div className="text-[10px] font-mono text-slate-500">{new Date(task.createdAt).toLocaleTimeString()}</div>
          </div>
          
          <h3 className="text-xl font-bold text-white leading-tight tracking-tight group-hover:text-blue-400 transition-colors duration-300">
            {task.prompt}
          </h3>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-1.5 rounded-xl border border-blue-500/10">
                <span className="text-[10px] font-black text-blue-500/60 uppercase">Budget</span>
                <span className="text-sm font-mono font-black text-blue-400">${(task.budget ?? 0).toFixed(2)}</span>
             </div>
             {task.subTaskIds && task.subTaskIds.length > 0 && (
               <div className="flex items-center gap-2 bg-purple-500/5 px-3 py-1.5 rounded-xl border border-purple-500/10">
                  <Layers className="w-3 h-3 text-purple-400" />
                  <span className="text-xs font-bold text-purple-400">{(task.subTaskIds || []).length} Nodes</span>
               </div>
             )}
          </div>
        </div>

        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border-2 font-black text-[11px] uppercase tracking-wider h-fit
          ${task.status === 'pending' ? 'bg-slate-950 border-slate-800 text-slate-400' : ''}
          ${task.status === 'bidding' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : ''}
          ${task.status === 'assigned' ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : ''}
          ${task.status === 'executing' ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-status-pulse' : ''}
          ${task.status === 'completed' ? 'bg-green-500/10 border-green-500/30 text-green-400' : ''}
          ${task.status === 'failed' ? 'bg-red-500/10 border-red-500/30 text-red-400' : ''}
          ${task.status === 'open' ? 'bg-slate-800 border-slate-700 text-slate-400' : ''}
        `}>
          {statusIcons[task.status as keyof typeof statusIcons]}
          {task.status}
        </div>
      </div>

      {/* MISSION RATIONALE & APPRAISAL */}
      {(task.complexity || task.orchestratorRationale) && (
        <div className="px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex items-start gap-3">
          <Hash className="w-4 h-4 text-blue-400/40 mt-0.5" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Orchestrator Intelligence Rationale</span>
              {/* Guard Error Message (if failed) */}
              {task.status === 'failed' && (
                <div className="mx-4 mb-4 p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center flex-shrink-0 border border-red-400/20">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Orchestrator Guard Rejection</span>
                      <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-black rounded uppercase">Violation Detected</span>
                    </div>
                    <span className="text-[13px] text-red-200/90 font-medium leading-relaxed mt-1">
                      {task.errorReason || 'Mission aborted due to internal state inconsistency or secondary execution error.'}
                    </span>
                  </div>
                </div>
              )}
              {task.complexity && (
                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${
                  task.complexity === 'high' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-slate-800 border-white/5 text-slate-400'
                }`}>
                  {task.complexity.toUpperCase()} COMPLEXITY
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium leading-relaxed italic">
              "{task.orchestratorRationale || 'Analyzing task semantics and optimizing execution graph.'}"
            </p>
          </div>
        </div>
      )}

      {/* ASSIGNED / EXECUTING STATUS PANEL */}
      {(task.status === 'assigned' || task.status === 'executing') && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-[1.5rem] flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            {task.status === 'executing' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Gavel className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-[9px] font-black text-purple-400/60 uppercase tracking-widest">
              {task.status === 'assigned' ? 'Lead Agent Preparing' : 'Autonomous Execution Running'}
            </div>
            <div className="text-sm font-bold text-slate-100">{assignedAgent || winningBid?.agentName || '...'}</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 px-2 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" />
            <span className="text-[8px] font-black text-purple-400 uppercase">{task.status}</span>
          </div>
        </motion.div>
      )}

      {/* GRAPH VISUALIZER VIEW */}
      {(task.status === 'executing' || task.status === 'completed' || subTasks.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Code className="w-3.5 h-3.5" />
              Hybrid Execution Graph
            </h4>
            <button 
              onClick={() => setShowGraph(!showGraph)}
              className="text-[10px] font-black text-blue-400 uppercase hover:text-white transition-colors border-b border-blue-400/30 pb-0.5"
            >
              {showGraph ? 'Switch to Tree' : 'Visualize DAG'}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {showGraph ? (
              <motion.div
                key="graph"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
              >
                <ExecutionGraph taskId={task.id} />
              </motion.div>
            ) : (
              <motion.div
                key="tree"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {subTasks.map((st, idx) => (
                   <div key={st.id} className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                         <span className="text-[9px] font-mono text-slate-600">0{idx+1}</span>
                         <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                           st.status === 'completed' ? 'bg-green-500/5 border-green-500/20 text-green-400' :
                           st.status === 'executing' ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400' : 'text-slate-500 border-white/5'
                         }`}>
                           {st.status}
                          </span>
                        </div>
                      <h5 className="text-xs font-bold text-slate-200">{st.title}</h5>
                      <p className="text-[10px] text-slate-500 line-clamp-2">
                        {(() => {
                          const text = (st.status === 'completed' && st.result?.result ? st.result.result : st.description) || '';
                          return text.length > 80 ? text.slice(0, 80) + '...' : text;
                        })()}
                      </p>
                   </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* BIDDING MARKET PANEL — shows live competing bids */}
      {task.status === 'bidding' && (
        <div className="space-y-3 pt-4 border-t border-white/5">
           <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                Agents Bidding — Autonomous Market
              </h4>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-md">
                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-blue-400 uppercase">Auto-resolving</span>
              </div>
           </div>

           <div className="grid gap-1.5">
             {bids.length === 0 ? (
               <div className="py-6 space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse text-center mb-4">
                   📡 Swarm Auction Active
                 </p>
                 {DEMO_BIDS.map((bid, i) => (
                   <motion.div
                     key={bid.agent}
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: i * 0.4 }}
                     className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl px-4 py-3"
                   >
                     <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                        <span className="text-[11px] font-bold text-slate-300">{bid.agent}</span>
                     </div>
                     <div className="flex items-center gap-4">
                       <span className="text-[11px] font-mono font-black text-blue-400">${bid.price}</span>
                       <div className="h-3 w-px bg-white/10" />
                       <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{bid.rep} REP</span>
                     </div>
                   </motion.div>
                 ))}
               </div>
             ) : (
               bids.map(bid => (
                <div key={bid.id} className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300
                  ${bid.status === 'winner' ? 'bg-green-500/5 border-green-500/20' : 'bg-slate-950/40 border-white/5 opacity-80 hover:opacity-100'}
                `}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs
                      ${bid.status === 'winner' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-slate-900 border-white/5 text-slate-500'}
                    `}>
                      {bid.agentName?.slice(0, 1)}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-bold ${bid.status === 'winner' ? 'text-white' : 'text-slate-400'}`}>
                            {bid.agentName}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded
                            ${bid.status === 'winner' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/5 text-red-400/60 border border-red-500/10'}
                          `}>
                            {bid.status === 'winner' ? 'Winner' : 'Rejected'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400/60 font-mono tracking-tight font-black uppercase">
                            {(bid.confidence * 100).toFixed(0)}% CONFIDENCE
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium italic">
                        {bid.status === 'winner' ? bid.selectionReason : (bid as any).rejectionReason || 'Competitive mismatch'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                     <div className={`text-sm font-mono font-black ${bid.status === 'winner' ? 'text-green-400' : 'text-slate-500'}`}>
                       ${bid.price.toFixed(4)}
                     </div>
                     <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-1">
                        {(bid.estimatedTimeMs / 1000).toFixed(1)}s LATENCY
                     </div>
                     <div className="text-[8px] text-slate-500 font-medium italic mt-1 max-w-[120px] leading-tight text-right">
                        "{(bid as any).reasoning || 'Optimized execution'}"
                     </div>
                  </div>
                </div>
               ))
             )}
           </div>
        </div>
      )}

      {/* SETTLEMENT ANIMATION — Phase 7 */}
      {task.status === 'settling' && (
        <div className="pt-4 border-t border-blue-500/10">
          <SettlementAnimation />
        </div>
      )}

      {/* RESULT CARD — completion payoff screen */}
      {task.status === 'completed' && (
        <div className="pt-4 border-t border-green-500/10 flex flex-col gap-4">
          <ResultCard task={task} />
        </div>
      )}

    </motion.div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({ tasks, agents, onNewTask, isLatest }) => {
  if (tasks.length === 0) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-4 glass-panel rounded-[3rem] border-dashed">
        <Zap className="w-10 h-10 text-slate-800" />
        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">No Live Jobs</div>
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      {tasks.map((task) => (
        <TaskCard 
          key={task.id} 
          task={task} 
          agents={agents} 
          onNewTask={onNewTask} 
          isLatest={isLatest} 
        />
      ))}
    </div>
  );
};
