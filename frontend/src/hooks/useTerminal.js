import { useState, useEffect, useRef, useCallback } from "react";
import { getSupabaseAccessToken } from "../lib/supabase";
import { getApiUrl, getBaseUrl } from "../api/client";

export function useTerminal(onData, runConfig = null) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const pendingInputRef = useRef([]);

  const connect = useCallback(() => {
    wsRef.current?.close();
    let cancelled = false;

    const isRun = Boolean(runConfig);
    const apiUrl = getBaseUrl();
    const endpoint = isRun
      ? getApiUrl("/terminal/run_ws").replace(/^http/, "ws")
      : getApiUrl("/terminal/ws").replace(/^http/, "ws");

    getSupabaseAccessToken().then(async (token) => {
      if (cancelled) return;
      if (!token) {
        setError("Authentication is required for terminal sessions.");
        return;
      }

      const backendOrigin = apiUrl.replace(/\/api\/?$/, "");
      try {
        await fetch(`${backendOrigin}/`, { cache: "no-store" });
      } catch {
        // The WebSocket attempt below reports the actionable connection error.
      }
      if (cancelled) return;

      const ws = new WebSocket(`${endpoint}?access_token=${encodeURIComponent(token)}`);

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        if (isRun && runConfig) {
          ws.send(JSON.stringify(runConfig));
        }
        pendingInputRef.current.splice(0).forEach((message) => ws.send(JSON.stringify(message)));
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
    });

    return () => {
      cancelled = true;
    };
  }, [onData, runConfig]);

  useEffect(() => {
    const cancelConnect = connect();
    return () => {
      cancelConnect?.();
      wsRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      pendingInputRef.current.push(message);
    }
  }, []);

  const sendInput = useCallback((data) => {
    sendMessage({ type: "input", data });
  }, [sendMessage]);

  const sendResize = useCallback((cols, rows) => {
    sendMessage({ type: "resize", cols, rows });
  }, [sendMessage]);

  const closeSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  }, []);

  return { connected, error, sendInput, sendResize, reconnect: connect, closeSession };
}