import React from "react";
import type { Config } from "../../lib/api";
import { LANGUAGES, type Language } from "../../lib/i18n";

type Props = {
    config: Config;
    setConfig: (c: Config) => void;
    onSave: () => void;
};

export default function StationPanel({ config, setConfig, onSave }: Props) {
    const languages: Language[] = (config.languages?.length ? config.languages : [(config.language as Language) || "es"]) as Language[];
    const updateLanguages = (next: Language[]) => setConfig({ ...config, language: next[0] || "es", languages: next.length ? next : ["es"] });
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
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Displays</label>
                        <select
                          className="w-full bg-black/40 rounded px-3 py-2"
                          value={config.displayMode || "multiple"}
                          onChange={(e) => setConfig({ ...config, displayMode: e.target.value as Config["displayMode"] })}
                        >
                            <option value="single">Solo un display</option>
                            <option value="multiple">Múltiples displays</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Idiomas</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(LANGUAGES).map(([code, name]) => {
                                const language = code as Language;
                                const active = languages.includes(language);
                                const next = active ? languages.filter((item) => item !== language) : [...languages, language];
                                return (
                                    <label key={code} className={`flex items-center gap-2 rounded px-3 py-2 border cursor-pointer ${active ? "border-amber-400/60 bg-amber-400/10" : "border-white/10 bg-black/30"}`}>
                                        <input type="checkbox" checked={active} onChange={(e) => updateLanguages(e.target.checked ? [...languages, language] : (next.length ? next : [language]))} />
                                        <span>{name}</span>
                                    </label>
                                );
                            })}
                        </div>
                        <p className="text-[11px] text-board-dim mt-2">El primer idioma es el principal.</p>
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
