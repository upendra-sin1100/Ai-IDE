import { useWorkspaceContext } from "../context/workspaceHelpers";

export function useWorkspace() {
  return useWorkspaceContext();
}
