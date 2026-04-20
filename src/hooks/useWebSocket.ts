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
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<any>(null);

  useEffect(() => {
    if (!taskId) return;

    function connect() {
      const ws = new WebSocket(`ws://localhost:3006?taskId=${taskId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS CLIENT] connected for task:', taskId);
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS CLIENT] received:', data.type, data);
          if (data.type === 'payment:intent') {
            setPayments(prev => [{
              id: data.id,
              fromAgent: data.fromAgent,
              fromAgentName: data.fromAgentName,
              toAgent: data.toAgent,
              toAgentName: data.toAgentName,
              amount: data.amount,
              timestamp: data.timestamp
            }, ...prev].slice(0, 50));
          }
        } catch (e) {
          console.error('[WS CLIENT] parse error:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS CLIENT] disconnected, reconnecting in 2s...');
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 2000);
      };

      ws.onerror = (e) => {
        console.error('[WS CLIENT] error:', e);
      };
    }

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [taskId]);

  return { payments, connected };
}

// Keep legacy export for easier transition
export { usePaymentStream as useWebSocket };
