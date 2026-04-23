'use client'
import { useEffect, useRef, useState } from 'react'

const PHASES = [
  {
    id: 1,
    label: 'Task Submitted',
    sublabel: 'User locks $0.30 USDC in escrow',
    color: 'text-blue-400',
    borderColor: 'border-blue-500',
    icon: '📋'
  },
  {
    id: 2,
    label: 'Agents Bidding',
    sublabel: 'CryptoScout-X wins at $0.22 USDC',
    color: 'text-amber-400',
    borderColor: 'border-amber-500',
    icon: '⚔️'
  },
  {
    id: 3,
    label: '54 Micropayments',
    sublabel: 'Agents pay each other via x402',
    color: 'text-purple-400',
    borderColor: 'border-purple-500',
    icon: '⚡'
  },
  {
    id: 4,
    label: 'Settled on Arc',
    sublabel: '1 transaction · $0.0006 gas · $0.08 refunded',
    color: 'text-green-400',
    borderColor: 'border-green-500',
    icon: '✅'
  }
]

const DEMO_PAYMENTS = [
  { from: 'CryptoScout-X', to: 'Research-Alpha', amount: '$0.0004' },
  { from: 'Analysis-Node', to: 'Parser-X', amount: '$0.0003' },
  { from: 'DataMiner-Pro', to: 'Compute-Grid-4', amount: '$0.0002' },
  { from: 'Parser-X', to: 'CryptoScout-X', amount: '$0.0005' },
  { from: 'Research-Alpha', to: 'Analysis-Node', amount: '$0.0001' },
  { from: 'Compute-Grid-4', to: 'DataMiner-Pro', amount: '$0.0003' },
]

export function ExplainerAnimation() {
  const [phase, setPhase] = useState(0)
  const [payments, setPayments] = useState<typeof DEMO_PAYMENTS>([])
  const [bids, setBids] = useState<string[]>([])
  const intervalRef = useRef<any>(null)

  useEffect(() => {
    const sequence = async () => {
      // Phase 0 - task submitted
      setPhase(0)
      setBids([])
      setPayments([])
      await new Promise(r => setTimeout(r, 2000))

      // Phase 1 - bidding
      setPhase(1)
      await new Promise(r => setTimeout(r, 500))
      setBids(['CryptoScout-X: $0.22'])
      await new Promise(r => setTimeout(r, 600))
      setBids(b => [...b, 'Research-Alpha: $0.25'])
      await new Promise(r => setTimeout(r, 600))
      setBids(b => [...b, 'DataMiner-Pro: $0.18'])
      await new Promise(r => setTimeout(r, 1500))

      // Phase 2 - payments streaming
      setPhase(2)
      for (const payment of DEMO_PAYMENTS) {
        await new Promise(r => setTimeout(r, 500))
        setPayments(prev => [payment, ...prev])
      }
      await new Promise(r => setTimeout(r, 1000))

      // Phase 3 - settled
      setPhase(3)
      await new Promise(r => setTimeout(r, 3000))
    }

    const startLoop = () => {
      sequence().then(() => {
        intervalRef.current = setTimeout(startLoop, 1000)
      })
    }

    startLoop()
    return () => {
      if (intervalRef.current) clearTimeout(intervalRef.current)
    }
  }, [])

  return (
    <div className="relative w-full bg-gray-950/80 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-blue-500/10" style={{ minHeight: '420px' }}>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-white/5 bg-white/5">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/30 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/50" />
        </div>
        <span className="text-xs text-gray-400 ml-4 font-mono uppercase tracking-widest">Autonomous Mission Sim</span>
        <div className="ml-auto flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-bold text-green-400 uppercase">Live Economy</span>
        </div>
      </div>

      <div className="p-3 sm:p-8 grid grid-cols-2 gap-3 sm:gap-8 h-full items-start overflow-hidden">
        {/* Left: Phase indicator */}
        <div className="space-y-4">
          {PHASES.map((p, i) => (
            <div
              key={p.id}
              className={`border rounded-xl p-2 sm:p-4 transition-all duration-700 ${
                i === phase
                  ? `${p.borderColor} bg-white/5 scale-[1.02] opacity-100 shadow-lg shadow-${p.color.split('-')[1]}-500/20`
                  : i < phase
                  ? 'border-white/5 opacity-40 scale-95'
                  : 'border-white/5 opacity-10 scale-95'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-4">
                <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-sm sm:text-xl bg-gray-900 border border-white/5`}>
                  {p.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] sm:text-sm font-bold tracking-tight truncate ${i === phase ? p.color : 'text-gray-500'}`}>
                    {p.label}
                  </p>
                  <p className="text-[8px] sm:text-[11px] text-gray-500 mt-0.5 truncate">{p.sublabel}</p>
                </div>
                {i < phase && (
                  <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-400 text-[8px] sm:text-xs">✓</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Live content based on phase */}
        <div className="relative h-full flex flex-col justify-center min-h-[300px]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-3xl" />
          
          {/* Phase 0: Task input */}
          <div className={`transition-all duration-700 absolute inset-0 flex flex-col justify-center ${phase === 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            <div className="bg-gray-900/80 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-6 backdrop-blur-md">
              <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2 sm:mb-3">Objective Submited</p>
              <p className="text-xs sm:text-base text-white font-semibold mb-2 sm:mb-4 leading-snug">
                "Analyze yield strategies on Arc"
              </p>
              <div className="flex items-center justify-between p-2 sm:p-3 bg-white/5 rounded-lg sm:rounded-xl">
                <span className="text-[8px] sm:text-xs text-gray-400">Escrow Locked</span>
                <span className="text-[10px] sm:text-sm font-mono font-bold text-blue-400">$0.30 USDC</span>
              </div>
            </div>
          </div>

          {/* Phase 1: Bids */}
          <div className={`transition-all duration-700 absolute inset-0 flex flex-col justify-center ${phase === 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-4 px-2">⚔️ Active Auction</p>
            <div className="space-y-3">
              {bids.map((bid, i) => (
                <div
                  key={i}
                  className="bg-gray-900 border border-amber-500/30 rounded-xl px-4 py-3 text-xs text-gray-300 flex justify-between items-center animate-in fade-in slide-in-from-right-4"
                >
                  <span className="font-semibold">{bid.split(':')[0]}</span>
                  <span className="text-amber-400 font-mono font-bold">{bid.split(':')[1]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 2: Payment stream */}
          <div className={`transition-all duration-700 absolute inset-0 flex flex-col justify-center ${phase === 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            <p className="text-[8px] sm:text-[10px] text-purple-400 font-bold uppercase tracking-wider mb-2 px-1">⚡ X402 Micro-settlement</p>
            <div className="space-y-1.5 overflow-hidden h-[180px] sm:h-[240px]">
              {payments.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-white/5 rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 text-[8px] sm:text-xs animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center gap-1 sm:gap-2 overflow-hidden">
                    <span className="text-gray-400 truncate max-w-[40px] sm:max-w-[80px]">{p.from}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-gray-400 truncate max-w-[40px] sm:max-w-[80px]">{p.to}</span>
                  </div>
                  <span className="text-green-400 font-mono font-bold ml-1 sm:ml-2">{p.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 3: Settlement */}
          <div className={`transition-all duration-700 absolute inset-0 flex flex-col items-center justify-center text-center ${phase === 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <div className="w-12 h-12 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-green-500/20 border border-green-500/50 flex items-center justify-center mb-4 sm:mb-6 shadow-xl sm:shadow-2xl shadow-green-500/40">
              <span className="text-xl sm:text-3xl">⛓</span>
            </div>
            <p className="text-green-400 font-bold text-sm sm:text-lg mb-1 italic">Success</p>
            <p className="text-[8px] sm:text-xs text-gray-500 mb-4 sm:mb-6">54 nanopayments to Arc</p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-2 sm:p-4 w-full">
              <p className="text-[7px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-0.5 sm:mb-1">Network Gas</p>
              <p className="text-xl sm:text-3xl font-black text-green-400 font-mono tracking-tighter">$0.0006</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
