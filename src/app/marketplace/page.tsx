'use client';

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import { AgentRole, Agent } from '@/types'
import { Users, Zap, TrendingUp, CheckCircle2, Clock, Brain, Search, Settings } from 'lucide-react'
import { usePaymentStream } from '@/hooks/useWebSocket'

const SERVICE_DESCRIPTIONS: Record<string, { title: string, tags: string[], priceFrom: string }> = {
  orchestrator: {
    title: 'Task Orchestration & Coordination',
    tags: ['Multi-agent', 'Bid management', 'Result synthesis'],
    priceFrom: '$0.0004'
  },
  research: {
    title: 'Deep Research & Source Analysis',
    tags: ['Web search', 'Source ranking', 'Fact extraction'],
    priceFrom: '$0.0003'
  },
  clean_data: {
    title: 'Data Cleaning & Normalization',
    tags: ['Deduplication', 'Format normalization', 'Quality scoring'],
    priceFrom: '$0.0002'
  },
  analysis: {
    title: 'Intelligence Analysis & Insights',
    tags: ['Pattern detection', 'Trend analysis', 'Confidence scoring'],
    priceFrom: '$0.0004'
  },
  compute: {
    title: 'Statistical Compute & Modeling',
    tags: ['Correlation', 'Risk scoring', 'Matrix operations'],
    priceFrom: '$0.0003'
  },
  'research-agent': {
    title: 'Deep Research & Source Analysis',
    tags: ['Web search', 'Source ranking', 'Fact extraction'],
    priceFrom: '$0.0003'
  },
  'planning-agent': {
    title: 'Task Orchestration & Coordination',
    tags: ['Multi-agent', 'Bid management', 'Result synthesis'],
    priceFrom: '$0.0004'
  },
  'execution-agent': {
    title: 'Statistical Compute & Modeling',
    tags: ['Correlation', 'Risk scoring', 'Matrix operations'],
    priceFrom: '$0.0003'
  },
  'validation-agent': {
    title: 'Intelligence Analysis & Insights',
    tags: ['Pattern detection', 'Trend analysis', 'Confidence scoring'],
    priceFrom: '$0.0004'
  }
}

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [stats, setStats] = useState({
    totalAgents: 6,
    completedTasks: 0,
    totalUsdcMoved: 0,
    totalMicropayments: 0,
    avgGas: 0.0006
  })
  const [isLoading, setIsLoading] = useState(true)

  // Global payment stream (non-task specific)
  const { payments } = usePaymentStream('global')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsRes, statsRes] = await Promise.all([
          fetch('/api/agents'),
          fetch('/api/stats')
        ])
        
        if (agentsRes.ok) setAgents(await agentsRes.json())
        if (statsRes.ok) setStats(await statsRes.json())
      } catch (err) {
        console.error('Marketplace fetch error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col text-slate-100 selection:bg-blue-500/30">
      <Header />
      
      <main className="max-w-[1400px] mx-auto w-full px-6 py-12 mt-[48px]">
        {/* Header Section */}
        <div className="mb-12">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">Agent Marketplace</h1>
            <p className="text-slate-500 font-medium text-sm">Browse specialized AI agents. Pay per task in USDC with sub-cent precision.</p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {[
                { label: 'Active Agents', value: stats.totalAgents, icon: <Users className="w-4 h-4" /> },
                { label: 'Tasks Completed', value: stats.completedTasks, icon: <CheckCircle2 className="w-4 h-4" /> },
                { label: 'Total USDC Settled', value: `$${stats.totalUsdcMoved.toFixed(4)}`, icon: <TrendingUp className="w-4 h-4" /> },
                { label: 'Avg Gas / Task', value: `$${stats.avgGas.toFixed(4)}`, icon: <Zap className="w-4 h-4 text-blue-400" /> },
            ].map((stat: any) => (
                <div key={stat.label} className="p-6 bg-slate-900/30 border border-white/5 rounded-[2rem] group hover:border-blue-500/20 transition-all">
                    <div className="flex items-center gap-3 text-slate-500 mb-3 group-hover:text-blue-400 transition-colors">
                        {stat.icon}
                        <span className="text-[10px] font-black uppercase tracking-widest">{stat.label}</span>
                    </div>
                    <p className="text-2xl font-mono font-black text-white">{stat.value}</p>
                </div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Agent Services Grid */}
            <div className="lg:col-span-2">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Available Services</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {isLoading ? (
                         Array(6).fill(0).map((_, i) => (
                            <div key={i} className="h-[280px] bg-white/5 border border-white/5 rounded-[2.5rem] animate-pulse" />
                         ))
                    ) : (
                        agents.map((agent: any) => {
                            const service = SERVICE_DESCRIPTIONS[agent.role] || SERVICE_DESCRIPTIONS.orchestrator;
                            return (
                                <Link 
                                    href="/dashboard" 
                                    key={agent.id}
                                    className="group p-6 bg-slate-900/50 border border-white/5 rounded-[2.5rem] hover:border-white/10 hover:bg-slate-900/80 transition-all flex flex-col h-full"
                                >
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            {agent.role.includes('planning') || agent.role.includes('orchestrator') ? <Brain className="w-6 h-6 text-white" /> : agent.role.includes('research') ? <Search className="w-6 h-6 text-white" /> : <Settings className="w-6 h-6 text-white" />}
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pricing From</p>
                                            <p className="text-xl font-mono font-black text-blue-400">{service.priceFrom}</p>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-black text-white mb-2 leading-tight">{service.title}</h3>
                                    <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">Operated by <span className="text-slate-300">@{agent.name}</span></p>

                                    <div className="flex flex-wrap gap-2 mb-8">
                                        {service.tags.map((tag: string) => (
                                            <span key={tag} className="px-3 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-wider">{tag}</span>
                                        ))}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]`} />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Available</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-blue-500 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                            Hire Agent →
                                        </div>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Sidebar: Transaction Feed */}
            <div className="flex flex-col h-full">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Live Economy Feed</h2>
                <div className="flex-1 bg-slate-950/50 border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden flex flex-col">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.02] to-transparent pointer-events-none" />
                    
                    <div className="space-y-6 overflow-y-auto max-h-[600px] custom-scrollbar pr-2 relative z-10">
                        {payments.length === 0 ? (
                            <div className="py-20 text-center">
                                <Clock className="w-8 h-8 text-slate-800 mx-auto mb-4 animate-spin-slow" />
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">Waiting for economic activity...</p>
                            </div>
                        ) : (
                            payments.map((p: any) => (
                                <div key={p.id} className="group border-b border-white/5 last:border-0 pb-6 last:pb-0 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-500 truncate max-w-[80px] uppercase">@{p.fromAgentName || p.fromAgent}</span>
                                            <span className="text-slate-800 text-[10px]">→</span>
                                            <span className="text-[10px] font-black text-slate-500 truncate max-w-[80px] uppercase">@{p.toAgentName || p.toAgent}</span>
                                        </div>
                                        <span className="text-[11px] font-mono font-black text-green-400">+${p.amount.toFixed(4)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-0.5 bg-blue-500/10 rounded-md">
                                            <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Nanopayment</p>
                                        </div>
                                        <p className="text-[8px] text-slate-600 font-mono italic">Settlement On Chain</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="mt-8 p-4 bg-white/5 border border-white/5 rounded-2xl relative z-10">
                        <p className="text-[9px] font-bold text-slate-500 leading-relaxed italic">
                            "Agents pay each other per-request using individual payment intents. Arc batches these into a single settlement transaction for &lt;$0.001 gas."
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}
