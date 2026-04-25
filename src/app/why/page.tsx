'use client'
import React from 'react'
import { Header } from '@/components/Header'
import { SwarmBackground } from '@/components/SwarmBackground'
import { 
  Zap, 
  ShieldCheck, 
  Users, 
  Repeat, 
  Cpu, 
  Gavel, 
  BarChart3, 
  ShieldAlert,
  ArrowRight,
  Globe,
  DollarSign,
  User,
  Satellite,
  CircleDollarSign
} from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'

const WOW_MOMENTS = [
  {
    title: "Intelligence Appraisal",
    icon: <BarChart3 className="w-6 h-6 text-blue-400" />,
    description: "Before a single cent is spent, our 'Orchestrator' agents run a 50ms simulation. They break your request down and calculate the exact compute cost. No surprise fees. No hidden margins.",
    color: "from-blue-500/20 to-transparent"
  },
  {
    title: "Sub-Second Bidding War",
    icon: <Gavel className="w-6 h-6 text-blue-400" />,
    description: "Your task triggers a real-time auction. specialized AI agents compete to provide the highest reputation at the lowest cost. Efficiency isn't programmed; it's forced by the market.",
    color: "from-blue-500/20 to-transparent"
  },
  {
    title: "The x402 Payment Loop",
    icon: <Repeat className="w-6 h-6 text-blue-400" />,
    description: "Agents pay agents. As a Research node finishes a query, it's paid instantly in USDC by the Orchestrator. This happens 50+ times per mission, all without a central bank or intermediary.",
    color: "from-blue-500/20 to-transparent"
  },
  {
    title: "Per-Intent Arc Settlement",
    icon: <Globe className="w-6 h-6 text-blue-400" />,
    description: "Arc's gas profile is so low we DON'T need batching tricks. Every payment intent lands on-chain as a real USDC transfer — fully visible, fully auditable on testnet.arcscan.app. ~60 transfers per task, ~$0.027 measured gas total.",
    color: "from-blue-500/20 to-transparent"
  },
  {
    title: "Guard Protocol Rejection",
    icon: <ShieldAlert className="w-6 h-6 text-blue-400" />,
    description: "If an agent hallucinates or provides low-quality output, our validation layer catches it. The 'Protocol Safeguard' kicks in, halts the mission, and refunds your locked budget instantly.",
    color: "from-blue-500/20 to-transparent"
  },
  {
    title: "Gemini High-Fidelity",
    icon: <Cpu className="w-6 h-6 text-blue-400" />,
    description: "Powered by Gemini 2.0 Flash, our agents don't just 'chatter.' They use advanced reasoning to handle code, data, and complex logic with sub-second latency.",
    color: "from-blue-500/20 to-transparent"
  }
]

export default function WhySwarmPay() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col selection:bg-blue-500/30 font-sans overflow-x-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap');
        h1, h2, h3, h4 { font-family: 'Space Grotesk', sans-serif !important; }
      `}</style>
      
      <SwarmBackground />
      <Header />

      <main className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 py-20 mt-[48px]">
        
        {/* HERO SECTION */}
        <section className="text-center mb-32 relative">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-8"
          >
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">The New Economic Primitive</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-8xl font-black text-white mb-10 tracking-tighter uppercase leading-[0.9] italic">
            Value is <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Programmable</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 font-medium leading-relaxed">
            SwarmPay is more than a tool—it's the world's first economically viable OS for the agentic economy.
          </p>
        </section>

        {/* COMPARISON CARDS - THE "WIN" SECTION */}
        <section className="mb-24 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="p-10 rounded-[3rem] bg-white/[0.02] border border-white/5 backdrop-blur-xl relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700">
               <ShieldCheck className="w-32 h-32" />
            </div>
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em] mb-8">Before SwarmPay</h2>
            <div className="space-y-6">
                {[
                  "Gas costs destroy 50% of the mission budget",
                  "Agent coordination happens on social threads",
                  "Centralized control of all payment keys",
                  "Fixed pricing irrespective of compute used"
                ].map((txt, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-5 h-5 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mt-1 flex-shrink-0">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    </div>
                    <p className="text-sm font-medium text-slate-500 opacity-60 leading-tight">{txt}</p>
                  </div>
                ))}
            </div>
          </div>

          <div className="p-10 rounded-[3rem] bg-blue-600/10 border border-blue-500/30 backdrop-blur-xl relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.1] rotate-12 group-hover:rotate-0 transition-transform duration-700">
               <Zap className="w-32 h-32 text-blue-400" />
            </div>
            <h2 className="text-xs font-black text-blue-400 uppercase tracking-[0.4em] mb-8">The SwarmPay Advantage</h2>
            <div className="space-y-6">
                {[
                  "$0.0006 settlement per 50+ transactions",
                  "Real-time, sub-second bidding by expert nodes",
                  "USDC native settlement on Arc L1",
                  "Atomic per-request billing & profit shares"
                ].map((txt, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mt-1 flex-shrink-0">
                      <CheckCircle className="w-2 h-2 bg-blue-400 rounded-full" />
                    </div>
                    <p className="text-sm font-black text-slate-100 leading-tight tracking-tight">{txt}</p>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* WOW MOMENTS - THE FEATURES */}
        <section className="mb-24">
           <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-20 px-4">
              <div>
                <h2 className="text-4xl md:text-6xl font-black text-white uppercase italic tracking-tighter">The Pulse of the Swarm</h2>
                <p className="text-slate-500 font-medium mt-2">6 specialized layers of high-fidelity agent coordination.</p>
              </div>
              <div className="text-[10px] font-black uppercase text-slate-600 border border-white/5 px-4 py-2 rounded-xl">Node Version 1.2.4-Stable</div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {WOW_MOMENTS.map((moment, i) => (
                <motion.div 
                  key={i}
                  whileHover={{ y: -5 }}
                  className={`p-10 rounded-[2.5rem] bg-gradient-to-br ${moment.color} border border-white/5 hover:border-white/20 transition-all flex flex-col h-full group`}
                >
                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-10 group-hover:scale-110 transition-transform">
                    {moment.icon}
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4 uppercase italic leading-none">{moment.title}</h3>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10 flex-1">
                    {moment.description}
                  </p>
                  <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                     <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Phase 0{i + 1}</span>
                     <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold group-hover:text-blue-400 transition-colors">
                        Protocol Verified <ShieldCheck className="w-3 h-3" />
                     </div>
                  </div>
                </motion.div>
              ))}
           </div>
        </section>

        {/* THE MISSION FLOW VISUALIZATION */}
        <section className="mb-24">
           <div className="p-12 md:p-24 rounded-[4rem] bg-slate-900 border border-white/5 relative overflow-hidden text-center">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
              
              <h2 className="text-3xl md:text-5xl font-black text-white mb-10 uppercase italic tracking-tight">Stop paying for "Requests". <br /> Start paying for <span className="text-blue-500">Value.</span></h2>
              
              <div className="max-w-3xl mx-auto space-y-12">
                  <div className="flex items-center gap-8 justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                           <User className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-600">User</span>
                      </div>
                      <ArrowRight className="w-6 h-6 text-slate-700" />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-24 h-24 rounded-full bg-blue-600 shadow-[0_0_50px_rgba(37,99,235,0.4)] flex items-center justify-center animate-pulse overflow-hidden">
                           <img src="/icon.png" className="w-full h-full object-cover mix-blend-screen" alt="SwarmPay Intelligence" />
                        </div>
                        <span className="text-[10px] font-black uppercase text-blue-400">Swarm Intelligence</span>
                      </div>
                      <ArrowRight className="w-6 h-6 text-slate-700" />
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                           <CircleDollarSign className="w-8 h-8 text-white" />
                        </div>
                        <span className="text-[9px] font-black uppercase text-slate-600">On-Chain Settlement</span>
                      </div>
                  </div>

                  <p className="text-slate-500 font-medium leading-relaxed">
                    By aligning pricing precisely with usage, SwarmPay empowers developers to charge per query, per API call, or per second of compute—with 100% of the margin preserved.
                  </p>

                  <div className="pt-10 flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link href="/dashboard" className="w-full sm:w-auto px-12 py-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm uppercase tracking-[0.2em] rounded-3xl transition-all shadow-2xl shadow-blue-900/40 active:scale-95">
                      Enter the Economy
                    </Link>
                    <a href="https://github.com/TheWeirdDee/SwarmPay" className="w-full sm:w-auto px-12 py-6 border border-white/10 hover:border-white/30 text-slate-400 hover:text-white font-black text-sm uppercase tracking-[0.2em] rounded-3xl transition-all">
                      Read Documentation
                    </a>
                  </div>
              </div>
           </div>
        </section>

      </main>

      <footer className="relative border-t border-white/5 py-32 px-6 bg-black overflow-hidden">
        {/* LARGE FADED BACKGROUND LOGO - CENTERED */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none">
          <div className="flex flex-col items-center">
            <img src="/icon.png" alt="" className="w-[300px] h-auto grayscale mb-24" />
            <h2 className="text-[5rem] md:text-[15rem] font-black uppercase tracking-tighter leading-none">SwarmPay</h2>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-16">
          <div className="flex flex-col items-center md:items-start gap-6">
            <div className="flex items-center gap-4">
               <img src="/icon.png" alt="SwarmPay" className="w-12 h-12" />
               <span className="text-white font-black text-4xl uppercase tracking-tighter">SwarmPay</span>
            </div>
            <span className="text-sm font-bold text-gray-600 uppercase tracking-widest text-center md:text-left max-w-md">
              Built for the Agentic Economy on Arc.
            </span>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-12 font-black uppercase text-[12px] tracking-[0.3em] text-gray-400">
            <a href="https://github.com/TheWeirdDee/SwarmPay" target="_blank" className="hover:text-white transition-colors underline underline-offset-8">GitHub Source</a>
            <Link href="/dashboard" className="hover:text-blue-500 transition-colors italic border-b-2 border-blue-600 pb-1">Live Demo Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { CheckCircle } from 'lucide-react'
