import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminal } from "../../hooks/useTerminal";
import { Terminal as TerminalIcon, X, Minimize2, Maximize2, RefreshCw } from "lucide-react";

export function TerminalPanel({ onClose }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDataFromBackend = useCallback((data) => {
    if (xtermRef.current) {
      xtermRef.current.write(data);
    }
  }, []);

  const { connected, error, sendInput, reconnect } = useTerminal(handleDataFromBackend);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      theme: {
        background: "#090d16",
        foreground: "#cbd5e1",
        cursor: "#06b6d4",
        selectionBackground: "#0891b240",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      sendInput(data);
    });

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (_) {}
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
    };
  }, [sendInput]);

  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
        } catch (_) {}
      }, 100);
    }
  }, [isExpanded]);

  return (
    <div
      className={`flex flex-col bg-[#090d16] border-t border-slate-800 select-none ${
        isExpanded ? "h-80" : "h-48"
      } transition-all duration-200`}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-mono">
          <TerminalIcon size={14} className="text-cyan-400" />
          <span className="font-semibold text-slate-200">Terminal</span>
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-500 animate-pulse"}`}
            title={connected ? "Terminal session active" : "Connecting..."}
          />
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            title="Reconnect"
            onClick={reconnect}
            className="p-1 hover:bg-slate-800 hover:text-white rounded"
          >
            <RefreshCw size={13} />
          </button>
          <button
            title={isExpanded ? "Collapse" : "Expand"}
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-slate-800 hover:text-white rounded"
          >
            {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          {onClose && (
            <button
              title="Close Terminal"
              onClick={onClose}
              className="p-1 hover:bg-slate-800 hover:text-white rounded"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-3 py-1 bg-red-950/60 border-b border-red-800/40 text-red-300 text-[11px]">
          {error}
        </div>
      )}

      {/* Terminal Container */}
      <div className="flex-1 p-2 overflow-hidden" ref={terminalRef} />
    </div>
  );
}
