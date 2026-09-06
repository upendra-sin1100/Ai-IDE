import { useState } from "react";
import { FileTreeNode } from "./FileTreeNode";
import { useWorkspace } from "../../hooks/useWorkspace";
import { FilePlus, FolderPlus, RefreshCw, FolderTree } from "lucide-react";

export function FileTree() {
  const { tree, loadingTree, activeFilePath, openFile, createNewFile, deleteExistingFile, renameExistingFile, refreshTree, error } = useWorkspace();

  const [createModal, setCreateModal] = useState({ open: false, isDir: false, parentPath: "" });
  const [itemName, setItemName] = useState("");

  const handleOpenCreate = (parentPath = "", isDir = false) => {
    setCreateModal({ open: true, isDir, parentPath });
    setItemName("");
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    const fullPath = createModal.parentPath ? `${createModal.parentPath}/${itemName.trim()}` : itemName.trim();
    await createNewFile(fullPath, createModal.isDir);
    setCreateModal({ open: false, isDir: false, parentPath: "" });
    setItemName("");
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800/80 w-64 select-none shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/80">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200 tracking-wide uppercase">
          <FolderTree size={15} className="text-cyan-400" />
          <span>Explorer</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <button
            title="New File"
            onClick={() => handleOpenCreate("", false)}
            className="p-1 hover:bg-slate-800 hover:text-cyan-300 rounded transition-colors"
          >
            <FilePlus size={14} />
          </button>
          <button
            title="New Folder"
            onClick={() => handleOpenCreate("", true)}
            className="p-1 hover:bg-slate-800 hover:text-amber-300 rounded transition-colors"
          >
            <FolderPlus size={14} />
          </button>
          <button
            title="Refresh Explorer"
            onClick={refreshTree}
            className={`p-1 hover:bg-slate-800 hover:text-white rounded transition-colors ${loadingTree ? "animate-spin text-cyan-400" : ""}`}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Creation Modal / Form */}
      {createModal.open && (
        <form onSubmit={handleCreateSubmit} className="p-2 border-b border-slate-800 bg-slate-950">
          <div className="text-[11px] text-slate-400 mb-1">
            New {createModal.isDir ? "Folder" : "File"} {createModal.parentPath ? `in ${createModal.parentPath}` : "in root"}:
          </div>
          <input
            type="text"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder={createModal.isDir ? "folder-name" : "filename.js / index.php"}
            autoFocus
            className="w-full bg-slate-900 text-white text-xs px-2 py-1 rounded border border-cyan-500/50 outline-none focus:border-cyan-400"
          />
          <div className="flex justify-end gap-1 mt-1.5">
            <button
              type="button"
              onClick={() => setCreateModal({ open: false, isDir: false, parentPath: "" })}
              className="text-[10px] px-2 py-0.5 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-[10px] px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="px-3 py-1.5 bg-red-950/40 border-b border-red-800/50 text-red-300 text-[11px]">
          {error}
        </div>
      )}

      {/* Tree Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 && !loadingTree ? (
          <div className="p-4 text-center text-xs text-slate-500">Workspace is empty</div>
        ) : (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              onSelect={openFile}
              activeFilePath={activeFilePath}
              onCreate={(parentPath) => handleOpenCreate(parentPath, false)}
              onDelete={deleteExistingFile}
              onRename={renameExistingFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
