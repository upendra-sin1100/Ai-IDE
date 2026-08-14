import React, { useState, useRef, useEffect } from "react";
import { useChatStream } from "../../hooks/useChatStream";

export function ChatPanel({ activeFile = { filename: "App.jsx", content: "// Workspace content" } }) {
  const { messages, isLoading, sendMessage, clearMessages } = useChatStream();
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;
    sendMessage(inputText, activeFile);
    setInputText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const triggerQuickAction = (promptPrefix) => {
    const fullPrompt = `${promptPrefix} for file ${activeFile.filename}`;
    sendMessage(fullPrompt, activeFile);
  };

  return (
    <aside className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
      {/* Top Header */}
      <div className="h-10 px-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span className="text-xs font-semibold tracking-wide text-slate-200 uppercase">AI Assistant</span>
        </div>
        <button
          onClick={clearMessages}
          title="Clear Conversation"
          className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition text-xs flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Context Badge */}
      <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span>Active Context:</span>
        <span className="font-mono text-cyan-400 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
          {activeFile.filename}
        </span>
      </div>

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3 px-4">
            <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-cyan-400 text-lg">
              ✨
            </div>
            <p className="text-xs">Ask questions, request code refactoring, or generate unit tests.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <span className="text-[10px] text-slate-500 mb-1 px-1">
                {msg.role === "user" ? "You" : "AI"}
              </span>
              <div
                className={`p-2.5 rounded-lg max-w-[90%] whitespace-pre-wrap leading-relaxed ${msg.role === "user"
                    ? "bg-cyan-600 text-white rounded-br-none"
                    : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none font-mono"
                  }`}
              >
                {msg.content || (isLoading && <span className="animate-pulse">Thinking...</span>)}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompt Actions */}
      <div className="px-2 py-1.5 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button onClick={() => triggerQuickAction("Explain code")} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition">
          ✨ Explain
        </button>
        <button onClick={() => triggerQuickAction("Refactor code")} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition">
          🔧 Refactor
        </button>
        <button onClick={() => triggerQuickAction("Write tests")} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition">
          🧪 Test
        </button>
        <button onClick={() => triggerQuickAction("Add docs")} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] whitespace-nowrap transition">
          📝 Document
        </button>
      </div>

      {/* Input Box Form */}
      <form onSubmit={handleSend} className="p-2 border-t border-slate-800 bg-slate-950">
        <div className="relative flex items-center">
          <textarea
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI anything... (Ctrl+Enter)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-2.5 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="absolute right-2 p-1 text-cyan-400 disabled:text-slate-600 hover:text-cyan-300 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </aside>
  );
}