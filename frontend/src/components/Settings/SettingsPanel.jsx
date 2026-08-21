import { useState } from "react";

export function SettingsPanel({ onClose }) {
    const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("ai-ide-gemini-key") || "");
    const [groqKey, setGroqKey] = useState(() => localStorage.getItem("ai-ide-groq-key") || "");
    const [wordWrap, setWordWrap] = useState(() => localStorage.getItem("ai-ide-editor-wordwrap") !== "false");
    const [minimap, setMinimap] = useState(() => localStorage.getItem("ai-ide-editor-minimap") !== "false");
    const [savedSuccess, setSavedSuccess] = useState(false);

    const handleSave = () => {
        localStorage.setItem("ai-ide-gemini-key", geminiKey);
        localStorage.setItem("ai-ide-groq-key", groqKey);
        localStorage.setItem("ai-ide-editor-wordwrap", wordWrap.toString());
        localStorage.setItem("ai-ide-editor-minimap", minimap.toString());

        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
    };

    return (
        <div className="h-full flex flex-col bg-slate-900 border-r border-slate-800 text-slate-200 p-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-400">IDE Settings</h2>
                {onClose && (
                    <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="space-y-6 flex-1">
                {/* API Credentials */}
                <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">LLM Provider Keys</h3>

                    <div>
                        <label className="block text-xs text-slate-300 mb-1">Google Gemini API Key</label>
                        <input
                            type="password"
                            placeholder="AIzaSy..."
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-slate-300 mb-1">Groq API Key</label>
                        <input
                            type="password"
                            placeholder="gsk_..."
                            value={groqKey}
                            onChange={(e) => setGroqKey(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 transition"
                        />
                    </div>
                </div>

                {/* Editor Settings */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    <h3 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide">Monaco Preferences</h3>

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">Word Wrap</span>
                        <input
                            type="checkbox"
                            checked={wordWrap}
                            onChange={(e) => setWordWrap(e.target.checked)}
                            className="h-4 w-4 rounded accent-cyan-500 bg-slate-950 border-slate-800 cursor-pointer"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-300">Enable Minimap</span>
                        <input
                            type="checkbox"
                            checked={minimap}
                            onChange={(e) => setMinimap(e.target.checked)}
                            className="h-4 w-4 rounded accent-cyan-500 bg-slate-950 border-slate-800 cursor-pointer"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-800 mt-auto">
                {savedSuccess && (
                    <div className="mb-2 p-2 bg-emerald-950/60 border border-emerald-800/50 rounded text-xs text-emerald-400 text-center font-medium">
                        Settings Saved!
                    </div>
                )}
                <button
                    onClick={handleSave}
                    className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded transition shadow-lg shadow-cyan-950/50"
                >
                    Save Configuration
                </button>
            </div>
        </div>
    );
}