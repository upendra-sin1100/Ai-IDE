import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';

/**
 * ThinkingBlock Component
 * Displays AI thinking process extracted from <think> tags
 */
const ThinkingBlock = ({ content }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="w-full bg-[#0a0a0a]/50 border border-yellow-500/20 rounded-xl mb-3 overflow-hidden text-xs transition-all duration-300">
        <button 
          type="button"
          onClick={() => setIsOpen(!isOpen)} 
          className="w-full flex items-center justify-between p-2.5 bg-yellow-500/5 hover:bg-yellow-500/10 text-yellow-500/80 hover:text-yellow-400 transition-colors"
        >
          <span className="flex items-center gap-2 font-mono font-medium tracking-wide">
            <Sparkles size={12} className={isOpen ? "animate-pulse" : ""} />
            Thinking Process
          </span>
          <div className="bg-yellow-500/10 p-1 rounded-md">
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
        </button>
        <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-3.5 text-neutral-400 font-mono whitespace-pre-wrap leading-relaxed overflow-y-auto border-t border-yellow-500/10 bg-[#0a0a0a]">
            {content}
          </div>
        </div>
      </div>
    );
};

export default ThinkingBlock;
