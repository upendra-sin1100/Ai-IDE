import { useState, useCallback } from "react";
import { getAuthHeaders, getBaseUrl } from "../api/client";

export function useChatStream(apiUrl = getBaseUrl()) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (text, openFiles = [], activeFile = null) => {
    if (!text.trim()) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: text };
    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMessage = { id: assistantMessageId, role: "assistant", content: "", proposedEdit: null };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const selectedModel = localStorage.getItem("ai-ide-selected-model") || "gemini-3.6-flash";

      const formattedOpenFiles = openFiles.map(f => ({
        path: typeof f === "string" ? f : f.path,
        content: typeof f === "string" ? "" : (f.content || ""),
      }));

      const headers = await getAuthHeaders();
      const response = await fetch(`${apiUrl}/chat/stream`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          model: selectedModel,
          open_files: formattedOpenFiles,
          active_file: activeFile,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const dataLine = line.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;

          const dataStr = dataLine.slice(5).trim();
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === "error") {
              setError(parsed.delta);
            } else if (parsed.type === "create_file" || parsed.type === "proposed_edit") {
              const action = parsed.action || parsed.edit;
              if (action) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, proposedEdit: action }
                      : msg
                  )
                );
              }
            } else if (parsed.delta) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: msg.content + parsed.delta }
                    : msg
                )
              );
            }
          } catch {
            // ignore malformed SSE
          }
        }
      }
    } catch (err) {
      console.error("Stream response error:", err);
      setError(err.message || "Failed to reach AI Backend");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + "\n\n⚠️ *Error generating response. Please check backend status.*" }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}