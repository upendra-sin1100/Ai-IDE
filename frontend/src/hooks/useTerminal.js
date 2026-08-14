import { useState, useEffect, useRef, useCallback } from "react";
import { openTerminalSocket } from "../api/terminal";

export function useTerminal(onDataReceived) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  const connect = useCallback(() => {
    if (socketRef.current) return;

    socketRef.current = openTerminalSocket(
      (data) => {
        if (onDataReceived) onDataReceived(data);
      },
      () => {
        setConnected(true);
        setError(null);
      },
      () => {
        setConnected(false);
        socketRef.current = null;
      },
      (err) => {
        setError("Terminal connection failed");
        setConnected(false);
      }
    );
  }, [onDataReceived]);

  const sendInput = useCallback((data) => {
    if (socketRef.current) {
      socketRef.current.send(data);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    error,
    sendInput,
    reconnect: connect,
  };
}
