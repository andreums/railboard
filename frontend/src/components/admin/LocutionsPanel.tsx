import React from "react";
import { api } from "../../lib/api";
import { speak, type AnnouncePreset } from "../../lib/tts";

type Props = {
    departureTmpl: string;
    setDepartureTmpl: (s: string) => void;
    arrivalTmpl: string;
    setArrivalTmpl: (s: string) => void;
    presets: AnnouncePreset[];
    setPresets: (p: AnnouncePreset[]) => void;
    newPreset: { label: string; text: string };
    setNewPreset: (p: { label: string; text: string }) => void;
    showModal: (title: string, message: string, type?: "success" | "error") => void;
};

export default function LocutionsPanel({ departureTmpl, setDepartureTmpl, arrivalTmpl, setArrivalTmpl, presets, setPresets, newPreset, setNewPreset, showModal }: Props) {
    const save = async () => {
        try {
            await api.setConfig({ announce_departure: departureTmpl, announce_arrival: arrivalTmpl, announce_presets: JSON.stringify(presets) });
            showModal("Locuciones guardadas", "Las plantillas y locuciones se han guardado.", "success");
        } catch (err: any) {
            showModal("Error", err.message || "No se pudieron guardar las locuciones.", "error");
        }
    };

    return (
        <section id="locuciones" className="bg-board-row rounded-lg p-6 lg:col-span-2">
            <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Locuciones</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Plantilla salidas</label>
                    <textarea rows={3} className="w-full bg-black/40 rounded px-3 py-2 font-mono text-sm" value={departureTmpl} onChange={(e) => setDepartureTmpl(e.target.value)} />
                    <div className="text-xs text-board-dim mt-1">Variables: <code className="text-board-amber">{"{number}"}</code> <code className="text-board-amber">{"{type_name}"}</code> <code className="text-board-amber">{"{destination}"}</code> <code className="text-board-amber">{"{platform}"}</code> <code className="text-board-amber">{"{sector}"}</code></div>
                    <button type="button" onClick={() => speak(departureTmpl.replace(/\{(\w+)\}/g, "ejemplo"))} className="mt-2 text-sm text-board-green underline">Probar</button>
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Plantilla llegadas</label>
                    <textarea rows={3} className="w-full bg-black/40 rounded px-3 py-2 font-mono text-sm" value={arrivalTmpl} onChange={(e) => setArrivalTmpl(e.target.value)} />
                    <div className="text-xs text-board-dim mt-1">Variables: <code className="text-board-amber">{"{number}"}</code> <code className="text-board-amber">{"{type_name}"}</code> <code className="text-board-amber">{"{origin}"}</code> <code className="text-board-amber">{"{platform}"}</code> <code className="text-board-amber">{"{sector}"}</code></div>
                    <button type="button" onClick={() => speak(arrivalTmpl.replace(/\{(\w+)\}/g, "ejemplo"))} className="mt-2 text-sm text-board-green underline">Probar</button>
                </div>
            </div>

            <button type="button" onClick={save} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded mb-6">Guardar plantillas</button>

            <h3 className="font-display text-xl mb-3">Locuciones predefinidas</h3>
            <div className="space-y-2 mb-4">
                {presets.map((p) => (
                    <div key={p.id} className="flex items-start gap-3 bg-black/20 rounded p-3">
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm">{p.label}</div>
                            <div className="text-board-dim text-sm truncate">{p.text}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => speak(p.text)} className="text-board-green text-sm" title="Escuchar">🔊</button>
                            <button type="button" onClick={() => { setNewPreset({ label: p.label, text: p.text }); setPresets(presets.filter((x) => x.id !== p.id)); }} className="text-board-amber text-sm" title="Editar">Editar</button>
                            <button type="button" onClick={() => setPresets(presets.filter((x) => x.id !== p.id))} className="text-board-red text-sm" title="Eliminar">✕</button>
                        </div>
                    </div>
                ))}
                {presets.length === 0 && <div className="text-board-dim text-sm">Sin locuciones predefinidas</div>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input className="bg-black/40 rounded px-3 py-2" placeholder="Etiqueta (ej: Apertura)" value={newPreset.label} onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })} />
                <input className="bg-black/40 rounded px-3 py-2 sm:col-span-1" placeholder="Texto de la locución" value={newPreset.text} onChange={(e) => setNewPreset({ ...newPreset, text: e.target.value })} />
                <button type="button" onClick={() => { if (!newPreset.label.trim() || !newPreset.text.trim()) return; const id = newPreset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-"); setPresets([...presets, { id, label: newPreset.label, text: newPreset.text }]); setNewPreset({ label: "", text: "" }); }} className="bg-board-green text-board-bg font-bold px-4 py-2 rounded">Añadir locución</button>
            </div>
        </section>
    );
}
