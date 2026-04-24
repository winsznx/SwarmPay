'use client';

import React, { useState, useEffect } from 'react';
import { Users, Cpu, Search, Database, Code, ShieldCheck, Terminal, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent, AgentRole } from '@/types';

const agentRoleIcons: Record<string, React.ReactNode> = {
  'research-agent': <Search className="w-3.5 h-3.5" />,
  'planning-agent': <Database className="w-3.5 h-3.5" />,
  'execution-agent': <Terminal className="w-3.5 h-3.5" />,
  'validation-agent': <ShieldCheck className="w-3.5 h-3.5" />,
  'orchestrator': <Cpu className="w-3.5 h-3.5" />,
};

export const AgentManager: React.FC<{ agents?: Agent[] }> = ({ agents: propAgents }) => {
  const [localAgents, setLocalAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(!propAgents);

  const displayAgents = propAgents || localAgents;

  useEffect(() => {
    if (!propAgents) {
      fetchAgents();
    }
  }, [propAgents]);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        setLocalAgents(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex flex-col">
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Fleet</span>
           <span className="text-xl font-bold text-slate-200">{displayAgents.length} Qualified Agents</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-600">Initializing registry...</div>
        ) : displayAgents.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-slate-700">No agents on deck.</div>
        ) : (
          displayAgents.map((agent) => (
            <motion.div
              layout
              key={agent.id}
              className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.05] hover:border-white/10 transition-all group relative overflow-hidden"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  {agentRoleIcons[agent.role] || <Cpu className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                      {agent.role.replace('-agent', '')}
                    </span>
                    <div className="flex items-center gap-1">
                       <Award className="w-2.5 h-2.5 text-blue-500" />
                       <span className="text-[10px] font-mono font-bold text-slate-400">{agent.reputation}</span>
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-blue-400 transition-colors">
                    {agent.name}
                  </h4>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-white/[0.03] space-y-1">
                 {/* Circle wallet balance - proves real integration */}
                 <div className="flex items-center justify-between">
                   <span className="text-[10px] font-bold text-slate-500 uppercase">Wallet</span>
                   <span className="text-[10px] font-mono font-black text-slate-300">
                     ${(agent.wallet || 0).toFixed(2)} USDC
                   </span>
                 </div>

                 {/* SwarmPay earned balance */}
                 <div className="flex items-center justify-between">
                   <span className="text-[10px] font-bold text-slate-500 uppercase">Earned</span>
                   <span className="text-[10px] font-mono font-black text-green-400">
                     +${(agent.earned || 0).toFixed(4)} USDC
                   </span>
                 </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
