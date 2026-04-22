'use client';

import React, { useState, useEffect } from 'react';
import { TaskInput } from './TaskInput';
import { TaskList } from './TaskList';
import { AgentManager } from './AgentManager';
import { Task } from '@/types';
import { Wallet, Zap, Activity, Shield, Users, Boxes } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentStream } from './PaymentStream';
import { Agent } from '@/types';
import { MissionSidebar } from './MissionSidebar';
import { Menu, X } from 'lucide-react';
import { FollowUpInput } from './FollowUpInput';
import { MarginProofCard } from './MarginProofCard';
import { SettlementProof } from './SettlementProof';
import { BudgetModal } from './BudgetModal';
import { Header } from './Header';




export const TaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [walletBalance, setWalletBalance] = useState(5.00); 
  const [displayBalance, setDisplayBalance] = useState(5.00);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<{prompt: string, budget: number, parentTaskId?: string} | null>(null);
  const [refundedTaskIds, setRefundedTaskIds] = useState<Set<string>>(new Set());



  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[tasks.length - 1].id)
    }
  }, [tasks, selectedTaskId])


  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchAgents();
    const interval = setInterval(() => {
      fetchTasks();
      fetchAgents();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Update animated balance
  useEffect(() => {
    const diff = walletBalance - displayBalance;
    if (Math.abs(diff) < 0.001) return;
    
    const steps = 30;
    const increment = diff / steps;
    let count = 0;
    
    const interval = setInterval(() => {
      setDisplayBalance(prev => {
        count++;
        if (count >= steps) {
          clearInterval(interval);
          return walletBalance;
        }
        return prev + increment;
      });
    }, 30);
    
    return () => clearInterval(interval);
  }, [walletBalance, displayBalance]);

  // Handle task completion savings refund
  useEffect(() => {
    const completedWithSavings = tasks.filter(t => 
      t.status === 'completed' && 
      t.settlement && // Ensure it's settled
      (t as any).costBreakdown?.userSavings > 0 &&
      !(t as any).refunded // We'll need to track this locally or via a ref to avoid infinite loops if the store doesn't persist it
    );

    if (completedWithSavings.length > 0) {
      completedWithSavings.forEach(t => {
        if (!refundedTaskIds.has(t.id)) {
          const savings = (t as any).costBreakdown?.userSavings || 0;
          console.log(`[REFUND] Returning $${savings} for task ${t.id}`);
          setWalletBalance(prev => prev + savings);
          setRefundedTaskIds(prev => new Set(prev).add(t.id));
        }
      });
    }
  }, [tasks, refundedTaskIds]);



  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const agentList = await res.json();
        setAgents(agentList);
        
        // Sync user wallet balance with the orchestrator agent
        const orchestrator = agentList.find((a: Agent) => a.id === 'crypto-scout-x');
        if (orchestrator) {
          setWalletBalance(orchestrator.wallet);
        }
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };


  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [newTask, ...prev]);
    setSelectedTaskId(newTask.id);
  };


  const handleCreateNewTask = async (prompt: string, budget: number, parentTaskId?: string) => {
    if (!prompt?.trim() || !budget || budget <= 0) {
      console.error('[TASK] blocked invalid launch:', { prompt, budget });
      return;
    }
    setPendingTask({ prompt, budget, parentTaskId });
  };

  const handleApprove = async () => {
    if (!pendingTask) return;
    const { prompt, budget, parentTaskId } = pendingTask;
    setPendingTask(null);
    
    // Optimistic balance deduction
    setWalletBalance(prev => prev - budget);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, budget, parentTaskId }),
      });

      if (response.ok) {
        const newTask = await response.json();
        handleTaskCreated(newTask);
      } else {
        // Rollback balance if failed
        setWalletBalance(prev => prev + budget);
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      setWalletBalance(prev => prev + budget);
    }
  };


  const buildThread = (activeTaskId: string): Task[] => {
    const thread: Task[] = [];
    let currentId: string | undefined = activeTaskId;
    
    while (currentId) {
      const task = tasks.find(t => t.id === currentId);
      if (task && (task as any).prompt) {
        thread.unshift(task);
        currentId = task.parentTaskId;
      } else {
        currentId = undefined;
      }
    }
    return thread;
  };

  const activeThread = selectedTaskId ? buildThread(selectedTaskId) : [];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-blue-500/30">
      {/* Top Navigation Bar */}
      <Header 
        displayBalance={displayBalance} 
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />


      <main className="max-w-[1600px] mx-auto flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] overflow-hidden">
        {/* MISSION SIDEBAR - Dynamic Width controlled by child */}
        <div className="hidden lg:block h-full flex-shrink-0">
           <MissionSidebar 
              tasks={tasks.filter(t => !t.parentTaskId)} 
              selectedTaskId={selectedTaskId} 
              onSelectTask={setSelectedTaskId} 
           />
        </div>

        {/* MAIN CONTENT - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-6 md:p-8">
          {/* Page Hero */}
          <div className="mb-6 md:mb-12 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-4xl font-black text-white tracking-tighter uppercase italic">
                Mission Control
              </h1>
              <p className="text-slate-500 text-[10px] md:text-sm font-medium tracking-tight mt-1">
                Autonomous agent economy. Orbiting the Arc Network.
              </p>
            </div>
            <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/5 sm:bg-transparent sm:p-0 sm:border-0">
              <div className="text-left sm:text-right">
                  <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Total Compute</div>
                  <div className="text-lg md:text-xl font-mono font-black text-slate-200">12.4 GH/s</div>
              </div>
              <Activity className="w-6 h-6 md:w-8 md:h-8 text-blue-500/20" />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-10 items-start">
            
            {/* LEFT COLUMN: Tasks & Execution */}
            <div className="col-span-12 lg:col-span-7 space-y-10">
              <section className="glass-panel p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Zap className="w-12 h-12 md:w-20 md:h-20" />
                </div>
                <h2 className="text-[10px] md:text-xs font-black text-blue-500 uppercase tracking-[0.3em] mb-4 md:mb-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  Initialize Compute Task
                </h2>
                <TaskInput onTaskCreated={handleTaskCreated} />
              </section>

              <section className="space-y-6">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">
                      {selectedTaskId ? 'Focused Mission Execution' : 'Execution Stream'}
                    </h3>
                    <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                      {selectedTaskId ? `Task #${selectedTaskId.slice(0, 8)}` : `${tasks.length} Active Jobs`}
                    </span>
                </div>
                  <div className="space-y-4">
                    {activeThread.length > 0 ? (
                      activeThread.map((t, i) => (
                        <div key={t.id}>
                          {i > 0 && (
                            <div className="flex items-center gap-2 mb-2 px-4">
                              <div className="h-px flex-1 bg-white/5" />
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Follow-up Mission</span>
                              <div className="h-px flex-1 bg-white/5" />
                            </div>
                          )}
                          <TaskList 
                            tasks={[t]} 
                            agents={agents} 
                            onNewTask={handleCreateNewTask}
                          />
                          <SettlementProof task={t} />

                        </div>
                      ))
                    ) : (
                      <TaskList 
                        tasks={tasks.slice(0, 1)} 
                        agents={agents} 
                        onNewTask={handleCreateNewTask}
                      />
                    )}

                    {/* Single Follow-Up Input at the very bottom of the active thread */}
                    {activeThread.length > 0 && activeThread[activeThread.length - 1].status === 'completed' && (
                      <FollowUpInput 
                        task={activeThread[activeThread.length - 1]} 
                        onNewTask={handleCreateNewTask} 
                      />
                    )}

                    {/* Single Margin Proof Card at the very bottom of the thread */}
                    {activeThread.length > 0 && activeThread.some(t => t.status === 'completed') && (
                      <MarginProofCard />
                    )}
                  </div>
              </section>
            </div>

            {/* RIGHT COLUMN: Agent Registry & Network Ops */}
            <div className="col-span-12 lg:col-span-5 space-y-10">
              <section className="bg-white/[0.02] border border-white/5 p-8 rounded-[2rem] relative">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xs font-black text-purple-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    Agent Registry
                  </h2>
                  <span className="text-[9px] font-black text-slate-500 uppercase border border-white/10 px-2 py-0.5 rounded">Verified Personnel</span>
                </div>
                <AgentManager />
              </section>

              <section>
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      Network Nanopayments
                    </h2>
                </div>
                <PaymentStream activeTaskId={selectedTaskId} />
              </section>

              <section className="glass-panel p-6 rounded-[1.5rem] border-white/5">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Network Status</h3>
                <div className="space-y-3">
                    {[
                      { label: 'Latency', value: '14ms', ok: true },
                      { label: 'Gas Price', value: '0.00 USDC', ok: true },
                      { label: 'Nodes Online', value: '1,492', ok: true },
                    ].map((stat, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                        <span className="text-[11px] font-bold text-slate-400">{stat.label}</span>
                        <span className="text-[11px] font-mono font-black text-slate-100">{stat.value}</span>
                      </div>
                    ))}
                </div>
              </section>
            </div>

          </div>
        </div>
      </main>

      {/* Atmospheric FX */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Mobile Side Drawer - Placed at root for highest stacking context */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[150] lg:hidden"
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-slate-950 border-r border-white/10 z-[200] lg:hidden shadow-2xl"
            >
              <div className="p-6 h-full flex flex-col gap-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src="/icon.png" alt="SwarmPay" className="w-8 h-8" />
                    <span className="font-black text-xs uppercase tracking-widest text-white">SwarmPay</span>
                  </div>
                  <button onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  {[
                    { icon: Boxes, label: 'Marketplace' },
                    { icon: Shield, label: 'Security' },
                    { icon: Users, label: 'Agents' },
                    { icon: Activity, label: 'Network Stats' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-blue-400 transition-colors cursor-pointer group">
                      <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      {item.label}
                    </div>
                  ))}
                </div>
                
                <div className="pt-8 border-t border-white/5">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Mission History</h3>
                  <div className="flex flex-col gap-2 pr-2">
                    {tasks.filter(t => !t.parentTaskId).map(t => (
                      <button 
                        key={t.id}
                        onClick={() => {
                          setSelectedTaskId(t.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left
                          ${selectedTaskId === t.id ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-transparent text-slate-400'}
                        `}
                      >
                        <span className="text-[11px] font-bold truncate pr-4">{t.prompt}</span>
                        <span className="text-[9px] font-mono opacity-60">#{t.id.slice(0,4)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">Node Online</span>
                    </div>
                    <div className="mt-2 text-[10px] font-mono font-bold text-slate-600">v1.2.4-stable</div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Budget Approval Modal */}
      {pendingTask && (
        <BudgetModal 
          prompt={pendingTask.prompt}
          budget={pendingTask.budget}
          onApprove={handleApprove}
          onCancel={() => setPendingTask(null)}
        />
      )}
    </div>

  );
};
