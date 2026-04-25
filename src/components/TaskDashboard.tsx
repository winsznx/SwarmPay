'use client';

import React, { useState, useEffect } from 'react';
import { TaskInput } from './TaskInput';
import { TaskList } from './TaskList';
import { AgentManager } from './AgentManager';
import { Task } from '@/types';
import { Wallet, Zap, Activity, Shield, Users, Boxes, LayoutDashboard } from 'lucide-react';
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
import { ComputeMeter } from './ComputeMeter';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { loadTasksFromSupabase, supabase } from '@/lib/supabase';




export const TaskDashboard: React.FC = () => {
  const pathname = usePathname();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [walletBalance, setWalletBalance] = useState(0); 
  const [displayBalance, setDisplayBalance] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<{prompt: string, budget: number, parentTaskId?: string} | null>(null);

  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id)
    }
  }, [tasks, selectedTaskId])

  useEffect(() => {
    // Load persisted tasks from Supabase on page load
    loadTasksFromSupabase().then(supabaseTasks => {
      if (supabaseTasks.length > 0) {
        setTasks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const newTasks = supabaseTasks.filter(t => !existingIds.has(t.id));
          return [...prev, ...newTasks].sort((a, b) => b.createdAt - a.createdAt);
        });
      }
    }).catch(() => {});

    fetchTasks();
    fetchAgents();
    // 2s base poll. Was 500ms — that summed to 6 req/s/tab across tasks +
    // agents + wallet, which during a multi-judge demo would blow the
    // Vercel Hobby invocation budget. 2s is still snappy enough that
    // bid cards and DAG nodes update visibly mid-task.
    const interval = setInterval(() => {
      fetchTasks();
      fetchAgents();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Live user wallet balance via Supabase Realtime on user_wallets row.
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', 'user_1')
        .maybeSingle();
      if (active && data?.balance != null) setWalletBalance(Number(data.balance));
    })();
    const channel = supabase
      .channel('user_wallets:user_1')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_wallets', filter: 'user_id=eq.user_1' },
        (payload) => {
          if (!active) return;
          const balance = (payload.new as { balance?: number } | undefined)?.balance;
          if (balance != null) setWalletBalance(Number(balance));
        }
      )
      .subscribe();
    return () => {
      active = false;
      if (supabase) void supabase.removeChannel(channel);
    };
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




  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const agentList = await res.json();
        setAgents(agentList);
      }
      // Wallet balance is sourced from the user_wallets Realtime subscription
      // above. No need to poll /api/user/wallet here.
    } catch (err) {
      console.error('Failed to fetch user state:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks');
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setTasks(prev => {
            // Deduplicate incoming data first
            const uniqueIncoming = data.reduce((acc: any[], current: any) => {
              if (!acc.find(item => item.id === current.id)) {
                acc.push(current);
              }
              return acc;
            }, []);
            
            const incomingIds = new Set(uniqueIncoming.map((t: any) => t.id));
            const persistedOnly = prev.filter(t => !incomingIds.has(t.id));
            return [...uniqueIncoming, ...persistedOnly].sort((a, b) => b.createdAt - a.createdAt);
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };


  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => {
      if (prev.some(t => t.id === newTask.id)) return prev;
      return [newTask, ...prev];
    });
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

    // Real escrow: hold first, then create task. Wallet balance updates
    // via Realtime subscription on user_wallets — no optimistic UI needed.
    let escrowId: string | null = null;
    try {
      const holdRes = await fetch('/api/escrow/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user_1', amount: budget }),
      });
      if (holdRes.ok) {
        const data = await holdRes.json();
        escrowId = data.escrowId ?? null;
      } else {
        const err = await holdRes.json().catch(() => ({}));
        console.error('[ESCROW] hold failed:', err.error);
        if (holdRes.status === 402) alert('Insufficient balance for this task.');
        return;
      }
    } catch (e) {
      console.error('[ESCROW] hold network error:', e);
      // Mock-mode fallback: still try to create the task without escrow.
    }

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, budget, parentTaskId, escrowId }),
      });

      if (response.ok) {
        const newTask = await response.json();
        handleTaskCreated(newTask);
      } else if (escrowId) {
        // Refund the hold if the task creation failed
        await fetch('/api/escrow/release', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ escrowId })
        });
      }
    } catch (error) {
      console.error('Failed to create task:', error);
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
      />


      <main className="max-w-[1600px] mx-auto flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] overflow-hidden">
        {/* MISSION SIDEBAR - Dynamic Width controlled by child */}
        <div className="hidden lg:block h-full flex-shrink-0">
           <MissionSidebar 
              tasks={tasks.filter(t => !t.parentTaskId && t.prompt && t.prompt.trim().length > 0)} 
              selectedTaskId={selectedTaskId} 
              onSelectTask={setSelectedTaskId} 
           />
        </div>

        {/* MAIN CONTENT - Scrollable */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-2 py-4 md:p-8">
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

          <div className="grid grid-cols-12 gap-6 md:gap-10 items-start">
            
            {/* LEFT COLUMN: Tasks & Execution */}
            <div className="col-span-12 lg:col-span-7 space-y-6 md:space-y-10">
              <section className="glass-panel p-4 md:p-8 rounded-[1.25rem] md:rounded-[2rem] border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Zap className="w-12 h-12 md:w-20 md:h-20" />
                </div>
                <h2 className="text-[10px] md:text-xs font-black text-blue-500 uppercase tracking-[0.3em] mb-3 md:mb-6 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                  Initialize Compute Task
                </h2>
                <TaskInput onSubmit={(prompt, budget) => handleCreateNewTask(prompt, budget)} />
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
            <div className="col-span-12 lg:col-span-5 space-y-6 md:space-y-10">
              <section className="bg-white/[0.02] border border-white/5 p-5 md:p-8 rounded-[1.5rem] md:rounded-[2rem] relative">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h2 className="text-xs font-black text-purple-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    Agent Registry
                  </h2>
                  <span className="text-[9px] font-black text-slate-500 uppercase border border-white/10 px-2 py-0.5 rounded">Verified Personnel</span>
                </div>
                <AgentManager agents={agents} />
              </section>

              <section>
                <div className="flex items-center justify-between mb-6 px-2">
                    <h2 className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                      Network Nanopayments
                    </h2>
                </div>
                <PaymentStream
                  activeTaskId={selectedTaskId}
                  task={tasks.find(t => t.id === selectedTaskId)}
                />
              </section>

              <section>
                <div className="flex items-center justify-between mb-3 px-2">
                  <h2 className="text-xs font-black text-yellow-500 uppercase tracking-[0.3em] flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                    Compute Meter
                  </h2>
                </div>
                <ComputeMeter taskId={selectedTaskId} />
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
