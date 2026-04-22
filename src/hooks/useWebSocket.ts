'use client';

import { useEffect, useState } from 'react';

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

    // 1. Initial State Load (Catch-up)
    fetch(`/api/tasks/${taskId}/payments`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setPayments(data);
      })
      .catch(err => console.error('[SSE] Initial fetch failed:', err));

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
            // Deduplicate
            if (prev.some(p => p.id === data.id)) return prev;
            return [{
              id: data.id ?? crypto.randomUUID(),
              fromAgent: data.fromAgent ?? 'Agent',
              fromAgentName: data.fromAgentName,
              toAgent: data.toAgent ?? 'Node',
              toAgentName: data.toAgentName,
              amount: data.amount ?? 0,
              timestamp: data.timestamp || Date.now()
            }, ...prev]
            .filter(p => p.amount > 0 && p.fromAgent !== 'Agent')
            .slice(0, 20);
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

    return () => {
      console.log('[SSE] closing connection');
      es.close();
      setConnected(false);
    };
  }, [taskId]);

  return { payments, connected };
}

// Keep legacy export for easier transition
export { usePaymentStream as useWebSocket };
