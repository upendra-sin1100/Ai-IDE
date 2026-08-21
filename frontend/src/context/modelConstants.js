import { createContext, useContext } from "react";

export const ModelContext = createContext(null);

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
}
