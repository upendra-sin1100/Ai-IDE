import { useState, useCallback } from "react";

export function useChatStream(apiUrl = "http://localhost:8000/api") {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(async (text, activeFileContext = null) => {
    if (!text.trim()) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: text };
    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMessage = { id: assistantMessageId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = localStorage.getItem("ai-ide-gemini-key") || "";
      const selectedModel = localStorage.getItem("ai-ide-selected-model") || "gemini-1.5-pro";

      const response = await fetch(`${apiUrl}/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          message: text,
          model: selectedModel,
          context: activeFileContext ? { filename: activeFileContext.filename, code: activeFileContext.content } : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + chunk }
              : msg
          )
        );
      }
    } catch (err) {
      console.error("Stream response error:", err);
      setError(err.message || "Failed to reach AI Backend");
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: msg.content + "\n\n⚠️ *Error generating response. Please check your API keys or backend status.*" }
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