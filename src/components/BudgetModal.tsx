import { useState, useEffect } from 'react'

interface BudgetModalProps {
  prompt: string
  budget: number
  onApprove: () => void
  onCancel: () => void
}

export function BudgetModal({ prompt, budget, onApprove, onCancel }: BudgetModalProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`fixed inset-0 bg-black/60 flex items-center justify-center z-[200] transition-opacity duration-300 backdrop-blur-sm ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onCancel}
    >
      <div
        className={`bg-[#0f172a]/95 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-sm mx-4 transition-all duration-500 shadow-2xl ${visible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
            Approve task spend
            </p>
            <p className="text-sm text-slate-300 mb-8 font-medium leading-relaxed italic">
            "{prompt.slice(0, 80)}{prompt.length > 80 ? '...' : ''}"
            </p>

            <div className="w-full bg-white/5 border border-white/5 rounded-3xl p-6 mb-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <p className="text-4xl font-mono font-black text-white tracking-tighter mb-1 relative z-10">${budget.toFixed(2)}</p>
                <p className="text-[10px] font-black text-slate-500 tracking-widest relative z-10">USDC PAYROLL</p>
            </div>

            <div className="space-y-2 mb-8 w-full">
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span>Held in escrow until task completes</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span>Unused budget returned automatically</span>
                </div>
            </div>

            <div className="flex gap-4 w-full">
            <button
                onClick={onCancel}
                className="flex-1 py-4 border border-white/5 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all active:scale-95"
            >
                Cancel
            </button>
            <button
                onClick={onApprove}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-900/40 transition-all active:scale-95"
            >
                Approve ${budget.toFixed(2)}
            </button>
            </div>
        </div>
      </div>
    </div>
  )
}
