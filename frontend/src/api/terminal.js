import { getBaseUrl } from "./client";

export function openTerminalSocket(onData, onOpen, onClose, onError) {
  const httpUrl = getBaseUrl();
  const wsUrl = httpUrl.replace(/^http/, "ws") + "/terminal/ws";

  const socket = new WebSocket(wsUrl);

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
