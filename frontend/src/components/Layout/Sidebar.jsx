import React from "react";
import { SettingsPanel } from "../Settings/SettingsPanel";

export function Sidebar({ activeTab, onTabChange, showSettings, onSettingsClose }) {
    // Sample file tree structure representation
    const files = [
        { name: "src", isFolder: true, children: ["App.jsx", "main.jsx", "index.css"] },
        { name: "package.json", isFolder: false },
        { name: "vite.config.js", isFolder: false },
    ];

    return (
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none">
            {/* Icon Tab Navigation Bar */}
            <div className="flex border-b border-slate-800 bg-slate-950/50">
                <button
                    onClick={() => { onTabChange("files"); if (showSettings) onSettingsClose(); }}
                    className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${activeTab === "files" && !showSettings
                            ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Files
                </button>

                <button
                    onClick={() => { onTabChange("search"); if (showSettings) onSettingsClose(); }}
                    className={`flex-1 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${activeTab === "search" && !showSettings
                            ? "border-cyan-500 text-cyan-400 bg-slate-900/50"
                            : "border-transparent text-slate-400 hover:text-slate-200"
                        }`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 0 0114 0z" />
                    </svg>
                    Search
                </button>
            </div>

            {/* Main Panel Content */}
            <div className="flex-1 overflow-y-auto">
                {showSettings ? (
                    <SettingsPanel onClose={onSettingsClose} />
                ) : activeTab === "files" ? (
                    <div className="p-3">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Explorer
                        </div>
                        <div className="space-y-1 font-mono text-xs">
                            {files.map((item, index) => (
                                <div key={index} className="space-y-1">
                                    <div className="flex items-center gap-1.5 py-1 px-1.5 rounded hover:bg-slate-800 text-slate-300 cursor-pointer">
                                        {item.isFolder ? "📁" : "📄"} <span>{item.name}</span>
                                    </div>
                                    {item.children && (
                                        <div className="pl-4 space-y-1 border-l border-slate-800/80 ml-2">
                                            {item.children.map((child, cIdx) => (
                                                <div key={cIdx} className="py-0.5 px-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300 cursor-pointer">
                                                    📄 {child}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="p-3">
                        <input
                            type="text"
                            placeholder="Search files (Ctrl+P)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                )}
            </div>
        </aside>
    );
}