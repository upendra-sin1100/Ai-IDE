import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { requestJson } from "../api/client";

const ModelContext = createContext(null);

export function ModelProvider({ children }) {
  const [selectedModel, setSelectedModel] = useState("gemini-1.5-flash");
  const [selectedProvider, setSelectedProvider] = useState("gemini");
  const [availableModels, setAvailableModels] = useState([
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "gemini" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "gemini" },
  ]);

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await requestJson("/models");
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          if (data.default_model) {
            setSelectedModel(data.default_model);
          }
          if (data.default_provider) {
            setSelectedProvider(data.default_provider);
          }
        }
      } catch (_) {
        // Fallback to default Gemini models
      }
    }
    loadModels();
  }, []);

  const value = useMemo(
    () => ({
      model: selectedModel,
      setModel: setSelectedModel,
      provider: selectedProvider,
      setProvider: setSelectedProvider,
      availableModels,
    }),
    [selectedModel, selectedProvider, availableModels]
  );

  return <ModelContext.Provider value={value}>{children}</ModelContext.Provider>;
}

export function useModel() {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error("useModel must be used within a ModelProvider");
  }
  return context;
}
