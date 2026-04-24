'use client';

import { useEffect, useState } from 'react';
import { loadPaymentsFromSupabase } from '@/lib/supabase';

export interface PaymentEvent {
  id: string;
  fromAgent: string;
  fromAgentName?: string;
  toAgent: string;
  toAgentName?: string;
  amount: number;
  timestamp: number;
}

export function usePaymentStream(taskId: string | null | undefined) {
  const [payments, setPayments] = useState<PaymentEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    if (taskId !== 'global') {
      // 1. Initial State Load (Catch-up) - only for specific tasks
      fetch(`/api/tasks/${taskId}/payments`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) {
            setPayments(data);
          } else {
            loadPaymentsFromSupabase(taskId).then(supabasePayments => {
              if (supabasePayments.length > 0) setPayments(supabasePayments);
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    // 2. Initialize EventSource for real-time stream
    const url = `/api/stream?taskId=${taskId}`;
    console.log('[SSE] Connecting to stream:', url);
    const es = new EventSource(url);

    es.onopen = () => {
      console.log('[SSE] connected for task:', taskId);
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        if (!event.data || event.data.startsWith(': heartbeat')) return;
        
        const data = JSON.parse(event.data);
        console.log('[SSE] received:', data.type);
        
        if (data.type === 'payment:intent') {
          setPayments(prev => {
            const id = data.id ?? crypto.randomUUID();
            if (prev.some(p => p.id === id)) return prev;
            
            return [{
              id,
              fromAgent: data.fromAgentName ?? data.fromAgent ?? 'Agent',
              toAgent: data.toAgentName ?? data.toAgent ?? 'Node',
              amount: data.amount ?? 0,
              timestamp: data.timestamp ?? Date.now()
            }, ...prev].filter(p => p.amount > 0).slice(0, 50);
          });
        }

      } catch (e) {
        console.error('[SSE] parse error:', e);
      }
    };

    es.onerror = (e) => {
      console.warn('[SSE] connection error, browser will auto-reconnect.');
      setConnected(false);
    };

    // 3. Fallback Polling (For Vercel Serverless instances where SSE EventEmitter might be isolated)
    // We poll every 2s to ensure we get payments even if SSE fails to broadcast across instances
    const pollInterval = setInterval(() => {
      const pollUrl = taskId === 'global' ? '/api/payments/recent' : `/api/tasks/${taskId}/payments`;
      fetch(pollUrl)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          if (data && data.length > 0) {
            setPayments(prev => {
              // Merge and deduplicate
              const merged = [...data];
              prev.forEach(p => {
                if (!merged.some(m => m.id === p.id)) merged.push(p);
              });
              return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
            });
          }
        })
        .catch(() => {});
    }, 2500);

    return () => {
      console.log('[SSE] closing connection');
      es.close();
      setConnected(false);
      clearInterval(pollInterval);
    };
  }, [taskId]);

  return { payments, connected };
}

// Keep legacy export for easier transition
export { usePaymentStream as useWebSocket };
