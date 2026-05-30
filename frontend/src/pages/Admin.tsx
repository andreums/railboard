import { useEffect, useState, useRef } from "react";
import { api, connectWS, fileUrl, type Config, type Place, type Train, type Route, type Operator, type TrainType } from "../lib/api";
import { fetchNetworks, fetchStations, reloadRailwayRoutes, type RailwayReloadStats } from "../services/routeApi";
import GenerationPanel from "../components/admin/GenerationPanel";
import ServicesPanel from "../components/admin/ServicesPanel";
import RoutesPanel from "../components/admin/RoutesPanel";
import { LANGUAGES, type Language } from "../lib/i18n";
import { speak, loadVoiceSettings, getVoices, defaultTemplate, type AnnouncePreset, type VoiceSettings } from "../lib/tts";

type TabType = "station" | "trains" | "routes" | "operators" | "types" | "styles" | "places" | "services" | "locutions" | "voice";
type NotificationType = "success" | "error" | "info";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

const TEST_TEXTS: Record<string, string> = {
  es: "Prueba de voz del sistema de megafonía. Velocidad, tono y volumen configurados correctamente.",
  ca: "Prova de veu del sistema de megafonia. Velocitat, to i volum configurats correctament.",
  en: "Voice test of the public address system. Speed, pitch and volume configured correctly.",
  fr: "Test vocal du système de sonorisation. Vitesse, ton et volume configurés correctement.",
  eu: "Megafonia sistemaren ahots proba. Abiadura, tonua eta bolumena behar bezala konfiguratuta.",
  gl: "Proba de voz do sistema de megafonía. Velocidade, ton e volume configurados correctamente.",
};

export default function Admin() {
  const [config, setConfig] = useState<Config | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [routeRegionFilter, setRouteRegionFilter] = useState("all");
  const [routeServiceFilter, setRouteServiceFilter] = useState("all");
  const [routeOperatorFilter, setRouteOperatorFilter] = useState("all");
  const [routeReloading, setRouteReloading] = useState(false);
  const [routeDatasetStats, setRouteDatasetStats] = useState<RailwayReloadStats | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [modal, setModal] = useState<Notification | null>(null);
  const [editingTrain, setEditingTrain] = useState<Train | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Train>>({});
  const [editingOperator, setEditingOperator] = useState<Operator | null>(null);
  const [editingType, setEditingType] = useState<TrainType | null>(null);
  const [operatorLogo, setOperatorLogo] = useState<File | null>(null);
  const [typeLogo, setTypeLogo] = useState<File | null>(null);
  const [departureTmpl, setDepartureTmpl] = useState("");
  const [arrivalTmpl, setArrivalTmpl] = useState("");
  const [presets, setPresets] = useState<AnnouncePreset[]>([]);
  const [newPreset, setNewPreset] = useState({ label: "", text: "" });
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({ rate: 0.95, pitch: 1, volume: 1, voiceURI: "" });
  const [activeTab, setActiveTab] = useState<TabType>("station");
  const [newPlace, setNewPlace] = useState("");
  const [autoGen, setAutoGen] = useState(false);
  const [autoInterval, setAutoInterval] = useState(5);
  const autoRef = useRef<number | null>(null);

  const showNotification = (type: NotificationType, title: string, message: string) => {
    const id = Math.random().toString(36);
    setModal({ id, type, title, message });
    setTimeout(() => setModal(null), 3000);
  };

  const refresh = async () => {
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      const [c, pl, ro, tr, op, tt, networkList, stationList] = await Promise.all([
        api.getConfig(),
        api.listPlaces(),
        api.listRoutes(),
        api.listTrains(),
        api.listOperators(),
        api.listTrainTypes(),
        fetchNetworks(),
        fetchStations(),
      ]);
      setConfig(c);
      setPlaces(pl);
      setRoutes(ro);
      setTrains(tr);
      setOperators(op);
      setTrainTypes(tt);
      setRouteDatasetStats((prev) => ({
        success: true,
        routes: ro.length,
        stations: stationList.length,
        networks: networkList.length,
        reloadedAt: prev?.reloadedAt || new Date().toISOString(),
      }));
      setDepartureTmpl(c.announce_departure || defaultTemplate("departures"));
      setArrivalTmpl(c.announce_arrival || defaultTemplate("arrivals"));
      setPresets(JSON.parse(c.announce_presets || "[]"));
    } catch (error: any) {
      setRoutesError(error?.message || "No se pudieron cargar las rutas");
    } finally {
      setRoutesLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const loadVoices = () => setVoices(getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    const ws = connectWS(refresh);
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      if (ws && typeof ws.close === "function") ws.close();
    };
  }, []);

  useEffect(() => {
    if (config) setVoiceSettings(loadVoiceSettings(config));
  }, [config]);

  useEffect(() => {
    if (autoGen) {
      autoRef.current = window.setInterval(async () => {
        try {
          await api.generateRandomTrain();
          await refresh();
        } catch (e) { }
      }, Math.max(1000, autoInterval * 1000));
    } else {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    }
    return () => {
      if (autoRef.current) {
        clearInterval(autoRef.current);
        autoRef.current = null;
      }
    };
  }, [autoGen, autoInterval]);

  const handleSaveConfig = async () => {
    try {
      await api.setConfig(config!);
      showNotification("success", "✓ Guardado", "Configuración de estación actualizada");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo guardar");
    }
  };

  const handleSaveStyles = async () => {
    try {
      await api.setConfig(config!);
      showNotification("success", "✓ Guardado", "Estilos actualizados");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudieron guardar");
    }
  };

  const handleDeletePlace = async (id: number) => {
    try {
      await api.deletePlace(id);
      await refresh();
      showNotification("success", "✓ Eliminado", "Destino eliminado");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo eliminar");
    }
  };

  const handleAddPlace = async () => {
    if (!newPlace.trim()) {
      showNotification("error", "⚠ Vacío", "Ingresa un nombre");
      return;
    }
    try {
      await api.createPlace(newPlace);
      setNewPlace("");
      await refresh();
      showNotification("success", "✓ Agregado", `${newPlace} añadido`);
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo agregar");
    }
  };

  const handleGenerateRandomTrain = async () => {
    try {
      await api.generateRandomTrain();
      await refresh();
      showNotification("success", "✓ Tren generado", "Nuevo tren agregado al panel");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo generar");
    }
  };

  const handleClearTrains = async () => {
    if (!confirm("⚠️ ¿Eliminar TODOS los trenes? Esta acción no se puede deshacer.")) return;
    try {
      await api.clearTrains();
      await refresh();
      showNotification("success", "✓ Panel limpiado", "Todos los trenes han sido eliminados");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudieron eliminar");
    }
  };

  const handleGenerateBoard = async () => {
    try {
      await api.clearTrains();
      for (let i = 0; i < 8; i++) {
        await api.generateRandomTrain();
      }
      await refresh();
      showNotification("success", "✓ Panel generado", "8 trenes con horarios escalonados");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo generar el panel");
    }
  };

  const handleEditTrain = (train: Train) => {
    setEditingTrain(train);
    setEditFormData({ ...train });
  };

  const handleSaveEditedTrain = async () => {
    if (!editingTrain) return;
    try {
      await api.updateTrain(editingTrain.id, editFormData);
      await refresh();
      setEditingTrain(null);
      showNotification("success", "✓ Tren actualizado", "Los cambios se han guardado");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo actualizar el tren");
    }
  };

  const handleDeleteTrain = async (trainId: number) => {
    if (!confirm("⚠️ ¿Eliminar este tren?")) return;
    try {
      await api.deleteTrain(trainId);
      await refresh();
      showNotification("success", "✓ Tren eliminado", "El tren ha sido removido del panel");
    } catch (err: any) {
      showNotification("error", "✗ Error", err.message || "No se pudo eliminar el tren");
    }
  };

  const testSpeak = (text: string) => speak(text, voiceSettings, config?.language);

  const handleReloadRailRoutes = async () => {
    const confirmed = confirm("¿Quieres recargar el dataset ferroviario? Esto actualizará rutas, estaciones y redes disponibles.");
    if (!confirmed) return;
    try {
      setRouteReloading(true);
      const stats = await reloadRailwayRoutes();
      setRouteDatasetStats(stats);
      await refresh();
      showNotification("success", "✓ Dataset recargado", `Rutas: ${stats.routes} · Estaciones: ${stats.stations} · Redes: ${stats.networks}`);
    } catch (error: any) {
      showNotification("error", "✗ Error", error?.message || "No se pudo recargar el dataset ferroviario");
    } finally {
      setRouteReloading(false);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-300">Cargando panel...</p>
        </div>
      </div>
    );
  }

  const lang = (config.language as string) || "es";
  const testText = TEST_TEXTS[lang] || TEST_TEXTS.es;

  const normalizeRouteText = (value: string) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const getRouteRegion = (route: Route) => {
    const haystack = normalizeRouteText(`${route.network} ${route.name}`);
    if (haystack.includes("valencia") || haystack.includes("valencia")) return "Comunitat Valenciana";
    if (haystack.includes("catalunya") || haystack.includes("cataluna")) return "Catalunya";
    if (haystack.includes("madrid")) return "Comunidad de Madrid";
    if (haystack.includes("murcia") || haystack.includes("alicante")) return "Región de Murcia / Alicante";
    if (haystack.includes("sevilla")) return "Andalucía (Sevilla)";
    if (haystack.includes("san sebastian")) return "País Vasco (San Sebastián)";
    if (haystack.includes("zaragoza")) return "Aragón";
    if (haystack.includes("cantabria")) return "Cantabria";
    if (haystack.includes("asturias")) return "Asturias";
    if (haystack.includes("bilbao")) return "País Vasco (Bilbao)";
    if (haystack.includes("galicia") || haystack.includes("ferrol")) return "Galicia";
    return route.network;
  };

  const getRouteService = (route: Route) => {
    const haystack = normalizeRouteText(`${route.network} ${route.name}`);
    if (haystack.includes("custom")) return "Custom";
    if (haystack.includes("larga distancia")) return "Larga Distancia";
    if (haystack.includes("media distancia")) return "Media Distancia";
    if (haystack.includes("cercanias") || haystack.includes("rodalies")) return "Cercanías / Rodalies";
    return "Otros";
  };

  const routeRegions = Array.from(new Set(routes.map(getRouteRegion))).sort((a, b) => a.localeCompare(b, "es"));
  const routeServices = Array.from(new Set(routes.map(getRouteService))).sort((a, b) => a.localeCompare(b, "es"));
  const routeOperators = Array.from(new Set(routes.map((route) => route.operator))).sort((a, b) => a.localeCompare(b, "es"));
  const filteredRoutes = routes.filter((route) => {
    const regionOk = routeRegionFilter === "all" || getRouteRegion(route) === routeRegionFilter;
    const serviceOk = routeServiceFilter === "all" || getRouteService(route) === routeServiceFilter;
    const operatorOk = routeOperatorFilter === "all" || route.operator === routeOperatorFilter;
    return regionOk && serviceOk && operatorOk;
  });

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: "station", label: "Estación", icon: "🏢" },
    { id: "trains", label: "Trenes", icon: "🚂" },
    { id: "services", label: "Servicios", icon: "📋" },
    { id: "routes", label: "Rutas", icon: "🛤️" },
    { id: "operators", label: "Operadores", icon: "🏢" },
    { id: "types", label: "Tipos de Tren", icon: "🏷️" },
    { id: "styles", label: "Estilos", icon: "🎨" },
    { id: "places", label: "Destinos", icon: "📍" },
    { id: "locutions", label: "Locuciones", icon: "🔊" },
    { id: "voice", label: "Voz", icon: "🎤" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center font-bold text-black">
              RB
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">RailBoard Admin</h1>
              <p className="text-xs text-slate-400">📍 {config.station_name || "No configurada"}</p>
            </div>
          </div>
          <a href="/" className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/10 transition border border-white/10">
            ← Volver a Display
          </a>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 border-b border-white/10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 rounded-t-lg font-medium transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id
                ? "bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-lg"
                : "text-slate-400 hover:text-slate-300 border-b-2 border-transparent hover:border-slate-600"
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="space-y-6">
          {/* Station Tab */}
          {activeTab === "station" && (
            <div className="animate-fadeIn space-y-6">
              {/* Logo & Name */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <span>🏷️</span> Información
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Nombre de Estación
                    </label>
                    <input
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                      value={config.station_name}
                      onChange={(e) => setConfig({ ...config, station_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Modo
                    </label>
                    <select
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                      value={config.mode}
                      onChange={(e) => setConfig({ ...config, mode: e.target.value as Config["mode"] })}
                    >
                      <option value="departures">Salidas</option>
                      <option value="arrivals">Llegadas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Language & Clock */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>⚙️</span> Configuración
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Idioma
                    </label>
                    <select
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                      value={(config.language as Language) ?? "es"}
                      onChange={(e) => setConfig({ ...config, language: e.target.value as Language })}
                    >
                      {Object.entries(LANGUAGES).map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Tipo de Reloj
                    </label>
                    <select
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                      value={config.clockMode || "real"}
                      onChange={(e) => setConfig({ ...config, clockMode: e.target.value as Config["clockMode"] })}
                    >
                      <option value="real">Sistema</option>
                      <option value="fake">Ficticio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Hora (si ficticio)
                    </label>
                    <input
                      type="time"
                      step="1"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                      value={config.clockFakeTime || "12:00:00"}
                      onChange={(e) => setConfig({ ...config, clockFakeTime: e.target.value })}
                      disabled={(config.clockMode || "real") !== "fake"}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                    Pie de Pantalla
                  </label>
                  <input
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                    placeholder="Texto que aparece en el pie de pantalla"
                    value={config.footerText || ""}
                    onChange={(e) => setConfig({ ...config, footerText: e.target.value })}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSaveConfig}
                  className="px-6 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-semibold rounded-lg hover:shadow-lg transition"
                >
                  💾 Guardar Estación
                </button>
              </div>

              {/* Generation Panel */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <GenerationPanel
                  onRefresh={refresh}
                  autoGen={autoGen}
                  setAutoGen={setAutoGen}
                  autoInterval={autoInterval}
                  setAutoInterval={setAutoInterval}
                />
              </div>
            </div>
          )}

          {/* Services Tab */}
          {activeTab === "services" && (
            <div className="animate-fadeIn">
              <ServicesPanel />
            </div>
          )}

          {/* Trains Tab */}
          {activeTab === "trains" && (
            <div className="animate-fadeIn space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>🚂</span> Gestión de Trenes
                </h2>

                <div className="space-y-4">
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-amber-400 mb-3">⚡ Acciones Rápidas</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleGenerateRandomTrain}
                        className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <span>➕</span> Generar 1 Tren
                      </button>
                      <button
                        onClick={handleGenerateBoard}
                        className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <span>📋</span> Panel Completo (8)
                      </button>
                      <button
                        onClick={handleClearTrains}
                        className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 sm:col-span-2"
                      >
                        <span>🗑️</span> Limpiar Todo
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">🔄 Generación Automática</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={autoGen}
                            onChange={(e) => setAutoGen(e.target.checked)}
                            className="w-4 h-4 rounded accent-amber-400"
                          />
                          <span className="text-white font-medium">Activar generación automática</span>
                        </label>
                      </div>
                      {autoGen && (
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Intervalo (segundos)</label>
                            <span className="text-amber-400 font-semibold">{autoInterval}s</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="30"
                            step="1"
                            className="w-full accent-amber-400"
                            value={autoInterval}
                            onChange={(e) => setAutoInterval(parseInt(e.target.value))}
                          />
                          <p className="text-xs text-slate-400 mt-2">Se generará un nuevo tren cada {autoInterval} segundo{autoInterval !== 1 ? 's' : ''}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">📊 Información</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-black/40 rounded-lg p-3">
                        <div className="text-slate-400 text-xs uppercase tracking-wide">Estado</div>
                        <div className="text-white font-bold mt-1">
                          {autoGen ? <span className="text-green-400">🟢 Automático ON</span> : <span className="text-slate-400">⚪ Manual</span>}
                        </div>
                      </div>
                      <div className="bg-black/40 rounded-lg p-3">
                        <div className="text-slate-400 text-xs uppercase tracking-wide">Ver Panel</div>
                        <a href="/" target="_blank" rel="noreferrer" className="text-amber-400 font-bold hover:text-amber-300 transition mt-1 block">
                          📺 Ir a Display →
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Trains List */}
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">📋 Trenes en Pantalla ({trains.length})</h3>
                    {trains.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-slate-400">No hay trenes. Genera uno para empezar.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-white/10">
                            <tr className="text-slate-400 text-xs uppercase tracking-wide">
                              <th className="text-left py-2 px-3">Número</th>
                              <th className="text-left py-2 px-3">Tipo</th>
                              <th className="text-left py-2 px-3">Operador</th>
                              <th className="text-left py-2 px-3">Destino</th>
                              <th className="text-left py-2 px-3">Hora</th>
                              <th className="text-left py-2 px-3">Andén</th>
                              <th className="text-left py-2 px-3">Estado</th>
                              <th className="text-left py-2 px-3">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {trains.map((train, idx) => (
                              <tr key={train.id || idx} className="hover:bg-white/5 transition">
                                <td className="py-2 px-3 font-mono text-amber-400">{train.number}</td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center gap-2">
                                    {train.type_color && (
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: train.type_color }}></div>
                                    )}
                                    <span className="text-white">{train.type_code || "—"}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-slate-300">{train.operator_name || "—"}</td>
                                <td className="py-2 px-3 text-white truncate max-w-xs">{train.destination}</td>
                                <td className="py-2 px-3 font-mono text-slate-300">{train.scheduled_time}</td>
                                <td className="py-2 px-3">
                                  <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-xs font-semibold">{train.platform}</span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${train.status === "Departed" ? "bg-green-900/50 text-green-200" :
                                    train.status === "Boarding" ? "bg-amber-900/50 text-amber-200" :
                                      train.status === "Delayed" ? "bg-red-900/50 text-red-200" :
                                        train.status === "Cancelled" ? "bg-gray-900/50 text-gray-200" :
                                          "bg-slate-900/50 text-slate-200"
                                    }`}>
                                    {train.status}
                                  </span>
                                </td>                                <td className="py-2 px-3 flex gap-2">
                                  <button
                                    onClick={() => handleEditTrain(train)}
                                    className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded transition"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTrain(train.id)}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded transition"
                                  >
                                    🗑️ Del
                                  </button>
                                </td>                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Routes Tab */}
          {activeTab === "routes" && (
            <div className="animate-fadeIn">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>🛤️</span> Generar Trenes desde Rutas
                </h2>
                <p className="text-slate-400 mb-6">Selecciona una ruta para generar un tren con sus líneas, operador y estaciones.</p>
                <RoutesPanel />
              </div>
            </div>
          )}

          {/* Operators Tab */}
          {activeTab === "operators" && (
            <div className="animate-fadeIn space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>🏢</span> Gestión de Operadores ({operators.length})
                </h2>

                {operators.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No hay operadores definidos.</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {operators.map((op) => (
                      <div key={op.id} className="bg-black/20 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {op.logo_url && (
                            <img src={fileUrl(op.logo_url)!} alt={op.name} className="w-8 h-8 object-contain" />
                          )}
                          <span className="text-white font-semibold">{op.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingOperator(op)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded transition"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Eliminar operador "${op.name}"?`)) {
                                await api.deleteOperator(op.id);
                                await refresh();
                                showNotification("success", "✓ Operador eliminado", "");
                              }
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded transition"
                          >
                            🗑️ Del
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">➕ Crear Operador</h3>
                  <input
                    type="text"
                    id="newOpName"
                    placeholder="Nombre del operador"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white mb-3 focus:border-amber-400 focus:outline-none transition"
                  />
                  <input
                    type="file"
                    id="newOpLogo"
                    accept="image/*"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-400 mb-3 focus:outline-none transition"
                  />
                  <button
                    onClick={async () => {
                      const name = (document.getElementById("newOpName") as HTMLInputElement)?.value;
                      const logoFile = (document.getElementById("newOpLogo") as HTMLInputElement)?.files?.[0];
                      if (name) {
                        await api.createOperator(name, logoFile || null);
                        (document.getElementById("newOpName") as HTMLInputElement).value = "";
                        (document.getElementById("newOpLogo") as HTMLInputElement).value = "";
                        await refresh();
                        showNotification("success", "✓ Operador creado", "");
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition"
                  >
                    ➕ Añadir Operador
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Train Types Tab */}
          {activeTab === "types" && (
            <div className="animate-fadeIn space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <span>🏷️</span> Tipos de Tren ({trainTypes.length})
                </h2>

                {trainTypes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-400">No hay tipos de tren definidos.</p>
                  </div>
                ) : (
                  <div className="space-y-3 mb-6">
                    {trainTypes.map((tt) => (
                      <div key={tt.id} className="bg-black/20 border border-white/10 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tt.color }}
                          ></div>
                          <div>
                            <span className="text-white font-bold font-mono">{tt.code}</span>
                            <span className="text-slate-400 text-sm ml-2">{tt.name}</span>
                          </div>
                          {tt.logo_url && (
                            <img src={fileUrl(tt.logo_url)!} alt={tt.name} className="w-6 h-6 object-contain" />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingType(tt)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded transition"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm(`¿Eliminar tipo "${tt.code}"?`)) {
                                await api.deleteTrainType(tt.id);
                                await refresh();
                                showNotification("success", "✓ Tipo eliminado", "");
                              }
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded transition"
                          >
                            🗑️ Del
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">➕ Crear Tipo de Tren</h3>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="text"
                      id="newTypeCode"
                      placeholder="Código (ej: C-1)"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                    />
                    <input
                      type="text"
                      id="newTypeName"
                      placeholder="Nombre (ej: Rodalia C-1)"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input
                      type="color"
                      id="newTypeColor"
                      defaultValue="#3E8DCA"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 h-10 cursor-pointer"
                    />
                    <input
                      type="file"
                      id="newTypeLogo"
                      accept="image/*"
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-400 focus:outline-none transition"
                    />
                  </div>
                  <button
                    onClick={async () => {
                      const code = (document.getElementById("newTypeCode") as HTMLInputElement)?.value;
                      const name = (document.getElementById("newTypeName") as HTMLInputElement)?.value;
                      const color = (document.getElementById("newTypeColor") as HTMLInputElement)?.value;
                      const logoFile = (document.getElementById("newTypeLogo") as HTMLInputElement)?.files?.[0];
                      if (code && name) {
                        await api.createTrainType(code, name, color, logoFile || null);
                        (document.getElementById("newTypeCode") as HTMLInputElement).value = "";
                        (document.getElementById("newTypeName") as HTMLInputElement).value = "";
                        (document.getElementById("newTypeColor") as HTMLInputElement).value = "#3E8DCA";
                        (document.getElementById("newTypeLogo") as HTMLInputElement).value = "";
                        await refresh();
                        showNotification("success", "✓ Tipo creado", "");
                      }
                    }}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition"
                  >
                    ➕ Añadir Tipo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Styles Tab */}
          {activeTab === "styles" && (
            <div className="animate-fadeIn bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>🎨</span> Personalización Visual
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: "bgColor", label: "Fondo Principal", default: "#050a14" },
                  { key: "headerBgColor", label: "Fondo Encabezado", default: "#BFEFD5" },
                  { key: "headerTextColor", label: "Texto Encabezado", default: "#f5f3ec" },
                  { key: "rowBgColor", label: "Fila Par", default: "#1A3254" },
                  { key: "altBgColor", label: "Fila Impar", default: "#102341" },
                ].map(({ key, label, default: def }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      {label}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        className="w-12 h-10 rounded-lg cursor-pointer border border-white/10"
                        value={(config as any)[key] || def}
                        onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                      />
                      <div className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono">
                        {(config as any)[key] || def}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Tamaño Destino (px)
                </label>
                <input
                  type="number"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  min="20"
                  max="100"
                  value={parseInt(config.destinationFontSize || "48")}
                  onChange={(e) => setConfig({ ...config, destinationFontSize: e.target.value })}
                />
              </div>
              <button
                onClick={handleSaveStyles}
                className="w-full px-6 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-semibold rounded-lg hover:shadow-lg transition"
              >
                💾 Guardar Estilos
              </button>
            </div>
          )}

          {/* Places Tab */}
          {activeTab === "places" && (
            <div className="animate-fadeIn bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>📍</span> Destinos ({places.length})
              </h2>
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-black/20 rounded-lg min-h-12">
                {places.length === 0 ? (
                  <span className="text-slate-400 text-sm">Sin destinos. Añade uno nuevo.</span>
                ) : (
                  places.map((p) => (
                    <div key={p.id} className="inline-flex items-center gap-2 bg-slate-800 rounded-full px-3 py-1 text-sm text-white">
                      {p.name}
                      <button
                        onClick={() => handleDeletePlace(p.id)}
                        className="text-red-400 hover:text-red-300 transition leading-none"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  placeholder="Nombre del nuevo destino..."
                  value={newPlace}
                  onChange={(e) => setNewPlace(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAddPlace()}
                />
                <button
                  onClick={handleAddPlace}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  + Agregar
                </button>
              </div>
            </div>
          )}

          {/* Locutions Tab */}
          {activeTab === "locutions" && (
            <div className="animate-fadeIn space-y-6">
              {/* Templates */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>📝</span> Plantillas
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Plantilla Salidas
                    </label>
                    <textarea
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-amber-400 focus:outline-none transition"
                      value={departureTmpl}
                      onChange={(e) => setDepartureTmpl(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Variables: {"{number}"} {"{type_name}"} {"{destination}"} {"{platform}"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                      Plantilla Llegadas
                    </label>
                    <textarea
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-amber-400 focus:outline-none transition"
                      value={arrivalTmpl}
                      onChange={(e) => setArrivalTmpl(e.target.value)}
                    />
                    <p className="text-xs text-slate-400 mt-1">Variables: {"{number}"} {"{type_name}"} {"{origin}"} {"{platform}"}</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await api.setConfig({
                        announce_departure: departureTmpl,
                        announce_arrival: arrivalTmpl,
                        announce_presets: JSON.stringify(presets),
                      });
                      showNotification("success", "✓ Guardado", "Plantillas actualizadas");
                    } catch (err: any) {
                      showNotification("error", "✗ Error", err.message);
                    }
                  }}
                  className="w-full px-6 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-semibold rounded-lg hover:shadow-lg transition"
                >
                  💾 Guardar Plantillas
                </button>
              </div>

              {/* Presets */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <span>📌</span> Locuciones Predefinidas ({presets.length})
                </h3>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {presets.length === 0 ? (
                    <p className="text-slate-400 text-sm">Sin locuciones. Crea una nueva.</p>
                  ) : (
                    presets.map((p) => (
                      <div key={p.id} className="flex items-start gap-3 bg-black/20 rounded-lg p-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-white">{p.label}</div>
                          <div className="text-slate-400 text-sm truncate">{p.text}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => testSpeak(p.text)}
                            className="text-green-400 hover:text-green-300 text-sm transition"
                          >
                            🔊
                          </button>
                          <button
                            onClick={() => setPresets(presets.filter((x) => x.id !== p.id))}
                            className="text-red-400 hover:text-red-300 text-sm transition"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-400 focus:outline-none transition"
                    placeholder="Etiqueta"
                    value={newPreset.label}
                    onChange={(e) => setNewPreset({ ...newPreset, label: e.target.value })}
                  />
                  <input
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-400 focus:outline-none transition"
                    placeholder="Texto"
                    value={newPreset.text}
                    onChange={(e) => setNewPreset({ ...newPreset, text: e.target.value })}
                  />
                  <button
                    onClick={() => {
                      if (!newPreset.label.trim() || !newPreset.text.trim()) return;
                      const id = newPreset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                      setPresets([...presets, { id, label: newPreset.label, text: newPreset.text }]);
                      setNewPreset({ label: "", text: "" });
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === "voice" && (
            <div className="animate-fadeIn bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm space-y-4">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <span>🎤</span> Configuración de Voz
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Voz</label>
                  <select
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                    value={config.tts_voice || ""}
                    onChange={(e) => setConfig({ ...config, tts_voice: e.target.value })}
                  >
                    <option value="">Voz por defecto</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Velocidad</label>
                    <span className="text-amber-400 font-semibold">{config.tts_rate || "0.95"}</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="2"
                    step="0.05"
                    className="w-full accent-amber-400"
                    value={config.tts_rate || "0.95"}
                    onChange={(e) => setConfig({ ...config, tts_rate: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Tono</label>
                    <span className="text-amber-400 font-semibold">{config.tts_pitch || "1"}</span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="2"
                    step="0.1"
                    className="w-full accent-amber-400"
                    value={config.tts_pitch || "1"}
                    onChange={(e) => setConfig({ ...config, tts_pitch: e.target.value })}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Volumen</label>
                    <span className="text-amber-400 font-semibold">{config.tts_volume || "1"}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    className="w-full accent-amber-400"
                    value={config.tts_volume || "1"}
                    onChange={(e) => setConfig({ ...config, tts_volume: e.target.value })}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={async () => {
                    try {
                      await api.setConfig({
                        tts_voice: config.tts_voice,
                        tts_rate: config.tts_rate,
                        tts_pitch: config.tts_pitch,
                        tts_volume: config.tts_volume,
                      });
                      showNotification("success", "✓ Guardado", "Voz guardada");
                    } catch (err: any) {
                      showNotification("error", "✗ Error", err.message);
                    }
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-semibold rounded-lg hover:shadow-lg transition"
                >
                  💾 Guardar Voz
                </button>
                <button
                  onClick={() => testSpeak(testText)}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  🔊 Probar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notification Toast */}
      {modal && (
        <div className="fixed bottom-6 right-6 animate-slideUp">
          <div
            className={`px-6 py-4 rounded-lg shadow-xl border backdrop-blur-xl flex items-start gap-3 max-w-sm ${modal.type === "success"
              ? "bg-green-500/10 border-green-500/50 text-green-300"
              : modal.type === "error"
                ? "bg-red-500/10 border-red-500/50 text-red-300"
                : "bg-blue-500/10 border-blue-500/50 text-blue-300"
              }`}
          >
            <div className="text-lg leading-none">{modal.type === "success" ? "✓" : modal.type === "error" ? "✕" : "ℹ"}</div>
            <div>
              <div className="font-semibold text-sm">{modal.title}</div>
              <div className="text-xs opacity-90">{modal.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Train Modal */}
      {editingTrain && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-amber-400 to-amber-600 p-4 text-black font-bold text-lg">✏️ Editar Tren</div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Destino</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editFormData.destination || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Hora Programada</label>
                <input
                  type="time"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editFormData.scheduled_time || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, scheduled_time: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Andén</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editFormData.platform || ""}
                  onChange={(e) => setEditFormData({ ...editFormData, platform: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Estado</label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editFormData.status || "Scheduled"}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as Train["status"] })}
                >
                  <option value="Scheduled">Programado</option>
                  <option value="Boarding">Embarque</option>
                  <option value="Departed">Salido</option>
                  <option value="Delayed">Retrasado</option>
                  <option value="Cancelled">Cancelado</option>
                  <option value="Arrived">Llegado</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={handleSaveEditedTrain}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  ✓ Guardar
                </button>
                <button
                  onClick={() => setEditingTrain(null)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition"
                >
                  ✗ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Operator Modal */}
      {editingOperator && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-amber-400 to-amber-600 p-4 text-black font-bold text-lg">✏️ Editar Operador</div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Nombre</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editingOperator.name || ""}
                  onChange={(e) => setEditingOperator({ ...editingOperator, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Logo</label>
                {editingOperator.logo_url && (
                  <div className="mb-2">
                    <img src={fileUrl(editingOperator.logo_url)!} alt="Logo" className="w-16 h-16 object-contain" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-400 focus:outline-none transition"
                  onChange={(e) => setOperatorLogo(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={async () => {
                    await api.updateOperator(editingOperator.id, editingOperator.name, operatorLogo || undefined);
                    setEditingOperator(null);
                    setOperatorLogo(null);
                    await refresh();
                    showNotification("success", "✓ Operador actualizado", "");
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  ✓ Guardar
                </button>
                <button
                  onClick={() => {
                    setEditingOperator(null);
                    setOperatorLogo(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition"
                >
                  ✗ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Train Type Modal */}
      {editingType && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-amber-400 to-amber-600 p-4 text-black font-bold text-lg">✏️ Editar Tipo</div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Código</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editingType.code || ""}
                  onChange={(e) => setEditingType({ ...editingType, code: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Nombre</label>
                <input
                  type="text"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-amber-400 focus:outline-none transition"
                  value={editingType.name || ""}
                  onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Color</label>
                <input
                  type="color"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 h-10 cursor-pointer"
                  value={editingType.color || "#3E8DCA"}
                  onChange={(e) => setEditingType({ ...editingType, color: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Logo</label>
                {editingType.logo_url && (
                  <div className="mb-2">
                    <img src={fileUrl(editingType.logo_url)!} alt="Logo" className="w-12 h-12 object-contain" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-slate-400 focus:outline-none transition"
                  onChange={(e) => setTypeLogo(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={async () => {
                    await api.updateTrainType(editingType.id, editingType.code, editingType.name, editingType.color, typeLogo || undefined);
                    setEditingType(null);
                    setTypeLogo(null);
                    await refresh();
                    showNotification("success", "✓ Tipo actualizado", "");
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  ✓ Guardar
                </button>
                <button
                  onClick={() => {
                    setEditingType(null);
                    setTypeLogo(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition"
                >
                  ✗ Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}
