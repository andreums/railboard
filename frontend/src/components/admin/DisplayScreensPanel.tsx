import { useEffect, useState, useCallback, useRef } from "react";
import { api, type DisplayScreen, type Station } from "../../lib/api";
import { Monitor, Plus, Trash2, QrCode, Copy, ExternalLink, Settings, Eye, EyeOff } from "lucide-react";

const SCREEN_TYPES = ["DEPARTURES", "ARRIVALS", "PLATFORM", "TRAIN_INFO", "CLOCK", "DISRUPTIONS", "CUSTOM"] as const;

const LABELS: Record<string, string> = {
  DEPARTURES: "Salidas",
  ARRIVALS: "Llegadas",
  PLATFORM: "Andén",
  TRAIN_INFO: "Info tren",
  CLOCK: "Reloj",
  DISRUPTIONS: "Incidències",
  CUSTOM: "Personalizado",
  LANDSCAPE: "Apaisado",
  PORTRAIT: "Vertical",
};

export default function DisplayScreensPanel({ stations }: { stations: Station[] }) {
  const [screens, setScreens] = useState<DisplayScreen[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Partial<DisplayScreen> | null>(null);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listDisplayScreens();
      setScreens(list);
    } catch (err: any) {
      notify("error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getURL = (id: string) => `${window.location.protocol}//${window.location.host}/s/${id}`;

  const handleCopyURL = (id: string) => {
    navigator.clipboard.writeText(getURL(id)).then(() => notify("success", "URL copiada")).catch(() => notify("error", "No se pudo copiar"));
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      if (editing.id) {
        await api.updateDisplayScreen(editing.id, editing);
      } else {
        await api.createDisplayScreen(editing);
      }
      notify("success", editing.id ? "Pantalla actualizada" : "Pantalla creada");
      setEditing(null);
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta pantalla?")) return;
    try {
      await api.deleteDisplayScreen(id);
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  return (
    <div>
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium ${
          notification.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {notification.message}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Monitor className="text-blue-900" size={24} />
          Pantallas
        </h2>
        <div className="flex gap-2 items-center">
          <button onClick={refresh} className="px-3 py-1 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
            {loading ? "..." : "Actualizar"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl">
          <h3 className="font-semibold text-slate-800 mb-4">
            {editing.id ? "Editar pantalla" : "Nueva pantalla"}
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                <input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Pantalla vía 3" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select value={editing.display_type || "DEPARTURES"} onChange={(e) => setEditing({ ...editing, display_type: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {SCREEN_TYPES.map((t) => <option key={t} value={t}>{LABELS[t]}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Estación</label>
                <select value={editing.station_id || ""} onChange={(e) => setEditing({ ...editing, station_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin estación</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Orientación</label>
                <select value={editing.orientation || "LANDSCAPE"} onChange={(e) => setEditing({ ...editing, orientation: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="LANDSCAPE">{LABELS.LANDSCAPE}</option>
                  <option value="PORTRAIT">{LABELS.PORTRAIT}</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Vía</label>
                <input value={editing.platform || ""} onChange={(e) => setEditing({ ...editing, platform: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Sector</label>
                <input value={editing.sector || ""} onChange={(e) => setEditing({ ...editing, sector: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Idioma</label>
                <select value={editing.language || "ca"} onChange={(e) => setEditing({ ...editing, language: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="ca">Català</option>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="va">Valencià</option>
                  <option value="eu">Euskera</option>
                  <option value="gl">Galego</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Filas máximas</label>
                <input type="number" value={editing.max_rows ?? 10} onChange={(e) => setEditing({ ...editing, max_rows: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Escala fuente</label>
                <input type="number" step="0.1" value={editing.font_scale ?? 1.0} onChange={(e) => setEditing({ ...editing, font_scale: Number(e.target.value) })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!editing.audio_enabled}
                  onChange={(e) => setEditing({ ...editing, audio_enabled: e.target.checked ? 1 : 0 })}
                  className="rounded border-slate-300 accent-blue-900" />
                Audio activado
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.enabled !== 0}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked ? 1 : 0 })}
                  className="rounded border-slate-300 accent-blue-900" />
                Activo
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSave}
                className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">Guardar</button>
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setEditing({ name: "", display_type: "DEPARTURES", orientation: "LANDSCAPE", language: "ca", max_rows: 10, font_scale: 1.0, enabled: 1 })}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
            <Plus size={15} /> Nueva pantalla
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {screens.map((screen) => (
              <div key={screen.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition">
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="rounded-lg bg-blue-50 p-2 text-blue-600 shrink-0">
                        <Monitor size={16} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-800">{screen.name}</h3>
                        <p className="text-xs text-slate-400">{screen.station_name || "Sin estación"}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs ${screen.enabled ? "text-green-600" : "text-slate-400"}`}>
                      {screen.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
                      {screen.enabled ? "Activo" : "Inactivo"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      {LABELS[screen.display_type] || screen.display_type}
                    </span>
                    {screen.platform && (
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                        Vía {screen.platform}{screen.sector ? ` · ${screen.sector}` : ""}
                      </span>
                    )}
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      {LABELS[screen.orientation] || screen.orientation}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono mb-2">
                    /s/{screen.id}
                  </div>

                  <div className="flex gap-1">
                    <button onClick={() => window.open(getURL(screen.id), "_blank")}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs hover:bg-emerald-100" title="Abrir">
                      <ExternalLink size={12} /> Abrir
                    </button>
                    <button onClick={() => handleCopyURL(screen.id)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Copiar URL">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => setShowQR(showQR === screen.id ? null : screen.id)}
                      className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600" title="QR">
                      <QrCode size={14} />
                    </button>
                    <button onClick={() => setEditing(screen)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Editar">
                      <Settings size={14} />
                    </button>
                    <button onClick={() => handleDelete(screen.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {showQR === screen.id && (
                    <div ref={qrRef} className="mt-3 p-3 bg-white rounded-lg border border-slate-200 text-center">
                      <div className="text-xs text-slate-500 mb-2">Escanea para abrir en tu dispositivo:</div>
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getURL(screen.id))}`}
                        alt="QR" className="mx-auto rounded" style={{ width: 150, height: 150 }} />
                      <div className="text-xs text-slate-400 mt-1 font-mono break-all">{getURL(screen.id)}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {screens.length === 0 && !loading && (
              <div className="col-span-full text-center py-10 text-slate-400">Sin pantallas configuradas. Crea tu primera pantalla.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
