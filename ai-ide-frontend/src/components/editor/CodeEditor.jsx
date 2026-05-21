import React from 'react';
import Editor from '@monaco-editor/react';

export default function CodeEditor({ code, onChange, language = "javascript" }) {
    return (
        <div className="h-full w-full bg-[#141414]">
            <Editor
                height="100%"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={onChange}
                options={{
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    minimap: { enabled: false },
                    automaticLayout: true,
                    cursorBlinking: "smooth",
                    smoothScrolling: true,
                    lineNumbers: "on",
                    padding: { top: 16, bottom: 16 },
                    overviewRulerBorder: false,
                    hideCursorInOverviewRuler: true,
                    scrollbar: {
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10,
                    }
                }}
            />
        </div>
    );
}