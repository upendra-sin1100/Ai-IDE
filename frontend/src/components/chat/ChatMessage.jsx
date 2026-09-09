import { useState } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Check, X, Copy, FilePlus, FileEdit, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function ChatMessage({ message }) {
  const { acceptProposedEdit, insertProposedEdit, replaceProposedEdit, fileContents } = useWorkspace();
  const [applied, setApplied] = useState({});
  const [rejected, setRejected] = useState({});
  const [copied, setCopied] = useState(false);

  const isAssistant = message.role === "assistant";
  const edits = Array.isArray(message.proposedEdits)
    ? message.proposedEdits
    : message.proposedEdit
      ? [message.proposedEdit]
      : [];

  const handleAccept = async (editItem) => {
    if (!editItem) return;
    await acceptProposedEdit(editItem);
    setApplied((prev) => ({ ...prev, [editItem.file_path]: "Added to workspace" }));
  };

  const handleInsert = async (editItem) => {
    if (!editItem) return;
    await insertProposedEdit(editItem);
    setApplied((prev) => ({ ...prev, [editItem.file_path]: "Inserted into file" }));
  };

  const handleReplace = async (editItem) => {
    if (!editItem) return;
    await replaceProposedEdit(editItem);
    setApplied((prev) => ({ ...prev, [editItem.file_path]: "Replaced file content" }));
  };

  const handleReject = (editItem) => {
    setRejected((prev) => ({ ...prev, [editItem.file_path]: true }));
  };

  const handleCopy = (content) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col gap-2 p-3 text-xs ${isAssistant ? "bg-slate-900/90 border-b border-slate-800/60" : "bg-cyan-950/20 border-b border-cyan-900/30"}`}>
      <div className="flex items-center gap-1.5 font-medium text-slate-400">
        {isAssistant ? (
          <>
            <Sparkles size={14} className="text-cyan-400" />
            <span className="text-cyan-300">AI Chat</span>
          </>
        ) : (
          <span className="text-slate-300 font-semibold">You</span>
        )}
      </div>

      <div className="text-slate-200 leading-relaxed font-sans prose prose-invert prose-xs max-w-none">
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </div>

      {/* Proposed Edit / Create File Cards */}
      {edits.map((edit, idx) => {
        if (!edit || rejected[edit.file_path]) return null;
        const appliedStatus = applied[edit.file_path];
        const fileExists = fileContents[edit.file_path] !== undefined;

        return (
          <div key={idx} className={`mt-2 border ${fileExists ? "border-amber-500/40 bg-slate-950" : "border-slate-700/80 bg-slate-950"} rounded-lg overflow-hidden font-mono`}>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 text-[11px]">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <FilePlus size={14} className={fileExists ? "text-amber-400" : "text-emerald-400"} />
                <span className={fileExists ? "text-amber-300" : "text-emerald-300"}>
                  {fileExists ? `File: ${edit.file_path} (exists)` : `New file: ${edit.file_path}`}
                </span>
              </div>

              <button
                onClick={() => handleCopy(edit.content)}
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

            {/* Actions controls */}
            <div className="flex items-center justify-end gap-2 px-3 py-2 bg-slate-900/80 border-t border-slate-800">
              {appliedStatus ? (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <Check size={13} />
                  {appliedStatus}!
                </span>
              ) : (
                <>
                  <button
                    onClick={() => handleReject(edit)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-medium transition-colors"
                  >
                    <X size={12} />
                    Reject
                  </button>

                  {fileExists ? (
                    <>
                      <button
                        onClick={() => handleInsert(edit)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-medium transition-colors"
                      >
                        Insert
                      </button>
                      <button
                        onClick={() => handleReplace(edit)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors"
                      >
                        Replace
                      </button>
                      <button
                        onClick={() => handleAccept(edit)}
                        className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
                      >
                        <Check size={13} />
                        Save File
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAccept(edit)}
                      className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors shadow-sm"
                    >
                      <Check size={13} />
                      Add to workspace
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
