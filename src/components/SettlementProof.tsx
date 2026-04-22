import { Task } from '@/types'
import { Activity } from 'lucide-react'

export function SettlementProof({ task }: { task: Task }) {
  if (!task.settlement) return null

  const s = task.settlement
  const shortHash = s.txHash.slice(0, 10) + '...' + s.txHash.slice(-6)

  return (
    <div className="border border-green-900/50 rounded-xl p-4 bg-green-950/20 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider text-green-400">
          Settled on Arc
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-gray-500">Intents settled</p>
          <p className="text-lg font-bold text-white">{s.intentsSettled}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Gas cost</p>
          <p className="text-lg font-bold text-green-400">${s.gasCost.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Total settled</p>
          <p className="text-lg font-bold text-white">${s.totalAmount.toFixed(4)} USDC</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Transactions</p>
          <p className="text-lg font-bold text-white">1 tx</p>
        </div>
      </div>

      <div className="border-t border-green-900/30 pt-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">
            {s.txHash.startsWith('0x') ? 'Transaction hash' : 'Settlement ID (Broadcasting)'}
          </p>
          {s.txHash.startsWith('0x') ? (
            <span className="text-[9px] font-black bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-widest">
              Verified On-Chain
            </span>
          ) : (
            <span className="text-[9px] font-black bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded border border-yellow-500/20 uppercase tracking-widest animate-pulse">
              Broadcasting to Arc
            </span>
          )}
        </div>
        <a
          href={s.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[11px] font-mono underline break-all flex items-center gap-2 group ${
            s.txHash.startsWith('0x') ? 'text-blue-400 hover:text-blue-300' : 'text-yellow-500/70 hover:text-yellow-500'
          }`}
        >
          {s.txHash}
          <Activity className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </a>
      </div>


      <div className="mt-3 p-2 bg-gray-900/50 rounded-lg">
        <p className="text-xs text-gray-500 text-center">
          {s.intentsSettled} micropayments → 1 Arc transaction → ${s.gasCost.toFixed(4)} total gas
        </p>
      </div>
    </div>
  )
}
