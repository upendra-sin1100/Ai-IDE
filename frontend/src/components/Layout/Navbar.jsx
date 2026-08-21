import { useState } from "react";

export function Navbar({
    showTerminal,
    showChat,
    showSidebar,
    onToggleTerminal,
    onToggleChat,
    onToggleSidebar,
    onShowSettings,
    onShowShortcuts,
}) {
    const [selectedModel, setSelectedModel] = useState(() => {
        return localStorage.getItem("ai-ide-selected-model") || "gemini-1.5-pro";
    });

    const handleModelChange = (e) => {
        const val = e.target.value;
        setSelectedModel(val);
        localStorage.setItem("ai-ide-selected-model", val);
    };

    return (
        <header className="h-12 bg-slate-900 border-b border-slate-800/80 px-4 flex items-center justify-between select-none">
            {/* Left section: Logo & Sidebar Toggle */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onToggleSidebar}
                    title="Toggle Sidebar (Ctrl+B)"
                    className={`p-1.5 rounded transition ${showSidebar ? "text-cyan-400 bg-slate-800" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"}`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                    </svg>
                </button>

                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-black text-xs text-slate-950 shadow-md shadow-cyan-500/20">
                        AI
                    </div>
                    <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-slate-100 to-slate-400 bg-clip-text text-transparent">
                        DEV STUDIO
                    </span>
                </div>
            </div>

            {/* Center Section: Model Selection */}
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-xs font-medium text-slate-400 hidden sm:inline">Model:</span>
                <select
                    value={selectedModel}
                    onChange={handleModelChange}
                    className="bg-transparent text-xs font-semibold text-cyan-300 focus:outline-none cursor-pointer"
                >
                    <option value="gemini-1.5-pro" className="bg-slate-900 text-slate-200">Gemini 1.5 Pro</option>
                    <option value="gemini-1.5-flash" className="bg-slate-900 text-slate-200">Gemini 1.5 Flash</option>
                    <option value="llama-3-70b" className="bg-slate-900 text-slate-200">Groq Llama 3 70B</option>
                    <option value="mixtral-8x7b" className="bg-slate-900 text-slate-200">Groq Mixtral 8x7B</option>
                </select>
            </div>

            {/* Right Section: Action Controls */}
            <div className="flex items-center gap-1.5">
                <button
                    onClick={onShowShortcuts}
                    title="Keyboard Shortcuts"
                    className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                </button>

                <button
                    onClick={onToggleTerminal}
                    title="Toggle Terminal (Ctrl+J)"
                    className={`p-1.5 rounded transition ${showTerminal ? "text-cyan-400 bg-slate-800" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"}`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                </button>

                <button
                    onClick={onToggleChat}
                    title="Toggle AI Chat (Ctrl+Shift+I)"
                    className={`p-1.5 rounded transition ${showChat ? "text-cyan-400 bg-slate-800" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"}`}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                <button
                    onClick={onShowSettings}
                    title="Settings (Ctrl+,)"
                    className="p-1.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
            </div>
        </header>
    );
}