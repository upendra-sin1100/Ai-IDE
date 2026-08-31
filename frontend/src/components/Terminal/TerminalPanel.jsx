import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTerminal } from "../../hooks/useTerminal";

export function TerminalPanel({ onClose = null, runConfig = null, onStop = null }) {
  const terminalRef = useRef(null);
  const xtermRef = useRef(null);
  const fitAddonRef = useRef(null);
  const outputBufferRef = useRef([]);

  const handleDataFromBackend = useCallback((data) => {
    if (xtermRef.current) {
      xtermRef.current.write(data);
    } else {
      outputBufferRef.current.push(data);
    }
  }, []);

  const { connected, error, sendInput, reconnect, closeSession } = useTerminal(handleDataFromBackend, runConfig);

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
        selectionBackground: "rgba(8, 145, 178, 0.25)",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Flush any early data received before xterm was ready
    if (outputBufferRef.current.length > 0) {
      outputBufferRef.current.forEach((chunk) => term.write(chunk));
      outputBufferRef.current = [];
    }

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {
        /* ignore */
      }
    }, 50);

    term.onData((data) => {
      sendInput(data);
    });

    const doFit = () => {
      try {
        if (fitAddonRef.current && terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          fitAddonRef.current.fit();
        }
      } catch {
        /* ignore */
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(doFit);
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    doFit();

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sendInput]);

  useEffect(() => {
    if (runConfig) {
      outputBufferRef.current = [];
      if (xtermRef.current) {
        xtermRef.current.reset();
      }
    }
    if (fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current.fit();
        } catch {
        /* ignore */
      }
      }, 50);
    }
  }, [runConfig]);

  const handleStop = () => {
    closeSession();
    if (onStop) onStop();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#090d16", width: "100%", height: "100%", overflow: "hidden" }}>
      {/* Subheader status bar */}
      <div style={{ height: 26, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", background: "#060911", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "monospace" }}>
          <span style={{ color: connected ? "#4ade80" : "#f59e0b" }}>●</span>
          <span>{runConfig ? `Interactive Execution: ${runConfig.fileName || 'script'}` : "Interactive Shell Session"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {runConfig && (
            <button
              onClick={handleStop}
              style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.15)", color: "#f87171", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              ■ Stop Process
            </button>
          )}
          <button
            onClick={reconnect}
            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
            title="Reconnect Session"
          >
            ↻ Reconnect
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}
              title="Close Terminal"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "4px 10px", background: "rgba(127,29,29,0.5)", borderBottom: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: 11, flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Terminal Canvas Container */}
      <div style={{ flex: 1, padding: "6px", overflow: "hidden", minHeight: 0, background: "#090d16" }} ref={terminalRef} />
    </div>
  );
}


