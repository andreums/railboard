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
    const generateOne = async () => { await api.generateRandomTrain(); await onRefresh(); };
    const seedTrains = async () => { await api.seedTrains(); await onRefresh(); };
    const clearTrains = async () => { if (!confirm("¿Borrar todos los trenes?")) return; await api.clearTrains(); await onRefresh(); };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={generateOne} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded">Generar 1 tren</button>
                <button type="button" onClick={() => setAutoGen(!autoGen)} className={`font-bold px-4 py-2 rounded ${autoGen ? 'bg-board-red text-white' : 'bg-board-green text-board-bg'}`} aria-pressed={autoGen}>
                    {autoGen ? 'Detener auto' : 'Auto-generar'}
                </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
                <label className="text-sm text-board-dim">Intervalo (s)</label>
                <input type="number" min={1} value={autoInterval} onChange={(e) => setAutoInterval(Number(e.target.value))} className="w-20 bg-black/40 rounded px-2 py-1" />
            </div>
            <div className="grid grid-cols-1 gap-2">
                <button type="button" onClick={seedTrains} className="bg-board-green text-board-bg font-bold px-4 py-2 rounded w-full">Cargar trenes ficticios</button>
                <button type="button" onClick={clearTrains} className="bg-board-red text-white font-bold px-4 py-2 rounded w-full">Borrar todos los trenes</button>
            </div>
        </div>
    );
}
