'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Search, Database, ShieldCheck, Terminal, Award, ExternalLink, Wallet, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent } from '@/types';
import { supabase } from '@/lib/supabase';

interface RepDelta {
  agentId: string;
  delta: number;
  ts: number;
}

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
  const [recentDeltas, setRecentDeltas] = useState<RepDelta[]>([]);

  const displayAgents = propAgents || localAgents;

  useEffect(() => {
    if (!propAgents) {
      fetchAgents();
    }
  }, [propAgents]);

  // Live reputation deltas via Supabase Realtime on reputation_events
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('reputation_events:registry')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reputation_events' },
        (payload) => {
          const row = payload.new as { agent_id: string; delta: number };
          if (!row?.agent_id) return;
          const next: RepDelta = { agentId: row.agent_id, delta: row.delta, ts: Date.now() };
          setRecentDeltas(prev => [...prev.filter(d => d.ts > Date.now() - 2000), next]);
          // Drop after 2s for the fade
          setTimeout(() => {
            setRecentDeltas(prev => prev.filter(d => d.ts !== next.ts));
          }, 2000);
        }
      )
      .subscribe();
    return () => { if (supabase) void supabase.removeChannel(channel); };
  }, []);

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
              {/* Live reputation delta popup */}
              <AnimatePresence>
                {recentDeltas.filter(d => d.agentId === agent.id).map((d, i) => (
                  <motion.div
                    key={`${d.ts}-${d.agentId}-${i}`}
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: -16 }}
                    exit={{ opacity: 0, y: -32 }}
                    transition={{ duration: 1.6 }}
                    className={`absolute top-4 right-4 z-10 px-2 py-0.5 text-[10px] font-mono font-black rounded border ${
                      d.delta >= 0
                        ? 'bg-green-500/20 border-green-500/40 text-green-300'
                        : 'bg-red-500/20 border-red-500/40 text-red-300'
                    }`}
                  >
                    {d.delta >= 0 ? `+${d.delta}` : d.delta} REP
                  </motion.div>
                ))}
              </AnimatePresence>
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
              
              <div className="mt-4 pt-3 border-t border-white/[0.03] space-y-1.5">
                {/* On-chain identity badge */}
                {(agent as any).walletAddress ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                      <span className="text-[10px] font-bold text-green-500 uppercase">On-Chain</span>
                    </div>
                    <a
                      href={(agent as any).arcExplorerUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-mono text-blue-400 hover:text-blue-300 transition-colors"
                      title={(agent as any).walletAddress}
                    >
                      {`${((agent as any).walletAddress as string).slice(0, 6)}…${((agent as any).walletAddress as string).slice(-4)}`}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                ) : null}

                {/* Live USDC balance from Circle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Wallet className="w-2.5 h-2.5 text-slate-500" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Balance</span>
                  </div>
                  <span className="text-[10px] font-mono font-black text-slate-300">
                    {(agent as any).balanceUsdc != null
                      ? `$${((agent as any).balanceUsdc as number).toFixed(2)} USDC`
                      : `$${(agent.wallet || 0).toFixed(2)} USDC`}
                  </span>
                </div>

                {/* Settled tx count */}
                {(agent as any).settledTxCount != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Settled Txns</span>
                    <span className="text-[10px] font-mono font-black text-slate-400">
                      {(agent as any).settledTxCount}
                    </span>
                  </div>
                )}

                {/* Earned this session */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Earned</span>
                  <span className="text-[10px] font-mono font-black text-green-400">
                    +${((agent as any).totalEarned || agent.earned || 0).toFixed(4)} USDC
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
