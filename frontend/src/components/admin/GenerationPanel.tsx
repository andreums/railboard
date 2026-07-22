import React from "react";
import { api } from "../../lib/api";

type Props = {
  onRefresh: () => Promise<void>;
  autoGen: boolean;
  setAutoGen: (v: boolean) => void;
  autoInterval: number;
  setAutoInterval: (n: number) => void;
};

export default function GenerationPanel({ onRefresh, autoGen, setAutoGen, autoInterval, setAutoInterval }: Props) {
  const generateOne = async () => {
    await api.generateRandomTrain();
    await onRefresh();
  };
  const seedTrains = async () => {
    await api.seedTrains();
    await onRefresh();
  };
  const clearTrains = async () => {
    if (!confirm("¿Borrar todos los trenes?")) return;
    await api.clearTrains();
    await onRefresh();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <span>🎲</span> Generación de trenes
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={generateOne}
          className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
        >
          Generar 1 tren
        </button>
        <button
          type="button"
          onClick={() => setAutoGen(!autoGen)}
          className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm ${
            autoGen ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
          aria-pressed={autoGen}
        >
          {autoGen ? "Detener auto" : "Auto-generar"}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-sm text-slate-500">Intervalo (s)</label>
        <input
          type="number"
          min={1}
          value={autoInterval}
          onChange={(e) => setAutoInterval(Number(e.target.value))}
          className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 focus:border-blue-900 focus:outline-none"
        />
      </div>
      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={seedTrains}
          className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Cargar trenes ficticios
        </button>
        <button
          type="button"
          onClick={clearTrains}
          className="inline-flex w-full items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
        >
          Borrar todos los trenes
        </button>
      </div>
    </div>
  );
}
