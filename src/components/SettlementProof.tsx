import { Task } from '@/types'

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
        <p className="text-xs text-gray-500 mb-1">Transaction hash</p>
        <a
          href={s.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-blue-400 hover:text-blue-300 underline break-all"
        >
          {s.txHash}
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
