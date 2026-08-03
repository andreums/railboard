import { useEffect, useState, useCallback } from "react";
import { api, connectWS, type Device } from "../../lib/api";
import { Radio, Wifi, WifiOff, Play, Settings } from "lucide-react";

const EVENT_TYPE_OPTIONS = [
  "TRAIN_APPROACHING", "TRAIN_ARRIVING", "TRAIN_AT_PLATFORM", "TRAIN_STANDING_BY",
  "TRAIN_BOARDING", "TRAIN_READY_TO_DEPART", "TRAIN_DEPARTING", "TRAIN_DEPARTED",
  "TRAIN_DELAYED", "TRAIN_CANCELLED", "PLATFORM_CHANGE", "TRAIN_ANNOUNCEMENT",
];

export default function AudioNodesPanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [connected, setConnected] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); };

  const refresh = useCallback(async () => {
    try {
      const [list, conn] = await Promise.all([
        api.listDevices().catch(() => []),
        api.getConnectedDevices().catch(() => []),
      ]);
      setDevices(list.filter((d) => d.device_type === "AUDIO_NODE" || d.device_type === "UNKNOWN"));
      setConnected(conn);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    refresh();
    const ws = connectWS(refresh);
    const unsub = ws.on("announcement_ready", () => refresh());
    return () => { ws.close(); unsub(); };
  }, [refresh]);

  const onlineIds = new Set(connected.map((c: any) => c.deviceId));

  const parseCaps = (d: Device) => {
    try { return JSON.parse(d.capabilities || "{}"); } catch { return {}; }
  };

  const openEdit = (d: Device) => {
    const caps = parseCaps(d);
    setEditingId(d.id);
    setEditForm({
      name: d.name,
      stationId: d.station_id || "",
      platforms: (caps.platforms || []).join(", "),
      areas: (caps.areas || ["PLATFORM"]).join(", "),
      volume: caps.volume ?? 0.8,
      eventTypes: caps.eventTypes || EVENT_TYPE_OPTIONS,
      audioOutput: caps.audioOutput || "speaker",
    });
  };

  const handleSave = async () => {
    if (!editingId) return;
    const capabilities = {
      platforms: editForm.platforms.split(",").map((s: string) => s.trim()).filter(Boolean),
      areas: editForm.areas.split(",").map((s: string) => s.trim()).filter(Boolean),
      volume: Number(editForm.volume),
      eventTypes: editForm.eventTypes,
      audioOutput: editForm.audioOutput,
    };
    try {
      await api.updateDevice(editingId, {
        name: editForm.name,
        station_id: editForm.stationId ? Number(editForm.stationId) : null,
        capabilities: JSON.stringify(capabilities),
      });
      notify("Configuración guardada");
      setEditingId(null);
      refresh();
    } catch (err: any) { notify(err.message); }
  };

  const toggleEventType = (et: string) => {
    setEditForm((prev: any) => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(et)
        ? prev.eventTypes.filter((e: string) => e !== et)
        : [...prev.eventTypes, et],
    }));
  };

  const handleTest = async (d: Device) => {
    const caps = parseCaps(d);
    const eventType = (caps.eventTypes && caps.eventTypes[0]) || "TRAIN_ANNOUNCEMENT";
    try {
      const train = { id: 0, number: "TEST", destination: "Prueba", platform: (caps.platforms || ["1"])[0], station_id: d.station_id };
      await api.triggerAnnouncementEvent({ train, eventType, stationId: d.station_id, languages: ["ca", "es", "en"] });
      notify(`Test enviado: ${eventType}`);
    } catch (err: any) { notify(err.message); }
  };

  const audioNodes = devices.filter((d) => d.device_type === "AUDIO_NODE");

  return (
    <div className="space-y-4">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-medium">
          {notification}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Radio className="text-blue-900" size={24} />
          Nodos de audio ({audioNodes.length})
        </h2>
        <button onClick={refresh} className="px-3 py-1 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">Actualizar</button>
      </div>

      {audioNodes.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
          <Radio size={40} className="mx-auto mb-2 text-slate-300" />
          <p>No hay nodos de audio registrados</p>
          <p className="text-xs mt-1">Los nodos ESP32 aparecerán aquí cuando se conecten vía WebSocket con device_type AUDIO_NODE</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {audioNodes.map((d) => {
          const caps = parseCaps(d);
          const isOnline = onlineIds.has(d.id);
          const isEditing = editingId === d.id;

          return (
            <div key={d.id} className={`bg-white rounded-xl border ${isOnline ? "border-emerald-200" : "border-slate-200"} overflow-hidden`}>
              {/* Header */}
              <div className={`px-4 py-3 flex items-center justify-between ${isOnline ? "bg-emerald-50" : "bg-slate-50"}`}>
                <div className="flex items-center gap-2">
                  <Radio size={18} className={isOnline ? "text-emerald-600" : "text-slate-400"} />
                  <div>
                    <div className="font-semibold text-slate-800">{d.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{d.id.slice(0, 8)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    isOnline ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                  }`}>
                    {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {isOnline ? "Online" : "Offline"}
                  </span>
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400"><Settings size={14} /></button>
                </div>
              </div>

              {isEditing ? (
                /* Edit form */
                <div className="p-4 space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Nombre</label>
                      <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Station ID</label>
                      <input value={editForm.stationId} onChange={(e) => setEditForm({ ...editForm, stationId: e.target.value })}
                        type="number" className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Andenes (coma)</label>
                      <input value={editForm.platforms} onChange={(e) => setEditForm({ ...editForm, platforms: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Áreas (coma)</label>
                      <input value={editForm.areas} onChange={(e) => setEditForm({ ...editForm, areas: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Volumen</label>
                      <input value={editForm.volume} onChange={(e) => setEditForm({ ...editForm, volume: e.target.value })}
                        type="number" min="0" max="1" step="0.1" className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase">Salida audio</label>
                      <select value={editForm.audioOutput} onChange={(e) => setEditForm({ ...editForm, audioOutput: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-sm">
                        <option value="speaker">Altavoz</option>
                        <option value="lineout">Line Out</option>
                        <option value="i2s">I2S DAC</option>
                        <option value="bluetooth">Bluetooth</option>
                      </select>
                    </div>
                  </div>
                  {/* Event types */}
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase">Tipos de evento</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {EVENT_TYPE_OPTIONS.map((et) => (
                        <button key={et} onClick={() => toggleEventType(et)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            editForm.eventTypes.includes(et) ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                          }`}>
                          {et}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSave} className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-semibold hover:bg-blue-800">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs hover:bg-slate-300">Cancelar</button>
                  </div>
                </div>
              ) : (
                /* Info display */
                <div className="p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span><strong>Andenes:</strong> {(caps.platforms || []).join(", ") || "—"}</span>
                    <span><strong>Áreas:</strong> {(caps.areas || []).join(", ") || "—"}</span>
                    <span><strong>Vol:</strong> {caps.volume != null ? Math.round(caps.volume * 100) + "%" : "—"}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-400">
                    <span>Eventos: </span>
                    {(caps.eventTypes || []).slice(0, 4).map((et: string) => (
                      <span key={et} className="px-1.5 py-0.5 bg-slate-100 rounded">{et}</span>
                    ))}
                    {(caps.eventTypes || []).length > 4 && (
                      <span className="text-slate-300">+{caps.eventTypes.length - 4}</span>
                    )}
                  </div>
                  <button onClick={() => handleTest(d)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200">
                    <Play size={12} /> Probar audio
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
