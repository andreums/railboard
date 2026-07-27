import { useEffect, useState, useCallback } from "react";
import { api, connectWS, fileUrl, type Train } from "../lib/api";
import { useNavigate } from "react-router-dom";
import { handleImgError } from "../lib/svgPlaceholder";

const STATE_BUTTONS = [
  { state: "SCHEDULED", label: "Programado", icon: "📋", color: "bg-slate-100 text-slate-700 hover:bg-slate-200", eventType: "TRAIN_ANNOUNCEMENT" },
  { state: "APPROACHING", label: "Aproximándose", icon: "🔜", color: "bg-yellow-100 text-yellow-700 hover:bg-yellow-200", eventType: "TRAIN_APPROACHING" },
  { state: "ARRIVING", label: "Entrando", icon: "🚉", color: "bg-orange-100 text-orange-700 hover:bg-orange-200", eventType: "TRAIN_ARRIVING" },
  { state: "STOPPED", label: "Estacionado", icon: "🛑", color: "bg-blue-100 text-blue-700 hover:bg-blue-200", eventType: "TRAIN_AT_PLATFORM" },
  { state: "BOARDING", label: "Embarque", icon: "🚶", color: "bg-green-100 text-green-700 hover:bg-green-200", eventType: "TRAIN_BOARDING" },
  { state: "READY_TO_DEPART", label: "Listo salir", icon: "✅", color: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200", eventType: "TRAIN_READY_TO_DEPART" },
  { state: "DEPARTING", label: "Saliendo", icon: "🚀", color: "bg-purple-100 text-purple-700 hover:bg-purple-200", eventType: "TRAIN_DEPARTING" },
  { state: "DEPARTED", label: "Salido", icon: "🏁", color: "bg-slate-200 text-slate-500 hover:bg-slate-300", eventType: "TRAIN_DEPARTED" },
  { state: "CANCELLED", label: "Cancelado", icon: "❌", color: "bg-red-100 text-red-700 hover:bg-red-200", eventType: "TRAIN_CANCELLED" },
];

const QUICK_DELAYS = [5, 10, 15, 30];

const STATUS_MAP: Record<string, string> = {
  SCHEDULED: "Scheduled",
  APPROACHING: "Scheduled",
  ARRIVING: "Scheduled",
  STOPPED: "Scheduled",
  BOARDING: "Boarding",
  READY_TO_DEPART: "Scheduled",
  DEPARTING: "Scheduled",
  DEPARTED: "Departed",
  DELAYED: "Delayed",
  CANCELLED: "Cancelled",
};

export default function Operator() {
  const navigate = useNavigate();
  const [trains, setTrains] = useState<Train[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [notification, setNotification] = useState<string | null>(null);
  const [delayReason, setDelayReason] = useState("");

  const notify = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 2000); };

  const refresh = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([
        api.listTrains().catch(() => []),
        api.getTrainEvents().catch(() => []),
      ]);
      setTrains(t);
      setEvents(e);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { refresh(); const ws = connectWS(refresh); return () => ws.close(); }, [refresh]);

  const selectedTrain = trains.find((t) => t.id === selectedId);

  const handleStateChange = async (state: string) => {
    if (!selectedId) return;
    try {
      const result = await api.changeTrainState(selectedId, state);
      if (result.error) { notify(result.error); return; }
      notify(`→ ${state}`);
      refresh();
    } catch (err: any) { notify(err.message); }
  };

  const handleDelay = async (minutes: number) => {
    if (!selectedId) return;
    try {
      const result = await api.addTrainDelay(selectedId, minutes, delayReason || undefined);
      notify(`+${minutes} min`);
      refresh();
    } catch (err: any) { notify(err.message); }
  };

  const handlePlatform = async (platform: string, sector?: string) => {
    if (!selectedId) return;
    try {
      const result = await api.changeTrainPlatform(selectedId, platform, sector);
      notify(`Vía ${platform}`);
      refresh();
    } catch (err: any) { notify(err.message); }
  };

  const handleAnnouncement = async (eventType?: string) => {
    if (!selectedId || !selectedTrain) return;
    try {
      const et = eventType || "TRAIN_ANNOUNCEMENT";
      const result = await api.triggerAnnouncementEvent({
        train: selectedTrain,
        eventType: et,
        stationId: selectedTrain.station_id,
        languages: ["ca", "es", "en"],
      });
      notify(`Anuncio encolado: ${et}`);
    } catch (err: any) { notify(err.message); }
  };

  const [announcementPreview, setAnnouncementPreview] = useState<any>(null);

  const handlePreview = async (eventType: string) => {
    if (!selectedTrain) return;
    try {
      const preview = await api.testAnnouncement({
        train: selectedTrain,
        eventType,
        languages: ["ca", "es", "en"],
      });
      setAnnouncementPreview(preview);
    } catch (err: any) { notify(err.message); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-lg text-sm font-medium">
          {notification}
        </div>
      )}

      <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚂</span>
          <h1 className="font-bold text-lg">Dispatcher RailBoard</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">↻</button>
          <button onClick={() => navigate("/admin")} className="px-3 py-1.5 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">Admin</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-4 h-[calc(100vh-52px)]">
        {/* Train list */}
        <div className="lg:col-span-1 overflow-y-auto border-r border-slate-700">
          <div className="p-3 text-sm text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-700">
            Trenes ({trains.length})
          </div>
          {trains.map((t) => (
            <button key={t.id} onClick={() => setSelectedId(t.id)}
              className={`w-full text-left p-3 border-b border-slate-800 hover:bg-slate-800 transition ${selectedId === t.id ? "bg-slate-700" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{t.number} {t.destination}</div>
                  <div className="text-xs text-slate-400">{t.type_name || ""} · {t.platform ? `V${t.platform}` : ""}</div>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  t.status === "Cancelled" ? "bg-red-900 text-red-200" :
                  t.status === "Delayed" ? "bg-orange-900 text-orange-200" :
                  t.status === "Boarding" ? "bg-green-900 text-green-200" :
                  t.status === "Departed" ? "bg-slate-600 text-slate-300" :
                  "bg-blue-900 text-blue-200"
                }`}>{t.status}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{t.scheduled_time} · {t.operator_name || ""}</div>
            </button>
          ))}
        </div>

        {/* Control panel */}
        <div className="lg:col-span-2 overflow-y-auto p-4">
          {selectedTrain ? (
            <div className="space-y-5 max-w-2xl">
              {/* Train header */}
              <div className="bg-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  {selectedTrain.type_logo && (
                    <img src={fileUrl(selectedTrain.type_logo) || ""} alt="" className="h-6 opacity-70" onError={(e) => handleImgError(e, selectedTrain.type_name || "train")} />
                  )}
                  <div>
                    <div className="text-xl font-bold">{selectedTrain.number}</div>
                    <div className="text-sm text-slate-400">{selectedTrain.type_name} · {selectedTrain.operator_name}</div>
                  </div>
                </div>
                <div className="text-2xl font-bold text-yellow-300">{selectedTrain.destination}</div>
                <div className="flex gap-4 mt-2 text-sm text-slate-400">
                  <span>Vía {selectedTrain.platform}{selectedTrain.sector ? ` · ${selectedTrain.sector}` : ""}</span>
                  <span>{selectedTrain.scheduled_time}{selectedTrain.expected_time !== selectedTrain.scheduled_time ? ` → ${selectedTrain.expected_time}` : ""}</span>
                  <span className={`font-medium ${selectedTrain.status === "Delayed" ? "text-orange-400" : selectedTrain.status === "Cancelled" ? "text-red-400" : ""}`}>
                    {selectedTrain.status}
                  </span>
                </div>
              </div>

              {/* State buttons */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">
                  <span>Cambiar estado</span>
                  <span className="text-[10px] font-mono text-slate-500">click = aplicar · hover preview = vista</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATE_BUTTONS.map((btn) => (
                    <div key={btn.state} className="relative group">
                      <button onClick={() => handleStateChange(btn.state)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${btn.color}`}>
                        {btn.icon} {btn.label}
                      </button>
                      <button onMouseEnter={() => handlePreview(btn.eventType)}
                        className="ml-0.5 px-1 py-2 rounded-lg text-xs bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition opacity-0 group-hover:opacity-100"
                        title="Previsualizar anuncio">
                        👁
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick delays */}
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Retraso rápido</div>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_DELAYS.map((m) => (
                    <button key={m} onClick={() => handleDelay(m)}
                      className="px-4 py-2 bg-orange-900/50 text-orange-200 rounded-lg text-sm font-medium hover:bg-orange-800/50">
                      +{m} min
                    </button>
                  ))}
                  <button onClick={() => handleDelay(0)}
                    className="px-4 py-2 bg-green-900/50 text-green-200 rounded-lg text-sm font-medium hover:bg-green-800/50">
                    Quitar retraso
                  </button>
                </div>
                <input value={delayReason} onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="Motivo del retraso (opcional)"
                  className="mt-2 w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500" />
              </div>

              {/* Platform quick change */}
              <div>
                <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Cambio de vía</div>
                <div className="flex flex-wrap gap-1.5">
                  {["1", "2", "3", "4", "5", "6", "7", "8"].map((p) => (
                    <button key={p} onClick={() => handlePlatform(p)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        selectedTrain.platform === p ? "bg-blue-700 text-white" : "bg-blue-900/50 text-blue-200 hover:bg-blue-800/50"
                      }`}>
                      V{p}
                    </button>
                  ))}
                </div>
              </div>

              {/* State announcement info */}
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Anuncios automáticos</div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900 text-green-300">Activo</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {STATE_BUTTONS.map((btn) => {
                    const isCurrent = selectedTrain?.status === btn.state;
                    return (
                      <button key={btn.eventType} onClick={() => { handleAnnouncement(btn.eventType); }}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] transition ${
                          isCurrent ? "bg-purple-700 text-white" : "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
                        }`}>
                        <span className="uppercase font-semibold">{btn.label}</span>
                        <span className="opacity-60">({btn.eventType})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Announcement preview */}
              {announcementPreview && (
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-slate-400 font-semibold uppercase">Previsualización</div>
                    <button onClick={() => setAnnouncementPreview(null)} className="text-xs text-slate-500 hover:text-white">✕</button>
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    {(["ca", "es", "en"] as const).map((lang) =>
                      announcementPreview.composed?.[lang] ? (
                        <div key={lang} className="flex gap-2">
                          <span className="font-mono text-slate-500 w-6">{lang}</span>
                          <span>{announcementPreview.composed[lang]}</span>
                        </div>
                      ) : null
                    )}
                    {announcementPreview.chime?.assetPath && (
                      <div className="text-slate-500 mt-1">Chime: {announcementPreview.chime.assetName || announcementPreview.chime.assetPath}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-lg">
              Selecciona un tren de la lista
            </div>
          )}

          {/* Event log */}
          {events.length > 0 && (
            <div className="mt-6 border-t border-slate-700 pt-4">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Últimos eventos</div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {events.slice(0, 20).map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between py-1 px-2 bg-slate-800/50 rounded text-xs">
                    <span className="font-medium text-slate-300">{e.event_type}</span>
                    <span className="text-slate-500">{e.from_state || ""} → {e.to_state || ""}</span>
                    <span className="text-slate-500">{new Date(e.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
