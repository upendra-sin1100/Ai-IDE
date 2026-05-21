import { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";

const INITIAL_CODE = `// Welcome to AI IDE Pro
// Start coding and let AI assist you

function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Generate first 10 fibonacci numbers
const sequence = Array.from({ length: 10 }, (_, i) => fibonacci(i));
console.log("Fibonacci:", sequence);

export default fibonacci;
`;

const MESSAGES = [
  {
    role: "assistant",
    thinking:
      "Analyzing workspace... The user has a basic JavaScript file open. Preparing to assist with multi-model capability.",
    content:
      "Hello! I'm your AI copilot. I've analyzed your workspace — you have a `fibonacci` function open. Want me to optimize it with memoization or add TypeScript types?",
  },
];

const FILES = [
  { name: "index.js", lang: "JS", color: "#f0db4f" },
  { name: "utils.ts", lang: "TS", color: "#3178c6" },
  { name: "styles.css", lang: "CSS", color: "#264de4" },
  { name: "README.md", lang: "MD", color: "#83a598" },
];

const SUGGESTIONS = ["Optimize code", "Add TS types", "Write tests", "Explain this"];

const MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "Groq" },
  { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", badge: "Groq" },
  { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B", badge: "Groq" },
  { id: "gemma2-9b-it", label: "Gemma 2 9B", badge: "Groq" },
];

const NAV = [
  {
    id: "files", label: "Explorer",
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
  },
  {
    id: "search", label: "Search",
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5l4 4" strokeLinecap="round" /></svg>
  },
  {
    id: "git", label: "Source Control",
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><path d="M8.5 6h5M6 8.5v7" strokeLinecap="round" /></svg>
  },
  {
    id: "extensions", label: "Extensions",
    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v6m0 0H3m6 0h12m0 0v10a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m18-6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  },
];

/* ── helpers ── */
function langFromFile(name) {
  if (name.endsWith(".ts")) return "typescript";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".md")) return "markdown";
  return "javascript";
}

/* ── sub-components ── */

function ThinkingBubble({ text }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)",
          borderRadius: 6, padding: "3px 10px 3px 8px", cursor: "pointer",
          color: "#a78bfa", fontSize: 11, fontFamily: "inherit", letterSpacing: "0.03em",
        }}
      >
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Thinking {open ? "▲" : "▼"}
      </button>
      {open && (
        <div style={{
          marginTop: 4, padding: "8px 12px",
          background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.14)",
          borderRadius: 6, fontSize: 12, color: "#7c6faf", fontStyle: "italic", lineHeight: 1.65,
          whiteSpace: "pre-wrap",
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      {!isUser && <ThinkingBubble text={msg.thinking} />}
      {(msg.content || isUser) && (
        <div style={{
          maxWidth: "88%", padding: "9px 13px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
          background: isUser ? "linear-gradient(135deg, #7c3aed, #5b21b6)" : "rgba(255,255,255,0.05)",
          border: isUser ? "none" : "1px solid rgba(255,255,255,0.07)",
          color: isUser ? "#fff" : "#cbd5e1",
          fontSize: 13, lineHeight: 1.65, fontFamily: "inherit",
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {msg.content}
          {msg.streaming && <span style={{ display: "inline-block", width: 8, height: 13, background: "#7c3aed", marginLeft: 2, borderRadius: 2, animation: "cursorBlink 0.8s step-end infinite", verticalAlign: "text-bottom" }} />}
        </div>
      )}
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 12, padding: "4px 0" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#7c3aed", animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
    </div>
  );
}

/* ── main component ── */
export default function App() {
  const [code, setCode] = useState(INITIAL_CODE);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MESSAGES);
  const [activeTab, setActiveTab] = useState("files");
  const [activeFile, setActiveFile] = useState("index.js");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /* ── streaming send ── */
  const handleSend = async (text) => {
    const msg = (text ?? input).trim();
    if (!msg) return;
    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          model,
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setIsTyping(false);
      // Insert streaming placeholder
      setMessages(prev => [...prev, { role: "assistant", content: "", thinking: "", streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          try {
            const payload = JSON.parse(trimmed.slice(5).trim());
            if (payload.type === "done") break;

            setMessages(prev => {
              const updated = [...prev];
              const last = { ...updated[updated.length - 1] };
              if (payload.type === "thinking") {
                last.thinking = (last.thinking || "") + payload.delta;
              } else if (payload.type === "message") {
                last.content = (last.content || "") + payload.delta;
              } else if (payload.type === "error") {
                last.content = (last.content || "") + "⚠️ Backend Error: " + payload.delta;
              }
              last.streaming = true;
              updated[updated.length - 1] = last;
              return updated;
            });
          } catch { }
        }
      }

      // Mark streaming done
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
        return updated;
      });

    } catch (err) {
      console.error(err);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error — is the backend running?", streaming: false }]);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const currentModel = MODELS.find(m => m.id === model) ?? MODELS[0];

  return (
    <div style={{
      height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
      background: "#0d1117", color: "#c9d1d9",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", overflow: "hidden",
    }}>

      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f2937; border-radius: 4px; }
        ::placeholder { color: #374151; }
      `}</style>

      {/* ── Title Bar ── */}
      <div style={{
        height: 38, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0, userSelect: "none",
      }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map(c => (
              <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.9 }} />
            ))}
          </div>
          <div style={{ width: 20, height: 20, borderRadius: 5, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", letterSpacing: "0.02em" }}>AI IDE Pro</span>
        </div>

        {/* Center menu */}
        <div style={{ display: "flex", gap: 20 }}>
          {["File", "Edit", "View", "Run", "Terminal", "Help"].map(item => (
            <span key={item} style={{ fontSize: 12, color: "#4b5563", cursor: "pointer" }}
              onMouseEnter={e => e.target.style.color = "#e2e8f0"}
              onMouseLeave={e => e.target.style.color = "#4b5563"}>{item}</span>
          ))}
        </div>

        {/* Right: model picker */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setShowModelMenu(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
              borderRadius: 12, padding: "3px 10px 3px 8px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 500 }}>{currentModel.label}</span>
            <svg width="10" height="10" fill="none" stroke="#7c6ab5" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" />
            </svg>
          </button>
          {showModelMenu && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
              background: "#161b22", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
              overflow: "hidden", minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {MODELS.map(m => (
                <div key={m.id} onClick={() => { setModel(m.id); setShowModelMenu(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", cursor: "pointer", fontSize: 12,
                    color: model === m.id ? "#e2e8f0" : "#6b7280",
                    background: model === m.id ? "rgba(139,92,246,0.12)" : "transparent",
                  }}
                  onMouseEnter={e => { if (model !== m.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (model !== m.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <span>{m.label}</span>
                  <span style={{ fontSize: 10, color: "#7c3aed", background: "rgba(124,58,237,0.1)", padding: "1px 6px", borderRadius: 4 }}>{m.badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }} onClick={() => setShowModelMenu(false)}>

        {/* Activity Bar */}
        <div style={{
          width: 46, display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 8, gap: 2, background: "#0d1117",
          borderRight: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
        }}>
          {NAV.map(item => (
            <button key={item.id} title={item.label}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(true); }}
              style={{
                width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 8, border: "none", cursor: "pointer", position: "relative", transition: "all 0.15s",
                background: activeTab === item.id ? "rgba(139,92,246,0.15)" : "transparent",
                color: activeTab === item.id ? "#a78bfa" : "#4b5563",
              }}
              onMouseEnter={e => { if (activeTab !== item.id) e.currentTarget.style.color = "#9ca3af"; }}
              onMouseLeave={e => { if (activeTab !== item.id) e.currentTarget.style.color = "#4b5563"; }}
            >
              {activeTab === item.id && (
                <div style={{ position: "absolute", left: -5, top: "50%", transform: "translateY(-50%)", width: 2.5, height: 22, background: "#7c3aed", borderRadius: "0 2px 2px 0" }} />
              )}
              {item.icon}
            </button>
          ))}
          <div style={{ marginTop: "auto", marginBottom: 8 }}>
            <button style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", color: "#4b5563" }}
              onMouseEnter={e => e.currentTarget.style.color = "#9ca3af"}
              onMouseLeave={e => e.currentTarget.style.color = "#4b5563"}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{ width: 200, background: "#0d1117", borderRight: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px 6px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {NAV.find(n => n.id === activeTab)?.label}
              </span>
              <button onClick={() => setSidebarOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#4b5563", padding: 2, lineHeight: 1 }}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {activeTab === "files" && (
              <div style={{ padding: "4px 0" }}>
                <div style={{ padding: "4px 12px 2px", fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Project</div>
                {FILES.map(f => (
                  <div key={f.name} onClick={() => setActiveFile(f.name)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", cursor: "pointer",
                      background: activeFile === f.name ? "rgba(139,92,246,0.1)" : "transparent",
                      borderLeft: activeFile === f.name ? "2px solid #7c3aed" : "2px solid transparent",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={e => { if (activeFile !== f.name) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { if (activeFile !== f.name) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: f.color, fontFamily: "monospace", minWidth: 18 }}>{f.lang}</span>
                    <span style={{ fontSize: 12.5, color: activeFile === f.name ? "#e2e8f0" : "#6b7280" }}>{f.name}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "search" && (
              <div style={{ padding: "8px 10px" }}>
                <input placeholder="Search files…" style={{
                  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#c9d1d9", outline: "none", fontFamily: "inherit",
                }} />
              </div>
            )}

            {activeTab === "git" && (
              <div style={{ padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: "#4b5563", marginBottom: 8 }}>Changes</div>
                {["M  index.js", "?? utils.ts"].map(line => (
                  <div key={line} style={{ fontSize: 12, color: "#6b7280", padding: "3px 0", fontFamily: "monospace" }}>{line}</div>
                ))}
                <button style={{
                  marginTop: 12, width: "100%", padding: "6px 0", borderRadius: 6, border: "1px solid rgba(139,92,246,0.3)",
                  background: "rgba(139,92,246,0.1)", color: "#a78bfa", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}>Commit…</button>
              </div>
            )}
          </div>
        )}

        {/* Code Editor */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0d1117", overflow: "hidden", minWidth: 0 }}>
          {/* Tab Bar */}
          <div style={{ display: "flex", alignItems: "stretch", background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.05)", height: 36, flexShrink: 0 }}>
            {FILES.slice(0, 3).map(f => (
              <div key={f.name} onClick={() => setActiveFile(f.name)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, padding: "0 14px", cursor: "pointer", fontSize: 12,
                  color: activeFile === f.name ? "#e2e8f0" : "#4b5563",
                  borderBottom: activeFile === f.name ? "2px solid #7c3aed" : "2px solid transparent",
                  borderRight: "1px solid rgba(255,255,255,0.04)",
                  background: activeFile === f.name ? "rgba(139,92,246,0.06)" : "transparent",
                  transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontSize: 9.5, fontWeight: 700, color: f.color, fontFamily: "monospace" }}>{f.lang}</span>
                {f.name}
                {activeFile === f.name && (
                  <span style={{ marginLeft: 2, color: "#4b5563", fontSize: 14, lineHeight: 1 }}
                    onClick={e => { e.stopPropagation(); setActiveFile(FILES[0].name); }}>×</span>
                )}
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 14px", gap: 4, color: "#374151", fontSize: 11 }}>
              <span>src</span><span style={{ color: "#1f2937" }}>/</span><span style={{ color: "#6b7280" }}>{activeFile}</span>
            </div>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor
              height="100%"
              width="100%"
              language={langFromFile(activeFile)}
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',monospace",
                fontLigatures: true,
                lineHeight: 22,
                padding: { top: 16, bottom: 16 },
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                renderLineHighlight: "all",
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                formatOnPaste: true,
                tabSize: 2,
              }}
            />
          </div>

          {/* Status Bar */}
          <div style={{
            height: 22, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 12px", background: "#7c3aed", flexShrink: 0, fontSize: 11, color: "rgba(255,255,255,0.85)",
          }}>
            <div style={{ display: "flex", gap: 14 }}>
              <span>⎇ main</span>
              <span>✓ 0 errors</span>
              <span>0 warnings</span>
            </div>
            <div style={{ display: "flex", gap: 14 }}>
              <span>{langFromFile(activeFile).charAt(0).toUpperCase() + langFromFile(activeFile).slice(1)}</span>
              <span>UTF-8</span>
              <span>Ln {code.split("\n").length}, Col 1</span>
            </div>
          </div>
        </div>

        {/* ── Chat Panel ── */}
        <div style={{
          width: 320, display: "flex", flexDirection: "column",
          background: "#0d1117", borderLeft: "1px solid rgba(255,255,255,0.06)", flexShrink: 0,
        }}>
          {/* Chat Header */}
          <div style={{
            height: 46, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#e2e8f0", lineHeight: 1.2 }}>AI Copilot</div>
                <div style={{ fontSize: 10, color: "#22c55e", lineHeight: 1.2 }}>● {currentModel.label}</div>
              </div>
            </div>
            <button
              onClick={() => setMessages(MESSAGES)}
              style={{
                background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)",
                borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "#a78bfa",
                fontSize: 11, fontFamily: "inherit", fontWeight: 500,
              }}>
              New Chat
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0" }}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {isTyping && <TypingDots />}
            <div ref={chatEndRef} />
          </div>

          {/* Suggestions */}
          <div style={{ padding: "8px 14px 0", display: "flex", gap: 5, flexWrap: "wrap" }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => handleSend(s)}
                style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  border: "1px solid rgba(139,92,246,0.2)", background: "rgba(139,92,246,0.07)",
                  color: "#7c6ab5", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "#a78bfa"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)"; e.currentTarget.style.color = "#7c6ab5"; }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div style={{ padding: 12, flexShrink: 0 }}>
            <div style={{
              display: "flex", flexDirection: "column", gap: 6,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "8px 10px", transition: "border-color 0.2s",
            }}
              onFocus={e => e.currentTarget.style.borderColor = "rgba(139,92,246,0.4)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your code…"
                rows={2}
                style={{
                  background: "none", border: "none", outline: "none", resize: "none",
                  color: "#e2e8f0", fontSize: 13, fontFamily: "inherit", lineHeight: 1.5,
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, color: "#374151" }}>↵ send · shift+↵ newline</span>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                    borderRadius: 7, border: "none",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                    background: input.trim() ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "rgba(255,255,255,0.05)",
                    color: input.trim() ? "#fff" : "#374151",
                    fontSize: 12, fontWeight: 500, fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  Send
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}