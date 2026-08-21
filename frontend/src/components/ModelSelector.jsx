import { useModel } from "../context/modelConstants";
import { Cpu } from "lucide-react";

export function ModelSelector() {
  const { model, setModel, availableModels } = useModel();

  return (
    <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded border border-slate-700 text-xs">
      <Cpu size={12} className="text-cyan-400 shrink-0" />
      <select
        value={model}
        onChange={(e) => setModel(e.target.value)}
        className="bg-transparent text-slate-200 text-[11px] font-mono outline-none cursor-pointer"
      >
        {availableModels.map((m) => (
          <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
            {m.label || m.id}
          </option>
        ))}
      </select>
    </div>
  );
}
