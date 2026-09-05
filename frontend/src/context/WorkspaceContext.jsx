import { useState, useEffect, useCallback } from "react";
import * as workspaceApi from "../api/workspace";
import { WorkspaceContext } from "./workspaceHelpers";
import { useAuth } from "./AuthContext";

export function WorkspaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [tree, setTree] = useState([]);
  const [openTabs, setOpenTabs] = useState([]);
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [fileContents, setFileContents] = useState({});
  const [dirtyFiles, setDirtyFiles] = useState({});
  const [loadingTree, setLoadingTree] = useState(false);
  const [error, setError] = useState(null);

  const refreshTree = useCallback(async () => {
    setLoadingTree(true);
    setError(null);
    try {
      const data = await workspaceApi.getTree();
      setTree(data);
    } catch (err) {
      setError(err.message || "Failed to load workspace tree");
    } finally {
      setLoadingTree(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialTree = async () => {
      try {
        const data = await workspaceApi.getTree();
        if (isMounted) setTree(data);
      } catch (err) {
        if (isMounted) setError(err.message || "Failed to load workspace tree");
      }
    };
    fetchInitialTree();
    return () => {
      isMounted = false;
    };
  }, []);

  const openFile = useCallback(async (path) => {
    if (!path) return;
    setError(null);

    if (!openTabs.includes(path)) {
      setOpenTabs((prev) => [...prev, path]);
    }
    setActiveFilePath(path);

    if (fileContents[path] === undefined) {
      try {
        const res = await workspaceApi.readFile(path);
        setFileContents((prev) => ({ ...prev, [path]: res.content }));
      } catch (err) {
        setError(`Failed to read ${path}: ${err.message}`);
      }
    }
  }, [openTabs, fileContents]);

  const closeTab = useCallback((path) => {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      if (activeFilePath === path) {
        setActiveFilePath(next.length > 0 ? next[next.length - 1] : null);
      }
      return next;
    });
  }, [activeFilePath]);

  const updateFileContent = useCallback((path, newContent) => {
    setFileContents((prev) => ({ ...prev, [path]: newContent }));
    setDirtyFiles((prev) => ({ ...prev, [path]: true }));
  }, []);

  const saveFile = useCallback(async (path = activeFilePath) => {
    if (!path) return;
    const content = fileContents[path] ?? "";
    setError(null);
    try {
      await workspaceApi.writeFile(path, content);
      setDirtyFiles((prev) => ({ ...prev, [path]: false }));
      refreshTree();
    } catch (err) {
      setError(`Failed to save ${path}: ${err.message}`);
    }
  }, [activeFilePath, fileContents, refreshTree]);

  const createNewFile = useCallback(async (path, isDir = false) => {
    setError(null);
    try {
      await workspaceApi.createFile(path, isDir);
      await refreshTree();
      if (!isDir) {
        await openFile(path);
      }
    } catch (err) {
      setError(`Failed to create ${path}: ${err.message}`);
    }
  }, [refreshTree, openFile]);

  const deleteExistingFile = useCallback(async (path) => {
    setError(null);
    try {
      await workspaceApi.deleteFile(path);
      closeTab(path);
      setFileContents((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[path];
        return next;
      });
      refreshTree();
    } catch (err) {
      setError(`Failed to delete ${path}: ${err.message}`);
    }
  }, [closeTab, refreshTree]);

  const renameExistingFile = useCallback(async (oldPath, newPath) => {
    setError(null);
    try {
      await workspaceApi.renameFile(oldPath, newPath);
      setOpenTabs((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
      if (activeFilePath === oldPath) {
        setActiveFilePath(newPath);
      }
      setFileContents((prev) => {
        const next = { ...prev };
        if (next[oldPath] !== undefined) {
          next[newPath] = next[oldPath];
          delete next[oldPath];
        }
        return next;
      });
      setDirtyFiles((prev) => {
        const next = { ...prev };
        if (next[oldPath] !== undefined) {
          next[newPath] = next[oldPath];
          delete next[oldPath];
        }
        return next;
      });
      refreshTree();
    } catch (err) {
      setError(`Failed to rename ${oldPath}: ${err.message}`);
    }
  }, [activeFilePath, refreshTree]);

  const acceptProposedEdit = useCallback(async ({ file_path, content }) => {
    setError(null);
    try {
      try {
        await workspaceApi.createFile(file_path, false);
      } catch {
        /* file might already exist if editing */
      }
      await workspaceApi.writeFile(file_path, content);
      setFileContents((prev) => ({ ...prev, [file_path]: content }));
      setDirtyFiles((prev) => ({ ...prev, [file_path]: false }));
      if (!openTabs.includes(file_path)) {
        setOpenTabs((prev) => [...prev, file_path]);
      }
      setActiveFilePath(file_path);
      refreshTree();
    } catch (err) {
      setError(`Failed to apply edit to ${file_path}: ${err.message}`);
    }
  }, [openTabs, refreshTree]);

  return (
    <WorkspaceContext.Provider
      value={{
        tree,
        loadingTree,
        openTabs,
        activeFilePath,
        fileContents,
        dirtyFiles,
        error,
        refreshTree,
        openFile,
        closeTab,
        setActiveFilePath,
        updateFileContent,
        saveFile,
        createNewFile,
        deleteExistingFile,
        renameExistingFile,
        acceptProposedEdit,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
