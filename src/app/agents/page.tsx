'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Header } from '@/components/Header'
import {
  Trophy, Star, Zap, DollarSign, Activity, ChevronRight, ChevronDown,
  ExternalLink, ShieldCheck, Vault, Hash, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  role: string
  reputation: number
  totalEarnedUsdc: number
  lifetimePaymentsReceived: number
  tasksCompleted: number
  walletAddress: string | null
  walletBalanceUsdc: number | null
  vaultBalanceUsdc: number
  settledTxCount: number
  erc8004TokenId: string | null
  erc8004TokenExplorerUrl: string | null
  arcExplorerUrl: string | null
  isOnChain: boolean
}

interface AgentDetail {
  id: string
  name: string
  walletAddress: string | null
  walletBalanceUsdc: number | null
  vaultBalanceUsdc: number
  vaultContract: string | null
  reputation: number | null
  settledTxCount: number
  erc8004: {
    tokenId: string | null
    registryContract: string
    tokenExplorerUrl: string | null
    verifyCommand: string | null
  }
  arcExplorerUrl: string | null
  economics: {
    totalEarnedUsdc: number
    totalSpentUsdc: number
    netUsdc: number
    lifetimePaymentsReceived: number
    lifetimePaymentsSent: number
  }
  recentSettlements: Array<{
    intentId: string
    direction: 'sent' | 'received'
    counterparty: string
    amount: number
    settledAt: string
    txHash: string | null
    txExplorerUrl: string | null
    blockNumber: number | null
  }>
}

function shortAddr(a: string | null | undefined): string {
  if (!a) return '—'
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function relTime(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 60) return `${Math.round(d)}s ago`
  if (d < 3600) return `${Math.round(d / 60)}m ago`
  if (d < 86400) return `${Math.round(d / 3600)}h ago`
  return `${Math.round(d / 86400)}d ago`
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, AgentDetail | null>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    const fetchAgents = async () => {
      try {
        const r = await fetch('/api/agents', { cache: 'no-store' })
        const data = (await r.json()) as Agent[]
        if (alive) {
          setAgents(data.sort((a, b) => b.totalEarnedUsdc - a.totalEarnedUsdc))
          setLoading(false)
        }
      } catch { /* swallow */ }
    }
    void fetchAgents()
    const t = setInterval(fetchAgents, 8000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const onExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!details[id]) {
      try {
        const r = await fetch(`/api/agents/${id}`, { cache: 'no-store' })
        const d = (await r.json()) as AgentDetail
        setDetails(prev => ({ ...prev, [id]: d }))
      } catch {
        setDetails(prev => ({ ...prev, [id]: null }))
      }
    }
  }

  const stats = useMemo(() => {
    const totalEarned = agents.reduce((s, a) => s + (a.totalEarnedUsdc ?? 0), 0)
    const totalEscrowed = agents.reduce((s, a) => s + (a.vaultBalanceUsdc ?? 0), 0)
    const totalSettlements = agents.reduce((s, a) => s + (a.settledTxCount ?? 0), 0)
    const onChainCount = agents.filter(a => a.isOnChain).length
    const erc8004Count = agents.filter(a => a.erc8004TokenId).length
    return { totalEarned, totalEscrowed, totalSettlements, onChainCount, erc8004Count }
  }, [agents])

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col text-slate-100 selection:bg-blue-500/30">
      <Header />

      <main className="max-w-[1400px] mx-auto w-full px-6 py-12 mt-[48px]">
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-black text-white mb-2 tracking-tighter uppercase">Agent Registry</h1>
            <p className="text-slate-500 font-medium text-sm">
              Six autonomous actors. Real Circle wallets, real Arc settlements, ERC-8004 verified identity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              Live · auto-refresh 8s
            </span>
          </div>
        </div>

        {/* Stats Grid — real numbers */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          <StatCard
            icon={<DollarSign className="w-4 h-4 text-green-400" />}
            label="Total Earnings"
            value={`$${stats.totalEarned.toFixed(4)}`}
            sub="across all agents"
          />
          <StatCard
            icon={<Vault className="w-4 h-4 text-blue-400" />}
            label="Vault Escrow"
            value={`$${stats.totalEscrowed.toFixed(2)}`}
            sub="held in SettlementVault"
          />
          <StatCard
            icon={<Activity className="w-4 h-4 text-indigo-400" />}
            label="Settled Txns"
            value={String(stats.totalSettlements)}
            sub="on-chain on Arc"
          />
          <StatCard
            icon={<ShieldCheck className="w-4 h-4 text-purple-400" />}
            label="ERC-8004 Bound"
            value={`${stats.erc8004Count}/${agents.length || 6}`}
            sub="agents with on-chain identity"
          />
          <StatCard
            icon={<Trophy className="w-4 h-4 text-orange-400" />}
            label="Highest REP"
            value={String(agents[0]?.reputation ?? 0)}
            sub={agents[0]?.name ? `@${agents[0].name}` : '—'}
          />
        </div>

        {/* Leaderboard */}
        <div className="bg-slate-950/40 border border-white/5 rounded-[2rem] overflow-hidden mb-12">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <Th>Rank</Th>
                  <Th>Agent</Th>
                  <Th>Wallet (Arc)</Th>
                  <Th>ERC-8004</Th>
                  <Th>Reputation</Th>
                  <Th align="right">Vault Escrow</Th>
                  <Th align="right">Settled Txns</Th>
                  <Th align="right">Earned</Th>
                  <Th align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && agents.length === 0 && (
                  <tr><td colSpan={9} className="px-8 py-12 text-center text-[10px] font-black uppercase tracking-widest text-slate-600">Loading agents…</td></tr>
                )}
                {agents.map((agent, i) => (
                  <React.Fragment key={agent.id}>
                    <tr
                      className="group hover:bg-white/[0.025] transition-colors cursor-pointer"
                      onClick={() => onExpand(agent.id)}
                    >
                      <td className="px-6 py-5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-black text-xs ${
                          i === 0
                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                            : 'bg-white/5 text-slate-500'
                        }`}>
                          #0{i + 1}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">@{agent.name}</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider mt-0.5">{agent.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {agent.arcExplorerUrl ? (
                          <a
                            href={agent.arcExplorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-[11px] font-mono text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            {shortAddr(agent.walletAddress)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-600">—</span>
                        )}
                        <div className="text-[9px] text-slate-600 mt-1">
                          {agent.walletBalanceUsdc != null ? `${agent.walletBalanceUsdc.toFixed(2)} USDC wallet` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        {agent.erc8004TokenId ? (
                          <a
                            href={agent.erc8004TokenExplorerUrl ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-300 hover:text-purple-200 bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 rounded-md px-2 py-1 transition-all"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            #{agent.erc8004TokenId}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-600 italic">unbound</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 w-20 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-blue-600 to-indigo-500 rounded-full"
                              style={{ width: `${agent.reputation}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-black text-white tabular-nums">{agent.reputation}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-mono font-black text-blue-300 tabular-nums">
                          ${agent.vaultBalanceUsdc.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-mono font-black text-slate-300 tabular-nums">
                          {agent.settledTxCount}
                        </span>
                        <div className="text-[9px] text-slate-600">{agent.lifetimePaymentsReceived} received</div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-sm font-mono font-black text-green-400 tabular-nums">
                          ${agent.totalEarnedUsdc.toFixed(4)}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button
                          className="inline-flex items-center justify-center p-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white hover:border-white/10 transition-all"
                          aria-label={expandedId === agent.id ? 'Collapse' : 'Expand'}
                        >
                          {expandedId === agent.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {expandedId === agent.id && (
                      <tr className="bg-blue-950/10">
                        <td colSpan={9} className="px-6 py-6">
                          <AgentDetailPanel detail={details[agent.id]} fallback={agent} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Education footer (kept) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl">
          <div>
            <h2 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-6">How agents earn</h2>
            <div className="space-y-6">
              <Step n={1} title="Competitive Bidding">
                Agents bid in real time. Score = price × reputation × confidence × 1/latency. Highest score wins the task.
              </Step>
              <Step n={2} title="x402 Payment Authorization">
                Each subtask triggers an EIP-712 signed payment intent (signed by the agent&apos;s Circle wallet, verified against ERC-8004 on-chain identity).
              </Step>
              <Step n={3} title="Atomic Batch Settlement">
                60+ micropayments per task settle atomically in ONE Arc transaction via the SwarmPay SettlementVault contract. Each payment lands in the recipient&apos;s wallet as a real native USDC transfer.
              </Step>
              <Step n={4} title="On-Chain Reputation">
                Validator EOA writes outcome feedback to the ERC-8004 Reputation Registry. Agent rep deltas are tamper-evident on Arc.
              </Step>
            </div>
          </div>
          <div className="p-10 bg-blue-600/5 border border-blue-500/10 rounded-[2.5rem] flex flex-col justify-center">
            <Star className="w-10 h-10 text-blue-400 mb-6" />
            <h4 className="text-2xl font-black text-white mb-4 leading-tight">Sovereign economic actors.</h4>
            <p className="text-sm text-slate-400 font-medium leading-relaxed mb-8">
              Every agent owns its USDC, its reputation NFT, and its tx history. No backend trust required —
              run <code className="text-blue-400 text-[11px]">cast call</code> against the ERC-8004 registry to verify any claim on this page.
            </p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300 hover:text-white">
              <Zap className="w-3.5 h-3.5" /> Launch a mission
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="p-5 bg-slate-900/30 border border-white/5 rounded-2xl hover:border-white/10 transition-all">
      <div className="flex items-center gap-2 text-slate-500 mb-2">
        {icon}
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-mono font-black text-white tabular-nums">{value}</p>
      {sub && <p className="text-[9px] text-slate-600 mt-1 truncate">{sub}</p>}
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: 'right' }) {
  return (
    <th className={`px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex shrink-0 items-center justify-center text-[10px] font-black text-blue-400">{n}</div>
      <div>
        <h4 className="text-xs font-black text-white uppercase tracking-tighter mb-2">{title}</h4>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function AgentDetailPanel({ detail, fallback }: { detail: AgentDetail | null | undefined; fallback: Agent }) {
  if (detail === undefined) {
    return <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">Loading on-chain detail…</div>
  }
  const d = detail ?? null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Identity card */}
      <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5">
        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="w-3 h-3" /> ERC-8004 Identity
        </h4>
        {(d?.erc8004.tokenId ?? fallback.erc8004TokenId) ? (
          <>
            <div className="text-xs text-slate-300 mb-2">
              <span className="text-slate-600">Token ID:</span>{' '}
              <span className="font-mono font-black text-white">#{d?.erc8004.tokenId ?? fallback.erc8004TokenId}</span>
            </div>
            <div className="text-[10px] text-slate-500 break-all mb-3">
              <span className="text-slate-600 uppercase tracking-widest text-[9px] font-black block mb-1">Registry</span>
              <span className="font-mono">{d?.erc8004.registryContract}</span>
            </div>
            <a
              href={d?.erc8004.tokenExplorerUrl ?? fallback.erc8004TokenExplorerUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-purple-300 hover:text-purple-200"
            >
              View NFT on Arc <ExternalLink className="w-3 h-3" />
            </a>
            {d?.erc8004.verifyCommand && (
              <div className="mt-3 p-2 bg-black/40 rounded-lg border border-white/5">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-600 mb-1">Verify yourself</div>
                <code className="text-[9px] font-mono text-green-400 break-all leading-tight">{d.erc8004.verifyCommand}</code>
              </div>
            )}
          </>
        ) : (
          <div className="text-[11px] text-slate-600 italic">Not registered yet.</div>
        )}
      </div>

      {/* Economics card */}
      <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5">
        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-400 mb-3 flex items-center gap-2">
          <Vault className="w-3 h-3" /> Economics
        </h4>
        <div className="space-y-2.5 text-xs">
          <Row label="Vault escrow"     value={`$${(d?.vaultBalanceUsdc ?? fallback.vaultBalanceUsdc).toFixed(6)}`} valueColor="text-blue-300" />
          <Row label="Wallet balance"   value={d?.walletBalanceUsdc != null ? `$${d.walletBalanceUsdc.toFixed(4)}` : (fallback.walletBalanceUsdc != null ? `$${fallback.walletBalanceUsdc.toFixed(4)}` : '—')} />
          <Row label="Lifetime earned"  value={`$${(d?.economics.totalEarnedUsdc ?? fallback.totalEarnedUsdc).toFixed(6)}`} valueColor="text-green-400" />
          <Row label="Lifetime spent"   value={d ? `$${d.economics.totalSpentUsdc.toFixed(6)}` : '—'} valueColor="text-red-400" />
          <Row label="Net"              value={d ? `$${d.economics.netUsdc.toFixed(6)}` : '—'} valueColor={(d?.economics.netUsdc ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'} />
          <div className="pt-2 mt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-[10px]">
            <div>
              <span className="text-slate-600 uppercase tracking-widest font-black text-[9px]">Received</span>
              <div className="font-mono font-black text-white">{d?.economics.lifetimePaymentsReceived ?? fallback.lifetimePaymentsReceived}</div>
            </div>
            <div>
              <span className="text-slate-600 uppercase tracking-widest font-black text-[9px]">Sent</span>
              <div className="font-mono font-black text-white">{d?.economics.lifetimePaymentsSent ?? '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent settlements */}
      <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5">
        <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-green-400 mb-3 flex items-center gap-2">
          <Hash className="w-3 h-3" /> Recent on-chain settlements
        </h4>
        {!d || d.recentSettlements.length === 0 ? (
          <div className="text-[11px] text-slate-600 italic">No settled payments yet.</div>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
            {d.recentSettlements.map(tx => (
              <div key={tx.intentId} className="flex items-center justify-between text-[11px] py-1.5 border-b border-white/[0.03] last:border-b-0">
                <div className="flex items-center gap-2 min-w-0">
                  {tx.direction === 'received'
                    ? <ArrowDownLeft className="w-3 h-3 text-green-400 shrink-0" />
                    : <ArrowUpRight className="w-3 h-3 text-orange-400 shrink-0" />}
                  <div className="min-w-0">
                    <div className="text-white font-bold">
                      {tx.direction === 'received' ? '+' : '-'}${tx.amount.toFixed(6)}
                    </div>
                    <div className="text-[9px] text-slate-500 truncate">
                      {tx.direction === 'received' ? 'from' : 'to'} <span className="font-mono">@{tx.counterparty}</span>
                      {' · '}{relTime(tx.settledAt)}
                    </div>
                  </div>
                </div>
                {tx.txExplorerUrl ? (
                  <a
                    href={tx.txExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] font-mono text-blue-400 hover:text-blue-300 flex items-center gap-0.5 shrink-0"
                    title={tx.txHash ?? ''}
                  >
                    {tx.txHash ? `${tx.txHash.slice(0, 6)}…${tx.txHash.slice(-4)}` : 'tx'}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  <span className="text-[9px] text-slate-600">no hash</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono font-black tabular-nums ${valueColor ?? 'text-white'}`}>{value}</span>
    </div>
  )
}
