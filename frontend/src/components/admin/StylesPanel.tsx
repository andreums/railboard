import React from "react";
import type { Config } from "../../lib/api";

type Props = {
    config: Config;
    setConfig: (c: Config) => void;
    onSaveStyles: () => void;
};

export default function StylesPanel({ config, setConfig, onSaveStyles }: Props) {
    return (
        <section id="styles" className="bg-board-row rounded-lg p-6">
            <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Estilos</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Fondo</label>
                    <input type="color" className="w-full bg-black/40 rounded px-1 py-1.5 h-9" value={config.bgColor || "#050a14"} onChange={(e) => setConfig({ ...config, bgColor: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Header fondo</label>
                    <input type="color" className="w-full bg-black/40 rounded px-1 py-1.5 h-9" value={config.headerBgColor || "#BFEFD5"} onChange={(e) => setConfig({ ...config, headerBgColor: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Header texto</label>
                    <input type="color" className="w-full bg-black/40 rounded px-1 py-1.5 h-9" value={config.headerTextColor || "#f5f3ec"} onChange={(e) => setConfig({ ...config, headerTextColor: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Fila par</label>
                    <input type="color" className="w-full bg-black/40 rounded px-1 py-1.5 h-9" value={config.rowBgColor || "#1A3254"} onChange={(e) => setConfig({ ...config, rowBgColor: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Fila impar</label>
                    <input type="color" className="w-full bg-black/40 rounded px-1 py-1.5 h-9" value={config.altBgColor || "#102341"} onChange={(e) => setConfig({ ...config, altBgColor: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Tamaño destino (px)</label>
                    <input type="number" className="w-full bg-black/40 rounded px-3 py-2" min="20" max="100" value={parseInt(config.destinationFontSize || "48")} onChange={(e) => setConfig({ ...config, destinationFontSize: e.target.value })} />
                </div>
            </div>
            <button type="button" onClick={onSaveStyles} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full mt-5">Guardar estilos</button>
        </section>
    );
}
