import React, { useEffect, useRef } from 'react';
import { Sparkles, Send, Bot, User, Cpu, GripHorizontal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ThinkingBlock from './ThinkingBlock';

export default function ChatPanel({ messages, input, setInput, onSendMessage }) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="w-[400px] h-full flex flex-col bg-[#0f0f0f] border-l border-white/5 text-neutral-200 shadow-[-20px_0_30px_rgba(0,0,0,0.3)] z-20 shrink-0">
      {/* Header */}
      <div className="h-14 px-5 border-b border-white/5 flex items-center justify-between font-medium bg-gradient-to-r from-[#0f0f0f] to-[#141414] select-none">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 shadow-[0_0_15px_rgba(147,51,234,0.3)]">
            <Sparkles size={16} className="text-white" />
            <div className="absolute inset-0 rounded-lg bg-white/20 mix-blend-overlay"></div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-blue-200">AI Co-Pilot</span>
            <span className="text-[10px] text-green-400 flex items-center gap-1 font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
              Online
            </span>
          </div>
        </div>
        <button className="text-neutral-500 hover:text-neutral-300 transition-colors p-1.5 rounded-md hover:bg-white/5">
          <GripHorizontal size={18} />
        </button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.map((msg, index) => (
          <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            
            <div className="flex items-center gap-2 mb-1.5 px-1 opacity-70">
              {msg.role === 'user' ? (
                <>
                  <span className="text-[11px] font-medium text-neutral-400">You</span>
                  <User size={12} className="text-neutral-400" />
                </>
              ) : (
                <>
                  <Bot size={12} className="text-purple-400" />
                  <span className="text-[11px] font-medium text-purple-400">Co-Pilot</span>
                </>
              )}
            </div>

            <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm relative ${
              msg.role === 'user' 
                ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-tr-sm border border-purple-500/30' 
                : 'bg-[#1a1a1a] text-neutral-200 rounded-tl-sm border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]'
            }`}>
              
              {/* Render Thinking Block if it exists */}
              {msg.thinking && <ThinkingBlock content={msg.thinking} />}
              
              {/* Render Main Content */}
              <div className={`prose max-w-none text-sm leading-relaxed ${msg.role === 'user' ? 'prose-invert prose-p:text-white' : 'prose-invert prose-p:text-neutral-300 prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-white/10'}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-4 bg-gradient-to-t from-[#0a0a0a] to-transparent">
        <form 
          onSubmit={onSendMessage} 
          className="relative flex items-end gap-2 bg-[#1a1a1a] border border-white/10 rounded-xl p-1.5 focus-within:border-purple-500/50 focus-within:shadow-[0_0_20px_rgba(147,51,234,0.15)] transition-all duration-300"
        >
          <div className="absolute left-3 top-3 text-neutral-500">
            <Cpu size={18} />
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage(e);
              }
            }}
            placeholder="Ask AI to write or debug code..."
            className="flex-1 bg-transparent border-none px-9 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-0 resize-none min-h-[40px] max-h-[120px] scrollbar-thin scrollbar-thumb-white/10"
            rows={1}
            style={{ height: input ? 'auto' : '40px' }}
          />
          <button 
            type="submit" 
            disabled={!input.trim()}
            className="mb-0.5 mr-0.5 bg-purple-600 disabled:bg-neutral-800 hover:bg-purple-500 disabled:text-neutral-600 text-white p-2.5 rounded-lg transition-all duration-200 group shrink-0 shadow-[0_2px_10px_rgba(147,51,234,0.2)] disabled:shadow-none"
          >
            <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </form>
        <div className="text-center mt-2 text-[10px] text-neutral-600 font-medium tracking-wide">
          AI can make mistakes. Verify code before deploying.
        </div>
      </div>
    </div>
  );
}