import { useEffect, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useModel } from "../../context/ModelContext";
import { registerInlineCompletionProvider } from "./InlineCompletionProvider";
import { X, Save, FileCode } from "lucide-react";

function getLanguageFromPath(path) {
  if (!path) return "javascript";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".cpp") || path.endsWith(".c")) return "cpp";
  return "javascript";
}

export function MonacoEditor() {
  const { openTabs, activeFilePath, setActiveFilePath, closeTab, fileContents, dirtyFiles, updateFileContent, saveFile } = useWorkspace();
  const { model, provider } = useModel();

  const modelRef = useRef(model);
  const providerRef = useRef(provider);
  modelRef.current = model;
  providerRef.current = provider;

  const currentContent = activeFilePath ? fileContents[activeFilePath] ?? "" : "";
  const isDirty = activeFilePath ? dirtyFiles[activeFilePath] : false;

  const handleEditorMount = useCallback((editor, monaco) => {
    registerInlineCompletionProvider(
      monaco,
      () => modelRef.current,
      () => providerRef.current
    );

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile();
    });
  }, [saveFile]);

  const getFileName = (path) => {
    if (!path) return "";
    return path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
  };

  return (
    <div className="flex flex-col h-full flex-1 bg-slate-950 min-w-0 overflow-hidden">
      {/* Tabs bar */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800/80 overflow-x-auto select-none shrink-0 scrollbar-none">
        {openTabs.map((path) => {
          const isActive = path === activeFilePath;
          const tabDirty = dirtyFiles[path];
          const fileName = getFileName(path);

          return (
            <div
              key={path}
              onClick={() => setActiveFilePath(path)}
              className={`group flex items-center gap-2 px-3 py-2 text-xs font-mono border-r border-slate-800 cursor-pointer transition-colors ${
                isActive
                  ? "bg-slate-950 text-cyan-300 border-t-2 border-t-cyan-400 font-medium"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              }`}
            >
              <FileCode size={13} className={isActive ? "text-cyan-400" : "text-slate-500"} />
              <span className="truncate max-w-[140px]">{fileName}</span>
              {tabDirty && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" title="Unsaved changes" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(path);
                }}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {activeFilePath && (
          <div className="ml-auto pr-3 flex items-center">
            <button
              onClick={() => saveFile(activeFilePath)}
              disabled={!isDirty}
              className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded transition-colors ${
                isDirty
                  ? "bg-cyan-600/30 text-cyan-300 hover:bg-cyan-600/50 border border-cyan-500/40"
                  : "text-slate-600 cursor-not-allowed"
              }`}
              title="Save File (Ctrl+S)"
            >
              <Save size={12} />
              <span>Save</span>
            </button>
          </div>
        )}
      </div>

      {/* Editor Main Content */}
      <div className="flex-1 min-h-0 relative">
        {activeFilePath ? (
          <Editor
            height="100%"
            language={getLanguageFromPath(activeFilePath)}
            theme="vs-dark"
            value={currentContent}
            onChange={(val) => updateFileContent(activeFilePath, val ?? "")}
            onMount={handleEditorMount}
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              inlineCompletionsEnabled: true,
              quickSuggestions: true,
              wordWrap: "on",
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
            <FileCode size={40} className="mb-3 text-slate-700 stroke-[1.2]" />
            <p>No file selected</p>
            <p className="text-[11px] text-slate-600 mt-1">Select a file from the explorer or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
