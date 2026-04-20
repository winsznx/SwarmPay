'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [isPolling, setIsPolling] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<any>(null);
  const pollingRef = useRef<any>(null);

  useEffect(() => {
    if (!taskId) return;

    // 1. Initial Data Load
    fetch(`/api/tasks/${taskId}/payments`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setPayments(data))
      .catch(err => console.error('[STREAM] Initial fetch failed:', err));

    function startPolling() {
      if (pollingRef.current) return;
      console.log('[STREAM] Starting polling fallback for task:', taskId);
      setIsPolling(true);
      
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/tasks/${taskId}/payments`);
          if (res.ok) {
            const data = await res.json();
            setPayments(data);
          }
        } catch (e) {
          console.error('[STREAM] Polling error:', e);
        }
      }, 3000);
    }

    function stopPolling() {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
        setIsPolling(false);
      }
    }

    function connect() {
      // Use current window host instead of hardcoded localhost
      const host = window.location.hostname;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${host}:3006?taskId=${taskId}`;
      
      console.log('[STREAM] Attempting transition to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[STREAM] WebSocket connected. Disabling polling.');
        setConnected(true);
        stopPolling();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'payment:intent') {
            setPayments(prev => {
               const exists = prev.some(p => p.id === data.id);
               if (exists) return prev;
               return [{
                 id: data.id,
                 fromAgent: data.fromAgent,
                 fromAgentName: data.fromAgentName,
                 toAgent: data.toAgent,
                 toAgentName: data.toAgentName,
                 amount: data.amount,
                 timestamp: data.timestamp
               }, ...prev].slice(0, 50);
            });
          }
        } catch (e) {
          console.error('[STREAM] parse error:', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        // If WebSocket closes (or fails to start), fallback to polling
        startPolling();
        
        // Try to reconnect WS every 10s if not on Vercel (best effort)
        // Note: On Vercel this will always fail, which is fine as polling is now active.
        reconnectRef.current = setTimeout(connect, 10000);
      };

      ws.onerror = (e) => {
        // ws.onerror is usually followed by ws.onclose
        console.warn('[STREAM] WebSocket unavailable (expected on Vercel).');
      };
    }

    // Start with polling fallback immediately for better UX
    startPolling();
    
    // Then attempt WebSocket connection
    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      stopPolling();
      wsRef.current?.close();
    };
  }, [taskId]);

  return { payments, connected, isPolling };
}

export { usePaymentStream as useWebSocket };
