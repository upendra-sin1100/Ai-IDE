import React from "react";

const SHORTCUTS = [
    { key: "Ctrl + B", description: "Toggle File Explorer Sidebar" },
    { key: "Ctrl + J", description: "Toggle Terminal Panel" },
    { key: "Ctrl + Shift + I", description: "Toggle AI Assistant Chat" },
    { key: "Ctrl + ,", description: "Open Settings Panel" },
    { key: "Ctrl + Shift + P", description: "Open Command Palette" },
    { key: "Ctrl + S", description: "Save Active Workspace File" },
    { key: "Ctrl + Enter", description: "Send AI Prompt in Chat" },
];

export function KeyboardShortcutsDialog({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        <h3 className="font-semibold text-slate-100 text-lg">Keyboard Shortcuts</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="mt-4 space-y-2 max-h-80 overflow-y-auto pr-1">
                    {SHORTCUTS.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/60 hover:border-slate-700 transition">
                            <span className="text-sm text-slate-300">{item.description}</span>
                            <kbd className="px-2 py-1 text-xs font-mono font-medium text-cyan-300 bg-slate-800 border border-slate-700 rounded shadow-inner">
                                {item.key}
                            </kbd>
                        </div>
                    ))}
                </div>

                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}