import { getApiUrl } from "./client";
import { getSupabaseAccessToken } from "../lib/supabase";

export async function openTerminalSocket(onData, onOpen, onClose, onError) {
  const wsUrl = getApiUrl("/terminal/ws").replace(/^http/, "ws");
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error("Authentication is required for terminal sessions.");

  const socket = new WebSocket(`${wsUrl}?access_token=${encodeURIComponent(token)}`);

  socket.onopen = () => {
    if (onOpen) onOpen();
  };

  socket.onmessage = (event) => {
    if (onData) onData(event.data);
  };

  socket.onclose = (event) => {
    if (onClose) onClose(event);
  };

  socket.onerror = (err) => {
    if (onError) onError(err);
  };

  return {
    send: (data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    },
    close: () => {
      socket.close();
    },
  };
}
