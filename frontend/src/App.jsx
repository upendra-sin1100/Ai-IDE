import { useState, useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { TerminalPanel } from "./components/Terminal/TerminalPanel";
import "./App.css";

const INITIAL_CODE = `# Welcome to AI IDE Pro
# Start coding in Python!

def main():
    print("Hello from hello.py!")

if __name__ == "__main__":
    main()
`;

const MESSAGES = [
  {
    role: "assistant",
    thinking:
      "Analyzing workspace... Gemini AI copilot ready. Ready to process code and provide optimized solutions.",
    content:
      "Hello! I'm your AI copilot powered by Gemini.\n\nI can suggest code directly into your editor — ask me to write or refine any code and click **Insert** or **Replace All** to update your code instantly!\n\nUse the **Run** button up top to execute your code — output shows up in the terminal drawer below the editor.\n\n```python\n# Try running this Python code:\ndef greet(name):\n    return f'Hello, {name}!'\n\nprint(greet('Developer'))\n```",
  },
];

const INITIAL_FILES = [
  { name: "hello.py", lang: "PY", color: "#3572A5" },
];

const SUGGESTIONS = ["Optimize code", "Add TS types", "Write tests", "Explain this", "Add function"];

const DEFAULT_MODELS = [
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", badge: "Gemini", provider: "gemini" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", badge: "Gemini", provider: "gemini" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", badge: "Gemini", provider: "gemini" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", badge: "Gemini", provider: "gemini" },
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
  if (name.endsWith(".java")) return "java";
  if (name.endsWith(".md")) return "markdown";
  if (name.endsWith(".cpp") || name.endsWith(".c++")) return "cpp";
  if (name.endsWith(".py")) return "python";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".html")) return "html";
  return "javascript";
}

// ── Renders message content with code blocks as suggestion cards ──
function MessageContent({ content, onAccept, onReplace }) {
  if (!content) return null;

  const parts = [];
  const regex = /```(?:\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "code", value: match[1].trim(), raw: match[0] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }

  return (
    <div style={{ fontSize: 13, lineHeight: 1.65, color: "#cbd5e1", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (part.type === "text") return <span key={i}>{part.value}</span>;
        return (
          <CodeSuggestionCard
            key={i}
            code={part.value}
            onAccept={() => onAccept(part.value)}
            onReplace={() => onReplace(part.value)}
          />
        );
      })}
    </div>
  );
}

// ── The inline suggestion card with Accept / Replace / Copy buttons ──
function CodeSuggestionCard({ code, onAccept, onReplace }) {
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [replaced, setReplaced] = useState(false);

  const lines = code.split("\n");
  const preview = lines.slice(0, 6);
  const hasMore = lines.length > 6;
  const [expanded, setExpanded] = useState(false);
  const displayLines = expanded ? lines : preview;

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleAccept = () => {
    onAccept();
    setAccepted(true);
    setTimeout(() => setAccepted(false), 2000);
  };

  const handleReplace = () => {
    onReplace();
    setReplaced(true);
    setTimeout(() => setReplaced(false), 2000);
  };

  return (
    <div style={{
      margin: "10px 0",
      borderRadius: 10,
      border: "1px solid rgba(139,92,246,0.3)",
      background: "rgba(15,15,25,0.9)",
      overflow: "hidden",
      boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
    }}>
      {/* Code area */}
      <div style={{
        padding: "10px 12px",
        fontFamily: "'JetBrains Mono','Fira Code',monospace",
        fontSize: 11.5,
        lineHeight: 1.7,
        color: "#a5b4fc",
        overflowX: "auto",
        maxHeight: expanded ? "none" : undefined,
      }}>
        {displayLines.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 10, minWidth: 0 }}>
            <span style={{ color: "#374151", userSelect: "none", minWidth: 20, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
            <span style={{ color: "#e2e8f0", whiteSpace: "pre" }}>{line || " "}</span>
          </div>
        ))}
        {hasMore && !expanded && (
          <div
            onClick={() => setExpanded(true)}
            style={{ color: "#8b5cf6", fontSize: 11, cursor: "pointer", marginTop: 4, paddingLeft: 30, fontWeight: 500 }}
          >
            ▼ {lines.length - 6} more lines…
          </div>
        )}
      </div>

      {/* Action bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderTop: "1px solid rgba(139,92,246,0.15)",
        background: "rgba(139,92,246,0.05)",
      }}>
        <button
          onClick={handleAccept}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid rgba(34,197,94,0.4)",
            background: accepted ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.12)",
            color: "#4ade80",
            fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(34,197,94,0.22)"}
          onMouseLeave={e => e.currentTarget.style.background = accepted ? "rgba(34,197,94,0.25)" : "rgba(34,197,94,0.12)"}
        >
          {accepted ? (
            <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> Inserted!</>
          ) : (
            <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg> Insert</>
          )}
        </button>

        <button
          onClick={handleReplace}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid rgba(251,191,36,0.35)",
            background: replaced ? "rgba(251,191,36,0.2)" : "rgba(251,191,36,0.08)",
            color: "#fbbf24",
            fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(251,191,36,0.18)"}
          onMouseLeave={e => e.currentTarget.style.background = replaced ? "rgba(251,191,36,0.2)" : "rgba(251,191,36,0.08)"}
        >
          {replaced ? (
            <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> Replaced!</>
          ) : (
            <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" strokeLinecap="round" /></svg> Replace All</>
          )}
        </button>

        <button
          onClick={handleCopy}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "transparent",
            color: copied ? "#a78bfa" : "#9ca3af",
            fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#cbd5e1"}
          onMouseLeave={e => e.currentTarget.style.color = copied ? "#a78bfa" : "#9ca3af"}
        >
          {copied ? (
            <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> Copied</>
          ) : (
            <><svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg> Copy</>
          )}
        </button>

        <div style={{ marginLeft: "auto", fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
          {lines.length} lines
        </div>
      </div>
    </div>
  );
}

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
          borderRadius: 6, fontSize: 12, color: "#94a3b8", fontStyle: "italic", lineHeight: 1.65,
          whiteSpace: "pre-wrap",
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

function Message({ msg, onAcceptCode, onReplaceCode }) {
  const isUser = msg.role === "user";
  const hasCode = !isUser && msg.content && /```[\s\S]*?```/.test(msg.content);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 16 }}>
      {!isUser && <ThinkingBubble text={msg.thinking} />}
      {(msg.content || isUser) && (
        <div style={{
          maxWidth: "92%", padding: "9px 13px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
          background: isUser ? "linear-gradient(135deg, #7c3aed, #5b21b6)" : "rgba(255,255,255,0.05)",
          border: isUser ? "none" : "1px solid rgba(255,255,255,0.07)",
          color: isUser ? "#fff" : "#cbd5e1",
          fontSize: 13, lineHeight: 1.65, fontFamily: "inherit",
          whiteSpace: isUser ? "pre-wrap" : undefined,
          wordBreak: "break-word",
          width: hasCode ? "100%" : undefined,
        }}>
          {isUser ? (
            <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
          ) : (
            <MessageContent
              content={msg.content}
              onAccept={onAcceptCode}
              onReplace={onReplaceCode}
            />
          )}
          {msg.streaming && !hasCode && (
            <span style={{
              display: "inline-block", width: 8, height: 13,
              background: "#7c3aed", marginLeft: 2, borderRadius: 2,
              animation: "cursorBlink 0.8s step-end infinite", verticalAlign: "text-bottom"
            }} />
          )}
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

// ── Toast notification ──
function Toast({ message, visible }) {
  return (
    <div style={{
      position: "fixed", bottom: 40, left: "50%", transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
      borderRadius: 8, padding: "8px 18px",
      color: "#4ade80", fontSize: 12.5, fontWeight: 600,
      opacity: visible ? 1 : 0,
      transition: "all 0.25s ease",
      pointerEvents: "none",
      zIndex: 9999,
      display: "flex", alignItems: "center", gap: 7,
      boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {message}
    </div>
  );
}

/* ── main component ── */
export default function App() {
  const [files, setFiles] = useState(INITIAL_FILES);
  const [fileContents, setFileContents] = useState({
    "hello.py": INITIAL_CODE,
  });

  // Resizable AI Copilot Chat panel width
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem("ai_ide_chat_width");
    return saved ? Math.min(600, Math.max(260, parseInt(saved, 10))) : 340;
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDownResize = (e) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = chatWidth;

    const handlePointerMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.min(600, Math.max(260, startWidth + deltaX));
      setChatWidth(newWidth);
      localStorage.setItem("ai_ide_chat_width", newWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MESSAGES);
  const [activeTab, setActiveTab] = useState("files");
  const [activeFile, setActiveFile] = useState("hello.py");
  const [isTyping, setIsTyping] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [modelsList, setModelsList] = useState(DEFAULT_MODELS);
  const [selectedModelId, setSelectedModelId] = useState("gemini-1.5-flash");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "" });
  const editorRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

  // Interactive code execution config for TerminalPanel
  const [activeRunConfig, setActiveRunConfig] = useState(null);

  // ── Terminal state (from terminal build) ──
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalTab, setTerminalTab] = useState("terminal"); // 'terminal' | 'output' | 'stdin'
  const [terminalLogs, setTerminalLogs] = useState([
    "$ AI IDE Pro Environment Ready",
    "$ Node.js v20.10.0 / Python 3.11 available",
  ]);
  const [stdinInput, setStdinInput] = useState("");
  const terminalEndRef = useRef(null);

  // ── Fetch dynamic models list from backend on mount ──
  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch(`${apiBaseUrl}/api/models`);
        if (res.ok) {
          const data = await res.json();
          if (data.models && data.models.length > 0) {
            const formatted = data.models.map(m => ({
              id: m.id,
              label: m.label || m.id,
              badge: (m.provider || "Gemini").charAt(0).toUpperCase() + (m.provider || "Gemini").slice(1),
              provider: m.provider || "gemini",
            }));
            setModelsList(formatted);
            if (data.default_model) {
              setSelectedModelId(data.default_model);
            }
          }
        }
      } catch {
        // Fallback to DEFAULT_MODELS if backend loading fails
      }
    }
    loadModels();
  }, [apiBaseUrl]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  const code = fileContents[activeFile] || "";
  const setCode = useCallback((newCode) => {
    if (typeof newCode === "function") {
      setFileContents(prev => ({ ...prev, [activeFile]: newCode(prev[activeFile] || "") }));
    } else {
      setFileContents(prev => ({ ...prev, [activeFile]: newCode }));
    }
  }, [activeFile]);

  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: "" }), 2200);
  };

  // ── Insert code at cursor position (append mode) ──
  const handleAcceptCode = useCallback((snippet) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      const position = editor.getPosition();
      const lineCount = model ? model.getLineCount() : 1;
      const lastLine = model ? model.getLineContent(lineCount) : "";

      const insertPosition = {
        lineNumber: position ? position.lineNumber : lineCount,
        column: position ? model.getLineMaxColumn(position.lineNumber) : lastLine.length + 1,
      };

      const textToInsert = "\n\n" + snippet;

      editor.executeEdits("ai-insert", [{
        range: {
          startLineNumber: insertPosition.lineNumber,
          startColumn: insertPosition.column,
          endLineNumber: insertPosition.lineNumber,
          endColumn: insertPosition.column,
        },
        text: textToInsert,
      }]);

      const newLineCount = editor.getModel().getLineCount();
      editor.setPosition({ lineNumber: newLineCount, column: 1 });
      editor.revealLine(newLineCount, 1);
      editor.focus();
      showToast("Code inserted into editor ✓");
    } else {
      setCode(prev => prev + "\n\n" + snippet);
      showToast("Code appended ✓");
    }
  }, [setCode]);

  // ── Replace entire editor content ──
  const handleReplaceCode = useCallback((snippet) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const model = editor.getModel();
      if (model) {
        const fullRange = model.getFullModelRange();
        editor.executeEdits("ai-replace", [{
          range: fullRange,
          text: snippet,
        }]);
        editor.setPosition({ lineNumber: 1, column: 1 });
        editor.revealLine(1, 1);
        editor.focus();
      }
    } else {
      setCode(snippet);
    }
    showToast("Editor content replaced ✓");
  }, [setCode]);

  const handleSend = async (text) => {
    const rawText = typeof text === "string" ? text : input;
    const msg = (rawText || "").trim();
    if (!msg) return;
    const newMessages = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    const activeModelObj = modelsList.find(m => m.id === selectedModelId) || modelsList[0];

    try {
      const res = await fetch(`${apiBaseUrl}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          model: activeModelObj.id,
          provider: activeModelObj.provider || "gemini",
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setIsTyping(false);
      setMessages(prev => [...prev, { role: "assistant", content: "", thinking: "", streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

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
              } else if (payload.type === "message" || payload.type === "chunk") {
                last.content = (last.content || "") + payload.delta;
              } else if (payload.type === "error") {
                last.content = (last.content || "") + "⚠️ Backend Error: " + payload.delta;
              }
              last.streaming = true;
              updated[updated.length - 1] = last;
              return updated;
            });
          } catch (error) {
            console.error("Failed to parse streamed payload:", error);
          }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
        return updated;
      });

    } catch (err) {
      console.warn("Backend stream offline, rendering local assistant response:", err);
      setIsTyping(false);

      let mockReply = `Here is a solution for **${msg}**:\n\n`;
      if (msg.toLowerCase().includes("optimize")) {
        mockReply += `\`\`\`js\n// Optimized function with O(n) memoization\nconst memo = {};\nfunction fibonacciMemo(n) {\n  if (n <= 1) return n;\n  if (memo[n]) return memo[n];\n  return memo[n] = fibonacciMemo(n - 1) + fibonacciMemo(n - 2);\n}\n\`\`\``;
      } else if (msg.toLowerCase().includes("type") || msg.toLowerCase().includes("ts")) {
        mockReply += `\`\`\`ts\ntype NumericInput = number;\ntype SequenceResult = number[];\n\nexport function calculateFibonacci(n: NumericInput): SequenceResult {\n  const result: number[] = [];\n  for (let i = 0; i < n; i++) {\n    result.push(i <= 1 ? i : result[i - 1] + result[i - 2]);\n  }\n  return result;\n}\n\`\`\``;
      } else if (msg.toLowerCase().includes("test")) {
        mockReply += `\`\`\`js\n// Jest Unit Tests\ndescribe('fibonacci', () => {\n  test('should return correct values', () => {\n    expect(fibonacci(0)).toBe(0);\n    expect(fibonacci(1)).toBe(1);\n    expect(fibonacci(6)).toBe(8);\n  });\n});\n\`\`\``;
      } else {
        mockReply += `\`\`\`js\n// Helper snippet:\nfunction processData(items) {\n  return items.filter(Boolean).map(item => ({\n    id: item.id,\n    processedAt: new Date().toISOString(),\n  }));\n}\n\`\`\``;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        thinking: "Prepared response with executable code snippet.",
        content: mockReply,
        streaming: false,
      }]);
    }
  };

  // ── Run code: streams live interactive WebSocket session into terminal ──
  const handleRunCode = async () => {
    const runLanguage = langFromFile(activeFile);
    const supported = new Set(["javascript", "typescript", "python", "java", "css"]);

    setTerminalOpen(true);

    if (runLanguage === "css") {
      setTerminalTab("preview");
      return;
    }

    setTerminalTab("terminal");

    if (!supported.has(runLanguage)) {
      setTerminalLogs(prev => [...prev, `\n$ run ${activeFile}`, `⚠️ ${activeFile} can't be executed. Use JS, TS, Python, Java, or CSS.`]);
      return;
    }

    setIsRunning(true);
    try {
      // Trigger live interactive WebSocket session
      setActiveRunConfig({
        language: runLanguage,
        code,
        fileName: activeFile,
        runId: Date.now(),
      });
    } finally {
      setTimeout(() => setIsRunning(false), 250);
    }
  };

  const handleKeyDown = e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const currentModel = modelsList.find(m => m.id === selectedModelId) ?? modelsList[0];

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
        ::placeholder { color: #4b5563; }

        ::view-transition-group(*),
        ::view-transition-old(*),
        ::view-transition-new(*) {
          animation-duration: 0.25s;
          animation-timing-function: cubic-bezier(0.19, 1, 0.22, 1);
        }
      `}</style>

      {/* Toast */}
      <Toast message={toast.message} visible={toast.visible} />

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

        {/* Center: Run + Terminal toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handleRunCode}
            disabled={isRunning}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "4px 14px", borderRadius: 6, border: "none", cursor: isRunning ? "not-allowed" : "pointer",
              background: activeFile.endsWith(".css") ? "linear-gradient(135deg,#2563eb,#3b82f6)" : isRunning ? "rgba(124,58,237,0.2)" : "rgba(124,58,237,0.85)",
              color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
              opacity: isRunning ? 0.6 : 1, transition: "all 0.15s",
            }}
          >
            {activeFile.endsWith(".css") ? (
              <>
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Preview
              </>
            ) : (
              <>
                <svg width="11" height="11" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
                {isRunning ? "Running…" : "Run"}
              </>
            )}
          </button>

          <button
            onClick={() => setTerminalOpen(v => !v)}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#a78bfa",
              fontSize: 11, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {terminalOpen ? "Hide Terminal" : "Show Terminal"}
          </button>
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
              {modelsList.map(m => (
                <div key={m.id} onClick={() => { setSelectedModelId(m.id); setShowModelMenu(false); }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 12px", cursor: "pointer", fontSize: 12,
                    color: selectedModelId === m.id ? "#e2e8f0" : "#6b7280",
                    background: selectedModelId === m.id ? "rgba(139,92,246,0.12)" : "transparent",
                  }}
                  onMouseEnter={e => { if (selectedModelId !== m.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (selectedModelId !== m.id) e.currentTarget.style.background = "transparent"; }}
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
                <div style={{ padding: "4px 12px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>Project</span>
                  <button
                    onClick={() => {
                      const name = prompt("Enter file name (e.g. dsa.cpp):");
                      if (name && !files.find(f => f.name === name)) {
                        let lang = "TXT", color = "#9ca3af";
                        if (name.endsWith(".js")) { lang = "JS"; color = "#f0db4f"; }
                        else if (name.endsWith(".ts")) { lang = "TS"; color = "#3178c6"; }
                        else if (name.endsWith(".css")) { lang = "CSS"; color = "#264de4"; }
                        else if (name.endsWith(".md")) { lang = "MD"; color = "#83a598"; }
                        else if (name.endsWith(".py")) { lang = "PY"; color = "#3572A5"; }
                        else if (name.endsWith(".cpp") || name.endsWith(".c++")) { lang = "C++"; color = "#00599C"; }
                        setFiles([...files, { name, lang, color }]);
                        setFileContents(prev => ({ ...prev, [name]: "" }));
                        setActiveFile(name);
                      }
                    }}
                    style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
                  >+</button>
                </div>
                {files.map(f => (
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

        {/* Code Editor + Terminal */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0d1117", overflow: "hidden", minWidth: 0 }}>
          {/* Tab Bar */}
          <div style={{ display: "flex", alignItems: "stretch", background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.05)", height: 36, flexShrink: 0 }}>
            {files.map(f => (
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
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", padding: "0 14px", gap: 4, color: "#374151", fontSize: 11 }}>
              <span>src</span><span style={{ color: "#1f2937" }}>/</span><span style={{ color: "#6b7280" }}>{activeFile}</span>
            </div>
          </div>

          {/* Monaco Editor */}
          <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <Editor
              height="100%"
              width="100%"
              language={langFromFile(activeFile)}
              theme="vs-dark"
              value={code}
              onChange={v => setCode(v || "")}
              onMount={(editor) => { editorRef.current = editor; }}
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
                automaticLayout: true,
              }}
            />
          </div>

          {/* ── Bottom Terminal Drawer ── */}
          <div style={{
            height: terminalOpen ? (terminalTab === "terminal" ? 220 : 200) : 30, flexShrink: 0, transition: "height 0.15s",
            background: "#090d11", borderTop: "1px solid rgba(255,255,255,0.08)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Terminal Header */}
            <div style={{ height: 30, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", background: "#0d1117", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", gap: 16, fontSize: 11, fontWeight: 600 }}>
                <span
                  onClick={() => setTerminalTab("terminal")}
                  style={{ color: terminalTab === "terminal" ? "#e2e8f0" : "#6b7280", borderBottom: terminalTab === "terminal" ? "2px solid #7c3aed" : "none", paddingBottom: 4, cursor: "pointer" }}
                >
                  TERMINAL
                </span>
                <span
                  onClick={() => setTerminalTab("output")}
                  style={{ color: terminalTab === "output" ? "#e2e8f0" : "#6b7280", borderBottom: terminalTab === "output" ? "2px solid #7c3aed" : "none", paddingBottom: 4, cursor: "pointer" }}
                >
                  OUTPUT
                </span>
                <span
                  onClick={() => setTerminalTab("preview")}
                  style={{ color: terminalTab === "preview" ? "#e2e8f0" : "#6b7280", borderBottom: terminalTab === "preview" ? "2px solid #7c3aed" : "none", paddingBottom: 4, cursor: "pointer" }}
                >
                  PREVIEW
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setTerminalLogs([])} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>Clear</button>
                <button onClick={() => setTerminalOpen(v => !v)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                  {terminalOpen ? "▼" : "▲"}
                </button>
              </div>
            </div>

            {/* Interactive Terminal (xterm.js + WebSocket) */}
            {terminalOpen && terminalTab === "terminal" && (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", height: "100%", width: "100%" }}>
                <TerminalPanel
                  onClose={() => setTerminalOpen(false)}
                  runConfig={activeRunConfig}
                  onStop={() => setActiveRunConfig(null)}
                />
              </div>
            )}

            {/* Terminal Output Body */}
            {terminalOpen && terminalTab === "output" && (
              <div style={{ flex: 1, padding: "10px 14px", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12, color: "#38bdf8", overflowY: "auto", background: "#05070a" }}>
                {terminalLogs.map((log, index) => (
                  <div key={index} style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, color: log.startsWith("$") ? "#a78bfa" : log.startsWith("⚠️") || log.startsWith("Error") || log.startsWith("Runtime Error") ? "#f87171" : "#e2e8f0" }}>
                    {log}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>
            )}

            {/* Stdin Input Body */}
            {terminalOpen && terminalTab === "stdin" && (
              <div style={{ flex: 1, padding: "10px 14px", background: "#05070a" }}>
                <textarea
                  value={stdinInput}
                  onChange={e => setStdinInput(e.target.value)}
                  placeholder="Values your code's input() calls will read, one per line…"
                  style={{
                    width: "100%", height: "100%", background: "transparent",
                    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: 8,
                    color: "#e2e8f0", fontFamily: "'JetBrains Mono','Fira Code',monospace",
                    fontSize: 12, resize: "none", outline: "none",
                  }}
                />
              </div>
            )}

            {/* Live CSS Preview Body */}
            {terminalOpen && terminalTab === "preview" && (
              <div style={{ flex: 1, padding: "16px", background: "#090d16", overflowY: "auto" }}>
                <style>{fileContents["styles.css"] || (activeFile.endsWith(".css") ? code : "")}</style>
                <div className="card">
                  <div className="title">CSS Live Preview</div>
                  <p style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 12 }}>
                    Editing styles live. The CSS rules defined in your editor apply directly to this component.
                  </p>
                  <button className="btn">Sample Action Button</button>
                </div>
              </div>
            )}
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

        {/* Drag Divider Handle */}
        <div
          onPointerDown={handleMouseDownResize}
          style={{
            width: 6,
            cursor: "col-resize",
            background: isResizing ? "#7c3aed" : "transparent",
            borderLeft: "1px solid rgba(255,255,255,0.06)",
            transition: "background 0.15s",
            userSelect: "none",
            flexShrink: 0,
            zIndex: 10,
          }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(139,92,246,0.4)"}
          onMouseLeave={e => { if (!isResizing) e.currentTarget.style.background = "transparent"; }}
          title="Drag to resize AI Copilot panel"
        />

        {/* ── Chat Panel ── */}
        <div style={{
          width: chatWidth, display: "flex", flexDirection: "column",
          background: "#0d1117", flexShrink: 0, overflow: "hidden",
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
            {messages.map((msg, i) => (
              <Message
                key={i}
                msg={msg}
                onAcceptCode={handleAcceptCode}
                onReplaceCode={handleReplaceCode}
              />
            ))}
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
                  color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; e.currentTarget.style.color = "#a78bfa"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(139,92,246,0.2)"; e.currentTarget.style.color = "#9ca3af"; }}
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
                <span style={{ fontSize: 10.5, color: "#6b7280" }}>↵ send · shift+↵ newline</span>
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
                    borderRadius: 7, border: "none",
                    cursor: input.trim() ? "pointer" : "not-allowed",
                    background: input.trim() ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "rgba(255,255,255,0.05)",
                    color: input.trim() ? "#fff" : "#4b5563",
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