'use client';

import React, { useState, useEffect } from 'react';
import { TaskInput } from './TaskInput';
import { TaskList } from './TaskList';
import { AgentManager } from './AgentManager';
import { Task } from '@/types';
import { Wallet, Zap, Activity, Shield, Users, Boxes } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PaymentStream } from './PaymentStream';

export const TaskDashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [balance] = useState(5.00); 

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 2000);
    return () => clearInterval(interval);
  }, []);

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
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-blue-500/30">
      {/* Top Navigation Bar */}
      <nav className="border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl sticky top-0 z-[100]">
        <div className="max-w-[1400px] mx-auto px-8 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <img src="/icon.png" alt="SwarmPay" className="w-5 h-5 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              <span className="font-black text-xs uppercase tracking-[0.2em]">SwarmPay Node</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
               <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                 <Boxes className="w-3 h-3" /> Marketplace
               </span>
               <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                 <Shield className="w-3 h-3" /> Security
               </span>
               <span className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer">
                 <Users className="w-3 h-3" /> Agents
               </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Network Live</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/10 rounded-full">
              <Wallet className="w-3 h-3 text-blue-400" />
              <span className="font-mono text-[11px] font-black tracking-tighter">
                ${balance.toFixed(2)} <span className="text-slate-500 ml-0.5">USDC</span>
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-8 py-10">
        {/* Page Hero */}
        <div className="mb-12 flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">
              Mission Control
            </h1>
            <p className="text-slate-500 text-sm font-medium tracking-tight mt-1">
              Autonomous agent economy. Orbiting the Arc Network.
            </p>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-right">
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Total Compute</div>
                <div className="text-xl font-mono font-black text-slate-200">12.4 GH/s</div>
             </div>
             <Activity className="w-8 h-8 text-blue-500/20" />
          </div>
        </div>

        {/* Two-Column Grid Dashboard */}
        <div className="grid grid-cols-12 gap-10 items-start">
          
          {/* LEFT COLUMN (COL-7): Tasks & Execution */}
          <div className="col-span-12 lg:col-span-7 space-y-10">
            <section className="glass-panel p-8 rounded-[2rem] border-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap className="w-20 h-20" />
              </div>
              <h2 className="text-xs font-black text-blue-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                Initialize Compute Task
              </h2>
              <TaskInput onTaskCreated={handleTaskCreated} />
            </section>

            <section className="space-y-6">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Execution Stream</h3>
                  <span className="text-[10px] font-bold text-slate-600 uppercase bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                    {tasks.length} Active Jobs
                  </span>
               </div>
               <TaskList tasks={tasks} />
            </section>
          </div>

          {/* RIGHT COLUMN (COL-5): Agent Registry & Network Ops */}
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
               <PaymentStream />
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
      </main>

      {/* Atmospheric FX */}
      <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
      </div>
    </div>
  );
};
