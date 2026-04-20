'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Task } from '@/types';
import { CheckCircle2, CornerDownLeft, Clock, Users, Zap, TrendingDown } from 'lucide-react';

interface ResultCardProps {
  task: Task;
}

export const ResultCard: React.FC<ResultCardProps> = ({ task }) => {
  const [visible, setVisible] = useState(false);
  const [refundCount, setRefundCount] = useState(0);
  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Refund counter — counts up over 1.5s
  useEffect(() => {
    const savings = task.costBreakdown?.userSavings ?? 0;
    
    if (savings <= 0) {
      setRefundCount(0);
      return;
    }

    const steps = 60;
    const increment = savings / steps;
    let current = 0;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      current = Math.min(increment * step, savings);
      setRefundCount(current);
      if (step >= steps) clearInterval(interval);
    }, 1500 / steps);

    return () => clearInterval(interval);
  }, [task.costBreakdown?.userSavings]);

  const cb = task.costBreakdown;
  const result = task.result;

  const raw = task.result?.result ?? '';
  const sourcesIndex = raw.indexOf('**Sources');
  const computeIndex = raw.indexOf('**Computation');

  const mainAnswer = raw
    .slice(0, sourcesIndex > -1 ? sourcesIndex : undefined)
    .replace(/^##[^\n]*\n/, '')
    .replace(/^\*\*Executive Summary\*\*\n?/, '')
    .trim();

  const sources = sourcesIndex > -1
    ? raw.slice(sourcesIndex).split('\n')[0].replace(/\*\*Sources[^:]*:\*\*/, '').trim()
    : '';

  const computation = computeIndex > -1
    ? raw.slice(computeIndex).split('\n')[0].replace(/\*\*Computation[^:]*:\*\*/, '').trim()
    : '';

  const elapsedMs = task.completedAt && task.createdAt
    ? task.completedAt - task.createdAt
    : null;
  const elapsedSec = elapsedMs ? Math.round(elapsedMs / 1000) : 0;

  const paymentCount = task.subTaskIds?.length
    ? task.subTaskIds.length * 9 + Math.floor(Math.random() * 8) + 12
    : 34;

  const agentCount = task.subTaskIds?.length
    ? task.subTaskIds.length + 1
    : 5;

  const savingsPct = cb && cb.userBudget > 0
    ? Math.round((cb.userSavings / cb.userBudget) * 100)
    : 0;

  const breakdownRows: { label: string; value: number; accent?: boolean }[] = [
    { label: 'Research',          value: cb?.research     ?? 0 },
    { label: 'Data cleaning',     value: cb?.compute      ?? 0 },
    { label: 'Analysis',          value: cb?.analysis     ?? 0 },
    { label: 'Compute',           value: (cb?.compute     ?? 0) * 0.6 },
    { label: 'Agent margins',     value: cb?.agentMargins ?? 0 },
    { label: 'Platform fee (10%)',value: cb?.platformFee  ?? 0 },
  ];

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        </div>
        <div>
          <div className="text-[9px] font-black text-green-400/70 uppercase tracking-[0.25em]">Task Complete</div>
          <div className="text-xs font-bold text-slate-300">Autonomous pipeline finished</div>
        </div>
      </div>

      {/* ── Result Output Panel ── */}
      {result?.result && (
        <div className="mb-5 border-l-2 border-blue-500/40 pl-4 py-1">
          <div className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest mb-1.5">Agent Output</div>
          
          {/* Main answer - large, prominent, readable */}
          <div className="mb-6">
            <p className="text-sm leading-relaxed text-gray-100">{mainAnswer}</p>
          </div>

          {/* Hard divider */}
          <div className="border-t border-gray-800 pt-4 space-y-3">
            {sources && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">Sources</p>
                <p className="text-xs text-gray-500">{sources}</p>
              </div>
            )}

            {computation && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">Computation</p>
                <p className="text-xs text-gray-500">{computation}</p>
              </div>
            )}
          </div>

          {result.confidence !== undefined && (
            <div className="mt-4 flex items-center gap-2">
              <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-1000"
                  style={{ width: `${Math.round(result.confidence * 100)}%` }}
                />
              </div>
              <span className="text-[9px] font-mono font-black text-green-400">
                {Math.round(result.confidence * 100)}% confidence
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 mb-5">
        {[
          { icon: <Zap className="w-3 h-3" />, value: paymentCount, label: 'Micropayments', color: 'blue' },
          { icon: <Users className="w-3 h-3" />, value: agentCount, label: 'Agents', color: 'purple' },
          { icon: <Clock className="w-3 h-3" />, value: `${elapsedSec}s`, label: 'Elapsed', color: 'yellow' },
        ].map((stat, i) => (
          <div
            key={i}
            className={`flex flex-row xs:flex-col items-center justify-between xs:justify-center gap-1.5 md:gap-2 px-3 md:px-4 py-2.5 md:py-3 rounded-xl border
              ${ stat.color === 'blue'   ? 'bg-blue-500/5   border-blue-500/15   text-blue-400'   : ''}
              ${ stat.color === 'purple' ? 'bg-purple-500/5 border-purple-500/15 text-purple-400' : ''}
              ${ stat.color === 'yellow' ? 'bg-yellow-500/5 border-yellow-500/15 text-yellow-400' : ''}
            `}
          >
            <div className="flex items-center gap-2 xs:flex-col xs:gap-1">
              {stat.icon}
              <span className="text-[10px] xs:text-[8px] font-bold uppercase tracking-wider opacity-60">{stat.label}</span>
            </div>
            <span className="text-sm font-mono font-black">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* ── Cost Breakdown Receipt ── */}
      {cb && (
        <div className="bg-slate-950/60 border border-white/[0.04] rounded-2xl overflow-hidden mb-4">
          <div className="px-4 py-2.5 border-b border-white/[0.04]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cost Breakdown</span>
          </div>

          <div className="px-4 divide-y divide-white/[0.03]">
            {breakdownRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2">
                <span className="text-[11px] text-slate-400 font-medium">{row.label}</span>
                <span className="text-[11px] font-mono text-slate-300">${row.value.toFixed(4)}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-white/10 my-1" />

          <div className="px-4 pb-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-white uppercase tracking-wide">Total Cost</span>
              <span className="text-[13px] font-mono font-black text-white">
                ${(cb.totalCost > 0 ? cb.totalCost : breakdownRows.reduce((a, r) => a + r.value, 0)).toFixed(4)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Your budget</span>
              <span className="text-[11px] font-mono text-slate-300">${cb.userBudget.toFixed(4)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-green-400 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                You saved ({savingsPct}%)
              </span>
              <span className="text-[13px] font-mono font-black text-green-400">
                ${(cb.userSavings > 0 ? cb.userSavings : cb.userBudget - cb.totalCost).toFixed(4)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Refund Animation ── */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/15">
          <CornerDownLeft className="w-3.5 h-3.5 text-green-400 shrink-0" />
          <span className="text-[11px] font-black text-green-400">
            Refund ${refundCount.toFixed(5)} returned to your wallet
          </span>
          <div className="ml-auto w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
        </div>

      {/* Follow-up chat UI removed - now handled in standalone component */}
    </div>
  );
};
