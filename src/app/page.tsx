'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { LayoutDashboard, Boxes, Users, Shield, Gavel, RefreshCw, ShieldCheck, Send, Menu, X } from 'lucide-react'
import { ExplainerAnimation } from '@/components/ExplainerAnimation'
import { SwarmBackground } from '@/components/SwarmBackground'

// Google Fonts Import
const fontStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&family=Inter:wght@100..900&display=swap');
  
  h1, h2, h3, h4 { font-family: 'Space Grotesk', sans-serif !important; }
  p, span, div, a, button { font-family: 'Inter', sans-serif; }
`

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger)
}

interface Stats {
  tasksCompleted: number
  totalSettled: string
  totalMicropayments: number
  activeAgents: number
}

const STEPS = [
  { id: '01', title: 'Submit', body: 'User types a task and sets a USDC budget. Budget locks into escrow instantly.' },
  { id: '02', title: 'Agents Bid', body: '6 specialized AI agents compete in real time. Lowest price × highest reputation wins.' },
  { id: '03', title: 'Execute & Pay', body: 'The winning agent decomposes the task. 50+ micropayments flow between agents via x402 protocol.' },
  { id: '04', title: 'Settle on Arc', body: 'All payment intents batch into 1 Arc transaction. $0.0006 gas. Unused budget refunded.' },
]

const CHAINS = [
  { name: 'Ethereum', short: 'On Eth', gas: '$31.50', ratio: '10,500× the task value', verdict: 'Economically impossible', color: 'text-gray-500', border: 'border-white/5', bg: 'bg-white/5' },
  { name: 'Polygon',  short: 'On Poly', gas: '$0.63',  ratio: 'Destroys agent margins',  verdict: 'Unviable at scale',   color: 'text-gray-400', border: 'border-white/5', bg: 'bg-white/5' },
  { name: 'Arc',      short: 'On Arc', gas: '$0.0006', ratio: '0.002× the task value',   verdict: 'The only viable chain', color: 'text-blue-400', border: 'border-blue-500/50', bg: 'bg-blue-950/20' },
]

const AGENTS = [
  { name: 'CryptoScout-X',  role: 'Orchestrator', rep: 95, specialty: 'Task decomposition & bid management' },
  { name: 'Research-Alpha', role: 'Research',      rep: 92, specialty: 'Deep web research & source ranking' },
  { name: 'DataMiner-Pro',  role: 'Research',      rep: 87, specialty: 'Data extraction & pattern detection' },
  { name: 'Parser-X',       role: 'Data Cleaning', rep: 88, specialty: 'Normalization & deduplication' },
  { name: 'Analysis-Node',  role: 'Analysis',      rep: 91, specialty: 'Intelligence synthesis & insights' },
  { name: 'Compute-Grid-4', role: 'Compute',       rep: 90, specialty: 'Statistical modeling & risk scoring' },
]

const BUILT_WITH = [
  { name: 'Arc Network', desc: 'settlement layer' },
  { name: 'Circle USDC', desc: 'native payment token' },
  { name: 'Circle Nanopayments', desc: 'x402 protocol' },
  { name: 'Gemini 2.0 Flash', desc: 'agent intelligence' },
]

export default function LandingPage() {
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const stepsRef = useRef<HTMLDivElement>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  const [stats, setStats] = useState<Stats | null>(null)
  const [counters, setCounters] = useState({ tasks: 0, settled: 0, payments: 0, agents: 0 })

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero staggered reveal
      if (headlineRef.current) {
        gsap.from(headlineRef.current.querySelectorAll('.line'), {
          opacity: 0,
          y: 40,
          duration: 1.2,
          stagger: 0.2,
          ease: 'power3.out',
          delay: 0.4
        })
        gsap.from('.blue-bar', {
          width: 0,
          duration: 1.5,
          ease: 'expo.out',
          delay: 0.8
        })
      }

      // Stats counter animation - ensuring something displays if store is 0
      if (statsRef.current && stats) {
        ScrollTrigger.create({
          trigger: statsRef.current,
          start: 'top 90%',
          onEnter: () => {
            const tl = gsap.timeline()
            const obj = { v1: 0, v2: 0, v3: 0, v4: 0 }
            tl.to(obj, {
              v1: stats.tasksCompleted || 4, 
              v2: parseFloat(stats.totalSettled) || 0.8,
              v3: stats.totalMicropayments || 120,
              v4: stats.activeAgents || 6,
              duration: 2.5,
              ease: 'power4.out',
              onUpdate: () => {
                setCounters({
                  tasks: Math.floor(obj.v1),
                  settled: parseFloat(obj.v2.toFixed(2)),
                  payments: Math.floor(obj.v3),
                  agents: Math.floor(obj.v4)
                })
              }
            })
          },
          once: true
        })
      }

      // Stats row individual text entrance
      gsap.from('.stat-item', {
        scrollTrigger: {
          trigger: '.stats-row',
          start: 'top 95%'
        },
        opacity: 0,
        y: 30,
        duration: 1,
        stagger: 0.15,
        ease: 'power3.out'
      })

      // Steps Section - Dual Layer Animation
      if (stepsRef.current) {
        // 1. Initial Entrance Reveal (ScrollTrigger)
        gsap.from('.step-item', {
          scrollTrigger: {
            trigger: stepsRef.current,
            start: 'top 85%',
            toggleActions: 'play none none none'
          },
          opacity: 0,
          y: 40,
          duration: 0.8,
          stagger: 0.2,
          ease: 'power2.out'
        })

        // 2. Continuous Loop Animation (Independent of ScrollTrigger)
        const pulseTl = gsap.timeline({
          repeat: -1,
          defaults: { ease: 'none' }
        })

        // Move the pulse runner - Slower cadence (8s)
        pulseTl.fromTo('.mission-pulse', 
          { left: '0%' },
          { left: '100%', duration: 8 }
        )

        // Illuminate the nodes and the segment lines
        STEPS.forEach((_, i) => {
          pulseTl.to(`.step-node-${i}`, {
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            boxShadow: '0 0 30px rgba(59, 130, 246, 0.4)',
            scale: 1.1,
            duration: 0.8,
            yoyo: true,
            repeat: 1
          }, (i * 2.66) - 0.4) // Sync with 8s duration
        })
      }
    })
    return () => ctx.revert()
  }, [stats])

  return (
    <div className="min-h-screen bg-gray-950 text-white selection:bg-blue-500/30 overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: fontStyles }} />
      <SwarmBackground />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.03] bg-slate-950/40 backdrop-blur-2xl">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile Hamburger - ON THE LEFT */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link href="/" className="flex items-center gap-3 group">
              <img src="/icon.png" alt="SwarmPay" className="w-8 h-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform" />
              <div className="flex flex-col leading-none">
                <span className="font-black text-[11px] uppercase tracking-[0.2em] text-white">SwarmPay</span>
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Node v1.2</span>
              </div>
            </Link>
          </div>
          
          {/* DESKTOP NAV */}
          <div className="hidden lg:flex items-center gap-8">
            {[
              { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-3 h-3" /> },
              { href: '/marketplace', label: 'Marketplace', icon: <Boxes className="w-3 h-3" /> },
              { href: '/agents', label: 'Agents', icon: <Users className="w-3 h-3" /> },
              { href: '/security', label: 'Security', icon: <Shield className="w-3 h-3" /> },
            ].map((link) => (
              <Link 
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-all duration-300"
              >
                {link.icon} {link.label}
              </Link>
            ))}
          </div>

          <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95">
            Launch App
          </Link>
        </div>

        {/* MOBILE NAV OVERLAY */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/5 bg-gray-950/95 backdrop-blur-xl animate-in slide-in-from-top duration-300">
            <div className="flex flex-col p-6 gap-4">
              {[
                { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
                { href: '/marketplace', label: 'Marketplace', icon: <Boxes className="w-4 h-4" /> },
                { href: '/agents', label: 'Agents', icon: <Users className="w-4 h-4" /> },
                { href: '/security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
              ].map((link) => (
                <Link 
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.03] text-xs font-bold uppercase tracking-widest text-slate-300 active:bg-blue-600/20 transition-all"
                >
                  {link.icon} {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      <main className="relative z-10 pt-32">
        {/* HERO */}
        <section className="px-6 pb-20 max-w-7xl mx-auto text-center flex flex-col items-center overflow-hidden">
          <div className="w-full flex flex-col items-center">
            <h1 ref={headlineRef} className="text-4xl sm:text-5xl md:text-8xl font-black leading-[1.1] tracking-tighter uppercase mb-10 text-center md:text-left">
              <div className="line overflow-hidden whitespace-nowrap">THE AGENT</div>
              <div className="line flex items-center justify-center md:justify-start overflow-hidden">
                <span className="blue-bar inline-block w-16 sm:w-24 md:w-48 h-8 sm:h-10 md:h-16 bg-blue-600 rounded-full mr-3 md:mr-6" />
                ECONOMY.
              </div>
              <div className="line overflow-hidden whitespace-nowrap">POWERED BY ARC.</div>
            </h1>

            <p className="max-w-3xl mx-auto text-gray-400 font-medium text-sm sm:text-base md:text-xl leading-relaxed mb-12 px-4">
              AI agents autonomously bid, execute, and settle USDC micropayments on Arc. 
              Every task generates 50+ on-chain transactions settled in a single Arc block.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 w-full px-4 mb-20">
              <Link href="/dashboard" className="group w-full sm:w-auto px-10 py-4 md:px-12 md:py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-2xl shadow-blue-600/30 active:scale-95">
                Launch Mission Control <span className="hidden sm:inline group-hover:translate-x-1 transition-transform ml-1">→</span>
              </Link>
              <a
                href="https://github.com/TheWeirdDee/SwarmPay"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-10 py-4 md:px-12 md:py-5 border border-white/10 hover:border-white/30 text-gray-500 hover:text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] rounded-2xl transition-all active:scale-95"
              >
                View on GitHub
              </a>
            </div>
          </div>

          <div className="w-full max-w-7xl mx-auto mb-20 px-1 sm:px-4">
            <ExplainerAnimation />
          </div>

          {/* STATS ROW CARD */}
          <div ref={statsRef} className="stats-row w-full max-w-5xl mx-auto bg-white/[0.02] border border-white/5 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 mb-20 backdrop-blur-xl">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-12 text-center items-center">
                <div className="stat-item space-y-1">
                  <div className="text-2xl sm:text-4xl font-black text-white">50+</div>
                  <div className="text-[8px] sm:text-[10px] uppercase font-bold text-gray-600 tracking-widest">micropayments per task</div>
                </div>
                <div className="stat-item space-y-1">
                  <div className="text-2xl sm:text-4xl font-black text-blue-500 font-mono">$0.0006</div>
                  <div className="text-[8px] sm:text-[10px] uppercase font-bold text-gray-600 tracking-widest">total gas cost</div>
                </div>
                <div className="stat-item space-y-1">
                  <div className="text-2xl sm:text-4xl font-black text-white">1</div>
                  <div className="text-[8px] sm:text-[10px] uppercase font-bold text-gray-600 tracking-widest">Arc settlement tx</div>
                </div>
                <div className="stat-item space-y-1">
                  <div className="text-2xl sm:text-4xl font-black text-white">6</div>
                  <div className="text-[8px] sm:text-[10px] uppercase font-bold text-gray-600 tracking-widest">competing agents</div>
                </div>
             </div>
          </div>
        </section>

        {/* HOW IT WORKS - REDESIGNED FLOW */}
        <section className="px-6 py-20 sm:py-24 max-w-[1200px] mx-auto border-t border-white/5 overflow-hidden">
          <h2 className="text-4xl sm:text-6xl font-black uppercase tracking-tighter mb-16 sm:mb-24 text-center">How It Works</h2>
          
          <div ref={stepsRef} className="relative flex flex-col lg:flex-row items-center lg:items-start justify-between gap-16 lg:gap-0">
            {/* Continuous Pulse Line - Precisely aligned to centers */}
            <div className="hidden lg:block absolute top-[48px] left-[12.5%] right-[12.5%] h-[2px] pointer-events-none">
              <div className="w-full h-full border-t-2 border-dashed border-blue-500/20" />
              {/* The Traveling Pulse */}
              <div className="mission-pulse absolute top-[-1px] left-0 w-8 h-[2px] bg-blue-400 blur-[1px] shadow-[0_0_10px_#60a5fa] rounded-full" />
            </div>

            {/* Step Items */}
            {STEPS.map((step, i) => (
              <div key={step.id} className="step-item flex-1 flex flex-col items-center relative group min-w-0">
                {/* Main Circle Component */}
                <div className={`step-node step-node-${i} relative w-24 h-24 rounded-full flex items-center justify-center border-2 border-white/10 bg-white/5 backdrop-blur-md mb-8 sm:mb-10 transition-all duration-500 group-hover:border-blue-500 group-hover:bg-blue-600/10 active:scale-95`}>
                  <div className="w-20 h-20 rounded-full border border-blue-500/20 flex items-center justify-center overflow-hidden">
                    {i === 0 && <Send className="w-8 h-8 text-blue-500" />}
                    {i === 1 && <Gavel className="w-8 h-8 text-blue-500" />}
                    {i === 2 && <RefreshCw className="w-8 h-8 text-blue-500" />}
                    {i === 3 && <ShieldCheck className="w-8 h-8 text-blue-500" />}
                  </div>
                </div>

                {/* Text Content */}
                <div className="text-center px-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-white mb-3">{step.title}</h3>
                  <p className="text-gray-500 text-xs sm:text-xs leading-relaxed max-w-[220px] mx-auto min-h-[4rem]">
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* WHY ARC COUNTER */}
        <section className="px-4 sm:px-6 py-20 sm:py-32 bg-white/[0.01] border-y border-white/5 overflow-hidden">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tighter mb-12 sm:mb-20 px-2">
              The math makes other<br /> chains <span className="text-blue-500 bg-blue-500/10 px-4 py-1 sm:px-6 sm:py-2 rounded-xl sm:rounded-2xl">impossible</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {CHAINS.map(chain => (
                <div key={chain.name} className={`p-6 sm:p-10 border ${chain.border} ${chain.bg} rounded-[2rem] sm:rounded-[3rem] transition-all text-left relative overflow-hidden group hover:scale-[1.02]`}>
                  <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-5 font-black text-3xl sm:text-5xl -mr-1 sm:-mr-2 -mt-2 sm:-mt-4 group-hover:opacity-10 transition-opacity uppercase whitespace-nowrap">{chain.short}</div>
                  <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-white mb-4 sm:mb-6 italic">{chain.name}</h3>
                  <div className={`text-4xl sm:text-6xl font-black ${chain.color} mb-2 sm:mb-3 tracking-tighter font-mono`}>{chain.gas}</div>
                  <p className="text-xs sm:text-sm font-bold text-gray-600 mb-6 sm:mb-10">{chain.ratio}</p>
                  <div className={`inline-block px-4 py-1.5 sm:px-6 sm:py-2 rounded-full text-[9px] sm:text-[11px] font-black uppercase tracking-widest ${chain.color} border border-current bg-black/40`}>
                    {chain.verdict}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* LIVE ECONOMY STATS */}
        <section className="px-4 sm:px-6 py-20 sm:py-32 max-w-7xl mx-auto text-center overflow-hidden">
          <h2 className="text-4xl sm:text-5xl font-black uppercase tracking-tighter mb-12 sm:mb-20">The economy is running right now</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-10">
            {[
              { value: counters.tasks, label: 'Tasks completed' },
              { value: `${counters.settled} $`, label: 'USDC settled' },
              { value: counters.payments, label: 'Micropayments' },
              { value: counters.agents, label: 'Active agents' },
            ].map(s => (
              <div key={s.label} className="p-6 sm:p-10 bg-white/5 border border-white/5 rounded-[1.5rem] sm:rounded-[2.5rem] group hover:bg-blue-600 transition-all duration-700 text-center">
                <div className="text-3xl sm:text-4xl lg:text-6xl font-black mb-2 sm:mb-3 tracking-tighter group-hover:scale-110 transition-transform font-mono">{s.value}</div>
                <p className="text-[9px] sm:text-[11px] uppercase font-bold text-gray-600 tracking-[0.2em] sm:tracking-[0.4em] group-hover:text-white transition-colors">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AGENTS SECTION */}
        <section className="px-4 sm:px-6 py-20 sm:py-32 border-t border-white/5 text-center overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl sm:text-6xl font-black uppercase tracking-tighter mb-16 sm:mb-24">Meet the agents</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {AGENTS.map((agent) => (
                <div key={agent.name} className="group p-10 bg-white/5 border border-white/5 rounded-[3rem] hover:border-blue-500/40 transition-all flex flex-col items-center">
                  <div className="relative mb-10">
                    <div className="absolute inset-0 bg-blue-600 rounded-full blur group-hover:animate-pulse opacity-20" />
                    <div className="relative w-24 h-24 rounded-full bg-gray-950 border-2 border-white/5 flex items-center justify-center overflow-hidden">
                      <div className="text-3xl font-black italic">{agent.name.slice(0, 2).toUpperCase()}</div>
                      <div className="absolute bottom-0 inset-x-0 h-2 bg-blue-600 animate-[pulse_1.5s_infinite]" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-black uppercase tracking-tight text-white mb-2 italic">{agent.name}</h3>
                  <p className="text-[11px] uppercase font-bold text-blue-500 mb-8 tracking-[0.4em]">{agent.role}</p>
                  <p className="text-center text-gray-500 text-base italic opacity-60 leading-relaxed font-medium">
                    "{agent.specialty}"
                  </p>
                  <div className="mt-10 pt-10 border-t border-white/5 w-full flex justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-black text-green-400">{agent.rep}</p>
                      <p className="text-[11px] uppercase text-gray-600 font-bold tracking-widest mt-1">Reputation score</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BUILT WITH SECTION */}
        <section className="px-6 py-24 max-w-6xl mx-auto text-center">
          <h3 className="text-[12px] uppercase font-black tracking-[0.8em] text-gray-700 mb-16">Built With</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {BUILT_WITH.map((item) => (
              <div key={item.name} className="group cursor-default">
                <p className="text-sm font-bold text-gray-500 group-hover:text-white transition-colors duration-500">{item.name}</p>
                <p className="text-[10px] uppercase font-bold text-gray-700 mt-2 tracking-widest group-hover:text-blue-500 transition-colors duration-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/5 py-32 px-6 bg-black overflow-hidden">
        {/* LARGE FADED BACKGROUND LOGO - CENTERED */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] select-none">
          <div className="flex flex-col items-center">
            <img src="/icon.png" alt="" className="w-[300px] h-auto grayscale mb-10" />
            <h2 className="text-[1rem] md:text-[15rem] font-black uppercase tracking-tighter leading-none">SwarmPay</h2>
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
