import { useEffect, useState, useRef } from "react";
import {
  api, connectWS,
  type Config, type Place,
} from "../lib/api";
import { LANGUAGES, type Language } from "../lib/i18n";

type Modal = { show: boolean; title: string; message: string; type: "success" | "error" };

export default function Admin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [newPlace, setNewPlace] = useState("");
  const [modal, setModal] = useState<Modal>({ show: false, title: "", message: "", type: "success" });

  const showModal = (title: string, message: string, type: "success" | "error" = "success") => {
    setModal({ show: true, title, message, type });
  };

  const closeModal = () => setModal({ ...modal, show: false });

  const refresh = async () => {
    const [c, pl] = await Promise.all([
      api.getConfig(), api.listPlaces(),
    ]);
    setConfig(c); setPlaces(pl);
  };

  useEffect(() => { refresh(); return connectWS(refresh); }, []);

  const handleSaveConfig = async () => {
    try {
      await api.setConfig(config!);
      showModal("Configuración guardada", "Los cambios se han guardado correctamente.", "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudo guardar la configuración.", "error");
    }
  };

  const handleSeedTrains = async () => {
    try {
      await api.seedTrains();
      await refresh();
      showModal("Trenes cargados", "Se han cargado 9 trenes ficticios.", "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudieron cargar los trenes.", "error");
    }
  };

  const handleClearTrains = async () => {
    if (!confirm("¿Borrar todos los trenes?")) return;
    try {
      await api.clearTrains();
      showModal("Trenes eliminados", "Se han borrado todos los trenes.", "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudieron borrar los trenes.", "error");
    }
  };

  const handleGenerateRandomBoard = async () => {
    try {
      await api.clearTrains();
      for (let i = 0; i < 8; i += 1) {
        await api.generateRandomTrain();
      }
      showModal("Panel random generado", "Se han generado 8 trenes con horarios escalonados.", "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudo generar el panel random.", "error");
    }
  };

  // Auto-generation of random trains
  const [autoGen, setAutoGen] = useState(false);
  const [autoInterval, setAutoInterval] = useState(5);
  const autoRef = useRef<number | null>(null);

  useEffect(() => {
    if (autoGen) {
      // start interval
      autoRef.current = window.setInterval(async () => {
        try {
          await api.generateRandomTrain();
          await refresh();
        } catch (e) {
          // ignore
        }
      }, Math.max(1000, autoInterval * 1000));
    } else {
      if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; }
    }
    return () => { if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; } };
  }, [autoGen, autoInterval]);

  const handleSaveStyles = async () => {
    try {
      await api.setConfig(config!);
      showModal("Estilos guardados", "Los estilos se han actualizado.", "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudieron guardar los estilos.", "error");
    }
  };

  const handleDeletePlace = async (id: number) => {
    try {
      await api.deletePlace(id);
      await refresh();
      showModal("Lugar eliminado", "El lugar se ha eliminado correctamente.", "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudo eliminar el lugar.", "error");
    }
  };

  const handleAddPlace = async () => {
    if (!newPlace.trim()) {
      showModal("Advertencia", "Ingresa un nombre para el lugar.", "error");
      return;
    }
    try {
      await api.createPlace(newPlace);
      setNewPlace("");
      await refresh();
      showModal("Lugar agregado", `${newPlace} se ha agregado correctamente.`, "success");
    } catch (err: any) {
      showModal("Error", err.message || "No se pudo agregar el lugar.", "error");
    }
  };

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
                <select className="w-full bg-black/40 rounded px-3 py-2" value={(config.language as Language) ?? "es"} onChange={(e) => setConfig({ ...config, language: e.target.value as Language })}>
                  {Object.entries(LANGUAGES).map(([code, name]) => (<option key={code} value={code}>{name}</option>))}
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
                <select className="w-full bg-black/40 rounded px-3 py-2" value={config.clockMode || "real"} onChange={(e) => setConfig({ ...config, clockMode: e.target.value as Config["clockMode"] })}>
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
            <button onClick={handleSaveConfig} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full">Guardar</button>
            <button onClick={handleSeedTrains} className="bg-board-green text-board-bg font-bold px-4 py-2 rounded w-full mt-2">Cargar trenes ficticios</button>
            <button onClick={handleGenerateRandomBoard} className="bg-board-green text-board-bg font-bold px-4 py-2 rounded w-full mt-2">Generar panel random</button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => { api.generateRandomTrain().then(refresh); }} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded">Generar 1 tren</button>
              <button onClick={() => { setAutoGen(!autoGen); }} className={`font-bold px-4 py-2 rounded ${autoGen ? 'bg-board-red text-white' : 'bg-board-green text-board-bg'}`}>
                {autoGen ? 'Detener auto' : 'Auto-generar'}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-sm text-board-dim">Intervalo (s)</label>
              <input type="number" min={1} value={autoInterval} onChange={(e) => setAutoInterval(Number(e.target.value))} className="w-20 bg-black/40 rounded px-2 py-1" />
            </div>
            <button onClick={handleClearTrains} className="bg-board-red text-white font-bold px-4 py-2 rounded w-full mt-2">Borrar todos los trenes</button>
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
          <button onClick={handleSaveStyles} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded w-full mt-5">Guardar estilos</button>
        </section>

        {/* Places */}
        <section className="bg-board-row rounded-lg p-6 lg:col-span-2">
          <h2 className="font-display text-2xl mb-5 pb-3 border-b border-white/10">Lugares / destinos</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {places.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-2 bg-black/30 rounded-full px-3 py-1.5 text-sm">
                {p.name}
                <button onClick={() => handleDeletePlace(p.id)} className="text-board-red hover:text-white leading-none">✕</button>
              </span>
            ))}
            {places.length === 0 && <span className="text-board-dim text-sm">Vacío</span>}
          </div>
          <div className="flex gap-2">
            <input className="flex-1 bg-black/40 rounded px-3 py-2" placeholder="Nuevo lugar" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleAddPlace()} />
            <button onClick={handleAddPlace} className="bg-board-amber text-board-bg font-bold px-4 py-2 rounded">+</button>
          </div>
        </section>
      </div>

      {/* Modal */}
      {modal.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-board-row rounded-lg p-6 max-w-sm w-full shadow-2xl border border-white/10">
            <h3 className={`text-xl font-bold mb-2 ${modal.type === "success" ? "text-board-green" : "text-board-red"}`}>
              {modal.title}
            </h3>
            <p className="text-board-dim text-sm mb-5">{modal.message}</p>
            <button
              onClick={closeModal}
              className="w-full bg-board-amber text-board-bg font-bold px-4 py-2 rounded hover:opacity-90 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
