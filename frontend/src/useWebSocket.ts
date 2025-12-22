import { useEffect, useRef, useState } from 'react';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const listeners = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);

        // Notify type-specific listeners
        const typeListeners = listeners.current.get(message.type);
        if (typeListeners) {
          typeListeners.forEach((callback) => callback(message));
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const on = (type: string, callback: (data: any) => void) => {
    if (!listeners.current.has(type)) {
      listeners.current.set(type, new Set());
    }
    listeners.current.get(type)!.add(callback);

    return () => {
      listeners.current.get(type)?.delete(callback);
    };
  };

  const send = (message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  return { isConnected, lastMessage, on, send };
}
