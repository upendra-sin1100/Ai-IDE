import { useState } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Check, X, Copy, FilePlus, FileEdit, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ChatMessage({ message }) {
  const { acceptProposedEdit } = useWorkspace();
  const [applied, setApplied] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAssistant = message.role === "assistant";
  const edit = message.proposedEdit;

  const handleAccept = async () => {
    if (!edit) return;
    await acceptProposedEdit(edit);
    setApplied(true);
  };

  const handleReject = () => {
    setRejected(true);
  };

  const handleCopy = () => {
    if (!edit) return;
    navigator.clipboard.writeText(edit.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col gap-2 p-3 text-xs ${isAssistant ? "bg-slate-900/90 border-b border-slate-800/60" : "bg-cyan-950/20 border-b border-cyan-900/30"}`}>
      <div className="flex items-center gap-1.5 font-medium text-slate-400">
        {isAssistant ? (
          <>
            <Sparkles size={14} className="text-cyan-400" />
            <span className="text-cyan-300">AI Copilot</span>
          </>
        ) : (
          <span className="text-slate-300 font-semibold">You</span>
        )}
      </div>

      <div className="text-slate-200 leading-relaxed font-sans prose prose-invert prose-xs max-w-none">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      {/* Proposed Edit Card */}
      {edit && !rejected && (
        <div className="mt-2 border border-slate-700/80 bg-slate-950 rounded-lg overflow-hidden font-mono">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              {edit.is_new_file ? (
                <>
                  <FilePlus size={14} className="text-emerald-400" />
                  <span className="text-emerald-300">[New File] {edit.file_path}</span>
                </>
              ) : (
                <>
                  <FileEdit size={14} className="text-amber-400" />
                  <span className="text-amber-300">[Proposed Edit] {edit.file_path}</span>
                </>
              )}
            </div>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white text-[10px]"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          {/* Preview snippet */}
          <div className="p-3 text-[11px] bg-slate-950 max-h-48 overflow-y-auto text-slate-300 whitespace-pre">
            {edit.diff || edit.content}
          </div>

          {/* Accept / Reject controls */}
          <div className="flex items-center justify-end gap-2 px-3 py-2 bg-slate-900/80 border-t border-slate-800">
            {applied ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                <Check size={13} />
                Applied to disk!
              </span>
            ) : (
              <>
                <button
                  onClick={handleReject}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
                >
                  <X size={12} />
                  Reject
                </button>
                <button
                  onClick={handleAccept}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
                >
                  <Check size={13} />
                  Accept & Write
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
