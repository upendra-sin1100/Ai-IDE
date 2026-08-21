import { useState, useEffect, useRef, useCallback } from "react";

export function useTerminal(onData, runConfig = null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    setError(null);
    wsRef.current?.close();

    const isRun = Boolean(runConfig);
    const endpoint = isRun
      ? "ws://127.0.0.1:8000/api/terminal/run_ws"
      : "ws://127.0.0.1:8000/api/terminal/ws";

    const ws = new WebSocket(endpoint);

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      if (isRun && runConfig) {
        ws.send(JSON.stringify(runConfig));
      }
    };

    ws.onmessage = (event) => {
      if (onData) onData(event.data);
    };

    ws.onerror = () => {
      setError(isRun ? "Failed to start interactive execution session." : "Failed to connect to backend terminal session.");
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
    };

    wsRef.current = ws;
  }, [onData, runConfig ? JSON.stringify(runConfig) : null]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const sendInput = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  const closeSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return { connected, error, sendInput, reconnect: connect, closeSession };
}