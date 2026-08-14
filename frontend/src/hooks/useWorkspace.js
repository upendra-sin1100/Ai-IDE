import { useWorkspaceContext } from "../context/WorkspaceContext";

export function useWorkspace() {
  return useWorkspaceContext();
}
