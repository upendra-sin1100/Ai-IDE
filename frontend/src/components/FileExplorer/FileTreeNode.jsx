import { useState } from "react";
import { Folder, FolderOpen, FileCode, FileCode2, FileText, Coffee, Plus, Trash2, Edit2, ChevronRight, ChevronDown } from "lucide-react";

export function FileTreeNode({ node, level = 0, onSelect, activeFilePath, onCreate, onDelete, onRename }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);

  const isActive = activeFilePath === node.path;
  const paddingLeft = level * 16 + 12;

  const handleToggle = (e) => {
    e.stopPropagation();
    if (node.is_dir) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (renameValue && renameValue !== node.name) {
      const parentPath = node.path.includes("/")
        ? node.path.substring(0, node.path.lastIndexOf("/"))
        : "";
      const newPath = parentPath ? `${parentPath}/${renameValue}` : renameValue;
      onRename(node.path, newPath);
    }
    setIsRenaming(false);
  };

  const getFileIcon = (name) => {
    const lowerName = name.toLowerCase();
    if (lowerName.endsWith(".java")) {
      return <Coffee size={15} className="text-orange-400 shrink-0" />;
    }
    if (lowerName.endsWith(".c") || lowerName.endsWith(".h") || lowerName.endsWith(".cpp") || lowerName.endsWith(".cxx") || lowerName.endsWith(".cc")) {
      return <FileCode2 size={15} className="text-sky-400 shrink-0" />;
    }
    if (lowerName.endsWith(".js") || lowerName.endsWith(".jsx") || lowerName.endsWith(".ts") || lowerName.endsWith(".tsx")) {
      return <FileCode size={15} className="text-yellow-400 shrink-0" />;
    }
    if (lowerName.endsWith(".php")) {
      return <FileCode size={15} className="text-indigo-400 shrink-0" />;
    }
    if (lowerName.endsWith(".json") || lowerName.endsWith(".py") || lowerName.endsWith(".html") || lowerName.endsWith(".css")) {
      return <FileCode size={15} className="text-blue-400 shrink-0" />;
    }
    return <FileText size={15} className="text-slate-400 shrink-0" />;
  };

  return (
    <div>
      <div
        className={`group flex items-center justify-between py-1.5 pr-2 text-xs font-mono cursor-pointer transition-colors select-none ${isActive ? "bg-cyan-500/20 text-cyan-300 font-medium" : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
          }`}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {node.is_dir ? (
            <>
              {isOpen ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
              {isOpen ? <FolderOpen size={15} className="text-amber-400 shrink-0" /> : <Folder size={15} className="text-amber-400 shrink-0" />}
            </>
          ) : (
            <>
              <span className="w-3.5" />
              {getFileIcon(node.name)}
            </>
          )}

          {isRenaming ? (
            <form onSubmit={handleRenameSubmit} className="flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
                className="w-full bg-slate-950 text-white px-1.5 py-0.5 rounded border border-cyan-500 outline-none text-xs"
              />
            </form>
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </div>

        {isHovered && !isRenaming && (
          <div className="flex items-center gap-1 opacity-90" onClick={(e) => e.stopPropagation()}>
            {node.is_dir && (
              <button
                title="Create item in directory"
                onClick={() => onCreate(node.path)}
                className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded"
              >
                <Plus size={13} />
              </button>
            )}
            <button
              title="Rename"
              onClick={() => setIsRenaming(true)}
              className="p-1 hover:bg-slate-700 text-slate-300 hover:text-white rounded"
            >
              <Edit2 size={12} />
            </button>
            <button
              title="Delete"
              onClick={() => onDelete(node.path)}
              className="p-1 hover:bg-red-950 text-red-400 hover:text-red-300 rounded"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {node.is_dir && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              onSelect={onSelect}
              activeFilePath={activeFilePath}
              onCreate={onCreate}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}
