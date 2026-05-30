import React from "react";
import type { Config } from "../../lib/api";

type Props = {
    config: Config;
    setConfig: (c: Config) => void;
    onSave: () => void;
};

export default function StationPanel({ config, setConfig, onSave }: Props) {
    return (
        <section id="station" className="bg-board-row rounded-lg p-6">
            <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Estación</h2>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Logo</label>
                    <div className="flex gap-2">
                        <input className="flex-1 bg-black/40 rounded px-3 py-2" placeholder="https://..." value={config.logo_url || ""} onChange={(e) => setConfig({ ...config, logo_url: e.target.value })} />
                        <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setConfig({ ...config, logo_url: ev.target?.result as string }); r.readAsDataURL(f); } }} />
                    </div>
                    {config.logo_url && <img src={config.logo_url} className="h-8 mt-2" alt="Logo" />}
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Nombre</label>
                    <input className="w-full bg-black/40 rounded px-3 py-2" value={config.station_name} onChange={(e) => setConfig({ ...config, station_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Modo</label>
                        <select className="w-full bg-black/40 rounded px-3 py-2" value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as Config["mode"] })}>
                            <option value="departures">Salidas</option>
                            <option value="arrivals">Llegadas</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Idioma</label>
                        <select className="w-full bg-black/40 rounded px-3 py-2" value={(config.language as any) ?? "es"} onChange={(e) => setConfig({ ...config, language: e.target.value as any })}>
                            <option value="es">Español</option>
                            <option value="ca">Català</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Texto pie de pantalla</label>
                    <input className="w-full bg-black/40 rounded px-3 py-2" value={config.footerText || ""} onChange={(e) => setConfig({ ...config, footerText: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Reloj</label>
                        <select className="w-full bg-black/40 rounded px-3 py-2" value={config.clockMode || "real"} onChange={(e) => setConfig({ ...config, clockMode: e.target.value as any })}>
                            <option value="real">Sistema</option>
                            <option value="fake">Ficticio</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Hora ficticia</label>
                        <input type="time" step="1" className="w-full bg-black/40 rounded px-3 py-2" value={config.clockFakeTime || "12:00:00"} onChange={(e) => setConfig({ ...config, clockFakeTime: e.target.value })} disabled={(config.clockMode || "real") !== "fake"} />
                    </div>
                    <div>
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Avance</label>
                        <select className="w-full bg-black/40 rounded px-3 py-2" value={config.clockFakeStepSeconds || "1"} onChange={(e) => setConfig({ ...config, clockFakeStepSeconds: e.target.value })} disabled={(config.clockMode || "real") !== "fake"}>
                            {[1, 2, 5, 10, 15].map((seconds) => (
                                <option key={seconds} value={String(seconds)}>{seconds}s / segundo</option>
                            ))}
                        </select>
                    </div>
                </div>
                <button type="button" onClick={onSave} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full">Guardar</button>
            </div>
        </section>
    );
}
