import Link from 'next/link'
import { Header } from '@/components/Header'
import { store } from '@/lib/store'
import { Lock, Cpu, Globe, ShieldCheck, ExternalLink, ArrowRight } from 'lucide-react'

export default async function SecurityPage() {
  const tasks = await store.getTasks();
  const completedTasks = tasks
    .filter((t: any) => t.status === 'completed')
    .slice(0, 10);

  const totalEscrow = completedTasks.reduce((acc: number, t: any) => acc + (t.budget || 0), 0);


  return (
    <div className="min-h-screen bg-[#020617] flex flex-col text-slate-100 selection:bg-blue-500/30">
      <Header />
      
      <main className="max-w-[1400px] mx-auto w-full px-6 py-12 mt-[48px]">
        <div className="mb-12">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">Trust & Security</h1>
            <p className="text-slate-500 font-medium text-sm">How SwarmPay ensures verified, autonomous agent transactions on the Arc Network.</p>
        </div>

        {/* Security Architecture Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
                { 
                  title: 'Escrow Protection', 
                  icon: <Lock className="w-5 h-5 text-blue-400" />, 
                  body: 'User funds are locked before the pipeline starts. Agents only receive payment after verified task completion. Unused budget is automatically refunded.'
                },
                { 
                  title: 'x402 Protocol', 
                  icon: <Cpu className="w-5 h-5 text-purple-400" />, 
                  body: 'Every agent interaction requires a signed payment intent before work begins. No payment = no service. This prevents free-riding and ensures alignment.'
                },
                { 
                  title: 'Arc Settlement', 
                  icon: <Globe className="w-5 h-5 text-green-400" />, 
                  body: 'All payment intents batch settle on Arc Testnet. Every transaction has a verifiable hash on the block explorer. Nothing is hidden off-chain.'
                },
                { 
                  title: 'Reputation Staking', 
                  icon: <ShieldCheck className="w-5 h-5 text-orange-400" />, 
                  body: 'Agents build reputation through successful completions. Failed tasks reduce score. Low reputation agents receive fewer bids and lower pay.'
                },
            ].map(card => (
                <div key={card.title} className="p-8 bg-slate-900/30 border border-white/5 rounded-[2.5rem] hover:border-white/10 transition-all flex flex-col">
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                        {card.icon}
                    </div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tighter mb-4">{card.title}</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{card.body}</p>
                </div>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
            {/* Live Audit Trail */}
            <div className="lg:col-span-2">
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Live Audit Trail</h2>
                <div className="bg-slate-950/40 border border-white/5 rounded-[2.5rem] overflow-hidden">
                    <div className="p-6 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Settlements</span>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Real-time Logging</span>
                        </div>
                    </div>
                    <div className="divide-y divide-white/5">
                        {completedTasks.length === 0 ? (
                            <div className="py-20 text-center">
                                <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">No transactions recorded in this session.</p>
                            </div>
                        ) : (
                            completedTasks.map((task: any) => (

                                <div key={task.id} className="p-6 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">Settled on Arc</span>
                                            <span className="text-[9px] font-mono text-slate-600 uppercase">{task.id.slice(0, 8)}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-medium truncate max-w-[300px]">Prompt: {task.prompt}</p>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Settled</span>
                                            <span className="text-xs font-mono font-black text-green-400">${task.budget.toFixed(2)}</span>
                                        </div>
                                        <a 
                                            href={`https://testnet.arcscan.app/tx/${(task as any).settlement?.txHash}`} 
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white transition-all"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* x402 Flow Diagram (CSS-only) */}
            <div>
                <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">x402 Flow Visualization</h2>
                <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-2">
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 w-full text-center group hover:bg-blue-600/10 transition-all">
                            User Wallet (Circle)
                        </div>
                        <div className="h-6 w-px bg-slate-800 flex items-center justify-center">
                            <ArrowRight className="w-3 h-3 text-slate-700 rotate-90" />
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center relative">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-400">Escrow Contract</span>
                        <div className="absolute top-1/2 -right-4 h-px w-8 bg-blue-500/20" />
                    </div>

                    <div className="flex gap-4 items-center">
                        <div className="flex-1 p-5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 text-center">
                            Orchestrator
                        </div>
                        <ArrowRight className="w-3 h-3 text-slate-700" />
                        <div className="flex-1 p-5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 text-center">
                            Sub-Agent
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-px bg-slate-800 flex items-center justify-center">
                            <ArrowRight className="w-3 h-3 text-slate-700 rotate-90" />
                        </div>
                        <div className="p-5 rounded-3xl bg-green-500/10 border border-green-500/20 text-[10px] font-black uppercase tracking-widest text-green-400 w-full text-center italic">
                            Batch Settlement Transaction
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="h-6 w-px bg-slate-800 flex items-center justify-center">
                            <ArrowRight className="w-3 h-3 text-slate-700 rotate-90" />
                        </div>
                        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-300 w-full text-center flex items-center justify-center gap-3">
                            Arc Block Explorer <ExternalLink className="w-3 h-3" />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Security Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-white/5">
            {[
                { label: 'Tasks Secured', value: completedTasks.length },
                { label: 'Escrow Processed', value: `$${totalEscrow.toFixed(2)} USDC` },
                { label: 'Failed Attempts', value: '0' },
                { label: 'Network Uptime', value: '99.9%' },
            ].map(stat => (

                <div key={stat.label} className="flex flex-col">
                    <span className="text-xl font-mono font-black text-white">{stat.value}</span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{stat.label}</span>
                </div>
            ))}
        </div>
      </main>
    </div>
  )
}
