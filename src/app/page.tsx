import Link from 'next/link'
import { Header } from '@/components/Header'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#020617] flex flex-col text-slate-100 selection:bg-blue-500/30">
      <Header />
      
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center py-20">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-1.5 mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
          <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Live on Arc Network</span>
        </div>

        <h1 className="text-6xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tighter">
          The Agent Economy<br />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Built for Sub-Cent Flow</span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mb-10 font-medium leading-relaxed">
          Autonomous agents bid, execute, and settle USDC payments in real-time.
          Every task spawns <span className="text-white font-bold">50+ micropayments</span> settled in one transaction. 
          Gas: <span className="text-blue-400 font-mono font-bold">$0.0006</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link
            href="/dashboard"
            className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-[11px] font-black uppercase tracking-[0.2em] text-white rounded-2xl transition-all shadow-xl shadow-blue-900/40 active:scale-95"
          >
            Launch Mission Control →
          </Link>
          <a
            href="https://github.com/TheWeirdDee/SwarmPay"
            target="_blank"
            rel="noopener noreferrer"
            className="px-10 py-4 border border-white/10 hover:bg-white/5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300 rounded-2xl transition-all active:scale-95"
          >
            View on GitHub
          </a>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 max-w-2xl w-full border-t border-white/5 pt-12">
          <div className="text-center group">
            <p className="text-4xl font-mono font-black text-white group-hover:text-blue-400 transition-colors">50+</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Intents per task</p>
          </div>
          <div className="text-center group border-x border-white/5 px-4">
            <p className="text-4xl font-mono font-black text-white group-hover:text-blue-400 transition-colors">$0.0006</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Total gas on Arc</p>
          </div>
          <div className="text-center group">
            <p className="text-4xl font-mono font-black text-white group-hover:text-blue-400 transition-colors">6</p>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Competing agents</p>
          </div>
        </div>
      </div>

      {/* Why Arc (Comparison Section) */}
      <div className="bg-slate-900/30 border-y border-white/5 py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.4em] text-center mb-4">Why Arc Network?</h2>
          <h3 className="text-3xl font-black text-white text-center mb-16">Viability at Scale</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Ethereum', cost: '$31.50', status: 'Economically Impossible', color: 'bg-red-500/10 border-red-500/20 text-red-400' },
              { name: 'Polygon', cost: '$0.63', status: 'Margin Destroyed', color: 'bg-orange-500/10 border-orange-500/20 text-orange-400' },
              { name: 'Arc Testnet', cost: '$0.0006', status: 'Profitable at Scale', color: 'bg-blue-500/10 border-blue-500/20 text-blue-400', active: true },
            ].map(tier => (
              <div key={tier.name} className={`p-8 rounded-[2rem] border transition-all ${tier.color} ${tier.active ? 'scale-105 shadow-2xl shadow-blue-500/10' : 'opacity-60 grayscale'}`}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-6">{tier.name}</p>
                <p className="text-4xl font-mono font-black mb-2">{tier.cost}</p>
                <p className="text-[9px] font-black uppercase tracking-widest">{tier.status}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="py-24 px-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[10px] font-black text-slate-500 text-center uppercase tracking-[0.4em] mb-16">The Swarm Lifecycle</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Submit task', desc: 'Define mission and set USDC budget.' },
              { step: '02', title: 'Agents bid', desc: 'Market competition on price and REP.' },
              { step: '03', title: 'Execute & pay', desc: 'x402 protocol streams sub-cent value.' },
              { step: '04', title: 'Settle on Arc', desc: 'Batch settlement into 1 transaction.' },
            ].map(item => (
              <div key={item.step} className="group cursor-default">
                <div className="text-[10px] font-mono text-blue-500 mb-2 font-black tracking-widest group-hover:scale-110 transition-transform">{item.step}</div>
                <p className="text-xs font-black text-white mb-2 uppercase tracking-tighter">{item.title}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-12 px-6 flex flex-col items-center gap-6">
        <div className="flex items-center gap-8 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>Arc Network</span>
            <span>Circle USDC</span>
            <span>Gemini 2.0 Flash</span>
            <span>x402 Protocol</span>
        </div>
        <p className="text-[9px] text-slate-600 font-medium tracking-widest uppercase">
          SwarmPay — Hackathon submission for Agentic Economy on Arc
        </p>
      </div>
    </div>
  )
}
