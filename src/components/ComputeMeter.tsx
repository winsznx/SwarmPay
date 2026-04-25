'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Cpu } from 'lucide-react'

interface ComputeTickEvent {
  taskId: string
  sessionId: string
  durationMs: number
  cost: number
  cpuPercent: number
  type: 'compute:tick' | 'compute:completed'
}

interface ComputeMeterProps {
  taskId: string | null
}

const COST_PER_MS = 0.000001 as const

/**
 * Live per-millisecond compute meter. Subscribes to compute:tick and
 * compute:completed events on the SSE stream for this task. Between
 * server ticks, interpolates the running ms timer + cost ticker at 60fps
 * via requestAnimationFrame so the numbers feel real.
 */
export const ComputeMeter: React.FC<ComputeMeterProps> = ({ taskId }) => {
  const [active, setActive] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cpuPct, setCpuPct] = useState(0)
  const [serverDuration, setServerDuration] = useState(0)
  const [serverCost, setServerCost] = useState(0)
  const lastTickAt = useRef<number>(0)
  const [displayDuration, setDisplayDuration] = useState(0)
  const [displayCost, setDisplayCost] = useState(0)
  const rafRef = useRef<number | null>(null)

  // SSE subscription
  useEffect(() => {
    if (!taskId) return
    const url = `/api/stream?taskId=${taskId}`
    const es = new EventSource(url)
    es.onmessage = (event) => {
      try {
        if (!event.data || event.data.startsWith(': heartbeat')) return
        const data = JSON.parse(event.data) as ComputeTickEvent
        if (data.type === 'compute:tick') {
          setActive(true)
          setCompleted(false)
          if (data.sessionId) setSessionId(data.sessionId)
          if (typeof data.durationMs === 'number') setServerDuration(data.durationMs)
          if (typeof data.cost === 'number') setServerCost(data.cost)
          if (typeof data.cpuPercent === 'number') setCpuPct(data.cpuPercent)
          lastTickAt.current = Date.now()
        } else if (data.type === 'compute:completed') {
          setActive(false)
          setCompleted(true)
          if (typeof data.durationMs === 'number') setServerDuration(data.durationMs)
          if (typeof data.cost === 'number') setServerCost(data.cost)
          // Hold the COMPLETE state for 5s, then idle.
          window.setTimeout(() => {
            setCompleted(false)
            setSessionId(null)
            setServerDuration(0)
            setServerCost(0)
            setCpuPct(0)
          }, 5000)
        }
      } catch { /* parse error — ignore */ }
    }
    es.onerror = () => { /* browser auto-reconnects */ }
    return () => es.close()
  }, [taskId])

  // 60fps interpolation between server ticks
  useEffect(() => {
    if (!active) {
      setDisplayDuration(serverDuration)
      setDisplayCost(serverCost)
      return
    }
    const tick = () => {
      const elapsed = Date.now() - lastTickAt.current
      const interpolatedMs = serverDuration + elapsed
      setDisplayDuration(interpolatedMs)
      setDisplayCost(serverCost + (elapsed * COST_PER_MS))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active, serverDuration, serverCost])

  const fmtMs = (ms: number) => {
    const s = (ms / 1000).toFixed(3)
    return s.padStart(8, '0')
  }
  const fmtCost = (c: number) => `$${c.toFixed(6)}`

  return (
    <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cpu className={`w-3.5 h-3.5 ${active ? 'text-yellow-400 animate-pulse' : completed ? 'text-green-400' : 'text-slate-600'}`} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Compute Meter</span>
        </div>
        <div className="text-[8px] font-mono text-slate-600">{sessionId ? sessionId.slice(0, 8) : '—'}</div>
      </div>

      {/* CPU semicircle gauge */}
      <div className="relative w-full max-w-[180px] mx-auto mb-3">
        <svg viewBox="0 0 100 56" className="w-full">
          <path d="M 6 50 A 44 44 0 0 1 94 50" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="4" />
          <path
            d="M 6 50 A 44 44 0 0 1 94 50"
            fill="none"
            stroke={active ? '#facc15' : completed ? '#22c55e' : '#64748b'}
            strokeWidth="4"
            strokeDasharray={`${(cpuPct / 100) * 138.2} 138.2`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 200ms ease-out' }}
          />
          <text x="50" y="44" textAnchor="middle" className="font-mono font-black" fontSize="14" fill={active ? '#facc15' : completed ? '#22c55e' : '#475569'}>
            {Math.round(cpuPct)}%
          </text>
        </svg>
        <div className="text-center text-[8px] font-bold text-slate-500 uppercase tracking-widest -mt-1">CPU</div>
      </div>

      {/* Timer */}
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest border-t border-white/5 pt-3">
        <span>Elapsed</span>
        <span className="font-mono text-blue-400 text-sm tabular-nums">{fmtMs(displayDuration)}<span className="text-slate-600 text-[9px] ml-1">s</span></span>
      </div>
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">
        <span>Cost (rate $0.000001/ms)</span>
        <span className="font-mono text-green-400 text-sm tabular-nums">{fmtCost(displayCost)}</span>
      </div>

      <div className="mt-3 text-[9px] text-center font-black uppercase tracking-widest">
        {active && <span className="text-yellow-400 animate-pulse">Running</span>}
        {completed && <span className="text-green-400">Complete · final values frozen</span>}
        {!active && !completed && <span className="text-slate-600">Awaiting compute request</span>}
      </div>
    </div>
  )
}
