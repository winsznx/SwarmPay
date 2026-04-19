'use client';

import { useState, useEffect } from 'react';
import { PaymentIntent } from '@/types';

/**
 * useWebSocket Hook (Simulated for Phase 5/6 Demo)
 * Wraps an in-memory event bus/polling system with a WebSocket-like interface.
 */
export function useWebSocket(taskId?: string) {
  const [lastPayment, setLastPayment] = useState<PaymentIntent | null>(null);

  useEffect(() => {
    if (!taskId) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      console.log(`🔌 [WS] Connecting for task: ${taskId} on port 3006`);
      socket = new WebSocket(`ws://localhost:3006?taskId=${taskId}`);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'payment:intent') {
            setLastPayment(data);
          }
          
          // Handle other event types if needed (broadcast to other hooks/contexts)
          if (data.type === 'task:completed') {
            console.log('✅ [WS] Task completed notification received.');
          }
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      socket.onclose = () => {
        console.log('⚠️ [WS] Connection lost. Reconnecting in 2s...');
        reconnectTimeout = setTimeout(connect, 2000);
      };

      socket.onerror = (err) => {
        console.error('[WS] Connection error:', err);
        socket?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (socket) {
        socket.onclose = null; // Prevent reconnect on intentional close
        socket.close();
      }
    };
  }, [taskId]);

  return { lastPayment };
}
