import { useEffect, useState } from "react";
import {
  api, connectWS,
  type Config, type Place,
} from "../lib/api";
import { LANGUAGES, type Language } from "../lib/i18n";

export default function Admin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [newPlace, setNewPlace] = useState("");

  const refresh = async () => {
    const [c, pl] = await Promise.all([
      api.getConfig(), api.listPlaces(),
    ]);
    setConfig(c); setPlaces(pl);
  };

  useEffect(() => { refresh(); return connectWS(refresh); }, []);

  if (!config) return <div className="p-10 text-board-dim">Cargando…</div>;

  return (
    <div className="min-h-screen bg-board-bg text-board-ink p-8 font-body">
      <header className="flex justify-between items-center mb-8">
        <h1 className="font-display text-4xl tracking-wide">RailBoard · Admin</h1>
        <div className="flex gap-4 items-center">
          <a href="/train-settings" className="text-board-amber underline text-sm">Tipos y operadores</a>
          <a href="/trains" className="text-board-amber underline">Trenes</a>
          <a href="/" target="_blank" className="text-board-amber underline">
            Pantalla pública →
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Station Config */}
        <section className="bg-board-row rounded-lg p-6">
          <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Estación</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Logo</label>
              <div className="flex gap-2">
                <input className="flex-1 bg-black/40 rounded px-3 py-2" placeholder="https://..." value={config.logo_url || ""} onChange={(e) => setConfig({ ...config, logo_url: e.target.value })} />
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = (ev) => setConfig({ ...config, logo_url: ev.target?.result as string }); r.readAsDataURL(f); }}} />
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
                <select className="w-full bg-black/40 rounded px-3 py-2" value={(config.language as Language) ?? "es"} onChange={(e) => setConfig({ ...config, language: e.target.value as Language })}>
                  {Object.entries(LANGUAGES).map(([code, name]) => (<option key={code} value={code}>{name}</option>))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-board-dim uppercase tracking-wider mb-1.5">Texto pie de pantalla</label>
              <input className="w-full bg-black/40 rounded px-3 py-2" value={config.footerText || ""} onChange={(e) => setConfig({ ...config, footerText: e.target.value })} />
            </div>
            <button onClick={() => api.setConfig(config)} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full">Guardar</button>
          </div>
        </section>

        {/* Styling */}
        <section className="bg-board-row rounded-lg p-6">
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
          <button onClick={() => api.setConfig(config)} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full mt-5">Guardar estilos</button>
        </section>

        {/* Places */}
        <section className="bg-board-row rounded-lg p-6 lg:col-span-2">
          <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Lugares / destinos</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {places.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 bg-black/30 rounded-full px-3 py-1.5 text-sm">
                {p.name}
                <button onClick={() => api.deletePlace(p.id).then(refresh)} className="text-board-red hover:text-white leading-none">✕</button>
              </span>
            ))}
            {places.length === 0 && <span className="text-board-dim text-sm">Vacío</span>}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-black/40 rounded px-3 py-2" placeholder="Nuevo lugar" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} />
            <button onClick={async () => { if (newPlace) { await api.createPlace(newPlace); setNewPlace(""); refresh(); }}} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded">+</button>
          </div>
        </section>
      </div>
    </div>
  );
}
