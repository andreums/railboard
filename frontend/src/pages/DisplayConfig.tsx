import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, fileUrl, type Config, type DisplaySummary, type Operator, type Train, type TrainType } from "../lib/api";
import { LANGUAGES, t, type Language } from "../lib/i18n";
import { speakWithFallback, loadVoiceSettings, getVoiceURIForLanguage } from "../lib/tts";
import { handleImgError } from "../lib/svgPlaceholder";
import { buildSectorOptions } from "../lib/trainOptions";
import { fetchRegions } from "../services/routeApi";
import AdminSidebar from "../components/admin/AdminSidebar";
import { normalizeStops, type TrainStop } from "../lib/trainStops";
import StopsEditor from "../components/admin/StopsEditor";

const defaultConfig = (stationName = ""): Config => ({
  station_name: stationName,
  mode: "departures",
  displayMode: "multiple",
  language: "es",
  languages: ["es"],
  footerText: "",
  platformMin: "1",
  platformMax: "8",
  platformAllowEmpty: true,
  sectorMin: "A",
  sectorMax: "D",
  sectorAllowEmpty: true,
  routeRegion: "",
  bgColor: "#050a14",
  headerBgColor: "#BFEFD5",
  headerTextColor: "#102341",
  rowBgColor: "#1A3254",
  altBgColor: "#102341",
  clockMode: "real",
  clockFakeTime: "12:00:00",
  clockFakeStepSeconds: "1",
  showDestinationIcon: true,
});

const EVENT_TYPES: { id: string; label: string }[] = [
  { id: "TRAIN_ANNOUNCEMENT", label: "Anunci de tren" },
  { id: "TRAIN_APPROACHING", label: "Tren apropant-se" },
  { id: "TRAIN_ARRIVING", label: "Tren arribant" },
  { id: "TRAIN_AT_PLATFORM", label: "Tren a via" },
  { id: "TRAIN_READY_FOR_BOARDING", label: "Preparat per a embarcar" },
  { id: "TRAIN_BOARDING", label: "Embarcant" },
  { id: "TRAIN_IMMINENT_DEPARTURE", label: "Eixida imminent" },
  { id: "TRAIN_DEPARTING", label: "Tren eixint" },
  { id: "TRAIN_DELAYED", label: "Tren amb retard" },
  { id: "TRAIN_CANCELLED", label: "Tren cancel·lat" },
  { id: "PLATFORM_CHANGE", label: "Canvi de via" },
];

const formatPlatform = (train: Train) => {
  const sector = train.sector && train.sector !== "-" ? train.sector : "";
  const platform = train.platform && train.platform !== "-" ? train.platform : "";
  if (!platform && !sector) return "—";
  if (!platform) return `Sector ${sector}`;
  if (!sector) return platform;
  return /^\d+$/.test(platform) && /^\d+$/.test(sector) ? `${platform}-${sector}` : `${platform}${sector}`;
};

export default function DisplayConfigPage() {
  const { stationId } = useParams<{ stationId?: string }>();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "platforms" | "style" | "trains" | "types">("config");
  const [displays, setDisplays] = useState<DisplaySummary[]>([]);
  const [globalConfig, setGlobalConfig] = useState<Config | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [trainTypes, setTrainTypes] = useState<TrainType[]>([]);
  const [routeRegions, setRouteRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false);
  const [announcingId, setAnnouncingId] = useState<number | null>(null);
  const [announcePopup, setAnnouncePopup] = useState<{ train: Train } | null>(null);
  const [popupEventType, setPopupEventType] = useState<string>("TRAIN_ANNOUNCEMENT");
  const [popupLanguages, setPopupLanguages] = useState<Language[]>([]);
  const [popupSoundId, setPopupSoundId] = useState<number | null>(null);
  const [audioAssets, setAudioAssets] = useState<{ id: number; name: string; asset_type: string }[]>([]);
  const [editingTrain, setEditingTrain] = useState<Partial<Train> | null>(null);
  const [trainSaving, setTrainSaving] = useState(false);
  const [editingStops, setEditingStops] = useState<TrainStop[]>([]);
  const [stationNameDraft, setStationNameDraft] = useState("");
  const [trainIconMode, setTrainIconMode] = useState<"none" | "operator" | "type" | "destination" | "custom">("destination");

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, global, op, tt, regions] = await Promise.all([
        api.listDisplays(),
        api.getConfig(),
        api.listOperators(),
        api.listTrainTypes(),
        fetchRegions(),
      ]);
      setDisplays(data || []);
      setGlobalConfig(global);
      setOperators(op || []);
      setTrainTypes(tt || []);
      setRouteRegions(regions || []);
      const currentId = Number(stationId);
      const current = data.find((item) => item.station.id === currentId) || data[0] || null;
      setLocalConfig(current ? { ...defaultConfig(current.station.short || current.station.name), ...current.config } : defaultConfig());
    } catch (err: any) {
      setError(err?.message || "No se pudieron cargar los displays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [stationId]);

  const displayMode = globalConfig?.displayMode || "multiple";
  const current = useMemo(() => {
    const currentId = Number(stationId);
    if (displayMode === "single") {
      return displays.find((item) => item.station.id === currentId) || displays[0] || null;
    }
    return displays.find((item) => item.station.id === currentId) || null;
  }, [displays, stationId, displayMode]);

  const displayedStation = current?.station || null;
  const displayedConfig = localConfig || current?.config || null;
  const displayName =
    stationNameDraft.trim() || displayedConfig?.station_name?.trim() || displayedStation?.short || displayedStation?.name || "—";
  const displayedLanguages = useMemo(() => {
    const langs = displayedConfig?.languages?.length ? displayedConfig.languages : [(displayedConfig?.language as Language) ?? "es"];
    return Array.from(new Set(langs.map((language) => language as Language))).filter(Boolean);
  }, [displayedConfig]);
  const displayLanguage: Language = displayedLanguages[0] || "es";
  const displaySectorOptions = buildSectorOptions(displayedConfig, []);
  const trains = current?.trains || [];

  useEffect(() => {
    setStationNameDraft(displayedConfig?.station_name || displayedStation?.short || displayedStation?.name || "");
  }, [displayedStation?.id, displayedStation?.name, displayedStation?.short, displayedConfig?.station_name]);

  useEffect(() => {
    if (!announcePopup) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setAnnouncePopup(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [announcePopup]);

  const update = (patch: Partial<Config>) => {
    setLocalConfig((prev) => ({
      ...(prev || defaultConfig(displayedStation?.short || displayedStation?.name || "")),
      ...patch,
    }));
  };

  const setDisplayLanguages = (languages: Language[]) => {
    const next = (languages.length ? Array.from(new Set(languages)) : ["es"]) as Language[];
    update({ languages: next, language: next[0] });
  };

  const toggleDisplayLanguage = (language: Language, checked: boolean) => {
    const next = checked ? Array.from(new Set([...displayedLanguages, language])) : displayedLanguages.filter((item) => item !== language);
    setDisplayLanguages(next.length ? next : [language]);
  };

  const save = async () => {
    if (!displayedStation || !localConfig) return;
    try {
      setSaving(true);
      const nextName = stationNameDraft.trim() || displayedStation.short || displayedStation.name;
      if (nextName !== displayedStation.name || nextName !== displayedStation.short) {
        await api.updateStation(displayedStation.id, {
          name: nextName,
          short: nextName,
        });
      }
      await api.saveStationDisplayConfig(displayedStation.id, {
        ...localConfig,
        station_name: nextName,
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const generateTrain = async () => {
    if (!displayedStation) return;
    try {
      setBusy(true);
      await api.generateRandomTrain(displayedStation.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const clearTrains = async () => {
    if (!displayedStation) return;
    if (!confirm(`¿Vaciar los trenes de ${displayedStation.short || displayedStation.name}?`)) return;
    try {
      setBusy(true);
      await api.clearTrains(displayedStation.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const deleteTrain = async (trainId: number) => {
    if (!confirm("¿Eliminar este tren?")) return;
    try {
      setBusy(true);
      await api.deleteTrain(trainId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const exportTrains = async () => {
    if (!displayedStation) return;
    try {
      setBusy(true);
      await api.exportTrains(displayedStation.id);
    } catch (err: any) {
      setError(err?.message || "No se pudieron exportar los trenes");
    } finally {
      setBusy(false);
    }
  };

  const announceRow = async (train: Train) => {
    setPopupEventType("TRAIN_ANNOUNCEMENT");
    setPopupLanguages(displayedLanguages);
    setPopupSoundId(null);
    setAnnouncePopup({ train });
    try {
      const assets = await api.listAudioAssets();
      setAudioAssets(assets.filter((a) => ["CHIME", "GONG", "ATTENTION_TONE"].includes(a.asset_type)));
    } catch { setAudioAssets([]); }
  };

  const executeAnnounce = async () => {
    if (!announcePopup || !displayedStation) return;
    const { train } = announcePopup;
    try {
      setAnnouncingId(train.id);
      setAnnouncePopup(null);
      const result = await api.testAnnouncement({
        train,
        eventType: popupEventType,
        languages: popupLanguages,
        sound_id: popupSoundId || undefined,
      });
      const composed: Record<string, string> = result?.composed || {};
      const chimePath: string | null = result?.chime?.assetPath || null;
      if (chimePath) {
        const url = fileUrl(chimePath);
        if (url) await new Audio(url).play().catch(() => {});
      }
      for (const lang of popupLanguages) {
        const text = composed[lang];
        if (!text) continue;
        const mergedConfig = { ...(globalConfig || {}), ...(displayedConfig || {}) };
        const vs = { ...loadVoiceSettings(mergedConfig), voiceURI: getVoiceURIForLanguage(mergedConfig, lang) };
        await speakWithFallback(text, lang, vs);
      }
    } catch (err: any) {
      setError(err?.message || "Error al compondre l'anunci");
    } finally {
      window.setTimeout(() => setAnnouncingId((current) => (current === train.id ? null : current)), 1000);
    }
  };

  const openTrainEditor = (train?: Train) => {
    if (!displayedStation) return;
    setEditingTrain(
      train
        ? {
            ...train,
            station_id: displayedStation.id,
            platform: train.platform && train.platform !== "-" ? train.platform : "",
            sector: train.sector && train.sector !== "-" ? train.sector : "",
          }
        : {
            number: "",
            operator_id: null,
            train_type_id: null,
            origin: displayedStation.name,
            destination: "",
            stops: [],
            scheduled_time: "12:00",
            expected_time: "12:00",
            platform: "",
            sector: "",
            observations: "",
            status: "Scheduled",
            station_id: displayedStation.id,
          },
    );
    setEditingStops(normalizeStops(train?.stops));
  };

  const saveTrain = async () => {
    if (!editingTrain || !displayedStation) return;
    try {
      setTrainSaving(true);
      const stops = normalizeStops(editingStops);
      const payload = {
        ...editingTrain,
        station_id: displayedStation.id,
        platform: editingTrain.platform && editingTrain.platform !== "-" ? editingTrain.platform : "",
        sector: editingTrain.sector && editingTrain.sector !== "-" ? editingTrain.sector : "",
        stops,
      };
      if (editingTrain.id) await api.updateTrain(editingTrain.id, payload);
      else await api.createTrain(payload);
      setEditingTrain(null);
      setEditingStops([]);
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el tren");
    } finally {
      setTrainSaving(false);
    }
  };

  const modalSectorOptions =
    editingTrain?.sector && !displaySectorOptions.includes(editingTrain.sector)
      ? [...displaySectorOptions, editingTrain.sector]
      : displaySectorOptions;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Cargando display...</p>
        </div>
      </div>
    );
  }

  if (error && !displays.length) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <p className="text-red-700 font-semibold">{error}</p>
          <button onClick={load} className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const handleAddDisplay = async () => {
    const nextIndex = displays.length + 1;
    const name = window.prompt("Nombre del nuevo display", `Display ${nextIndex}`);
    if (name === null) return;
    const short = window.prompt("Nombre corto", name.slice(0, 18)) ?? name;
    try {
      setLoading(true);
      await api.createStation({
        name: name.trim() || `Display ${nextIndex}`,
        short: short.trim() || name.trim() || `Display ${nextIndex}`,
        color: "#1A3254",
      });
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo crear el display");
    } finally {
      setLoading(false);
    }
  };

  if (displayMode === "multiple" && !displayedStation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeId="displays"
          variant="fixed"
        />
        <div className={`min-h-screen flex flex-col transition-all duration-200 ${sidebarOpen ? "lg:ml-[260px]" : "lg:ml-0"}`}>
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Toggle sidebar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
                <h1 className="text-lg font-bold text-slate-900">Displays</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddDisplay}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                  + Añadir display
                </button>
                <Link to="/admin" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                  Admin
                </Link>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-4">
            {displays.length === 0 ? (
              <div className="text-slate-500 text-sm">No hay displays configurados.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {displays.map((display) => (
                  <Link
                    key={display.station.id}
                    to={`/admin/displays/${display.station.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-300 transition"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{display.station.short || display.station.name}</h2>
                        <p className="text-sm text-slate-500">{display.station.name}</p>
                      </div>
                      {display.station.logo_url && (
                        <img
                          src={fileUrl(display.station.logo_url)!}
                          alt={display.station.name}
                          className="w-10 h-10 object-contain"
                          onError={(e) => handleImgError(e, display.station.name)}
                        />
                      )}
                    </div>
                    <div className="mt-4 text-sm text-slate-700">
                      <div>{display.trains.length} trenes</div>
                      <div className="text-slate-500">Modo: {display.config.mode || "departures"}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  if (!displayedStation) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeId="displays"
          variant="fixed"
        />
        <div className={`min-h-screen flex flex-col transition-all duration-200 ${sidebarOpen ? "lg:ml-[260px]" : "lg:ml-0"}`}>
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Toggle sidebar">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
                <h1 className="text-lg font-bold text-slate-900">Displays</h1>
              </div>
              <Link to="/admin" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Admin
              </Link>
            </div>
          </header>
          <main className="flex-1 overflow-auto px-4 md:px-6 lg:px-8 py-4">
            <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white shadow-sm p-6">
              <p className="text-slate-500">No hay displays configurados.</p>
              <Link to="/admin" className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                ← Volver al admin
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeId="displays"
        variant="fixed"
      />
      <div className={`min-h-screen flex flex-col transition-all duration-200 ${sidebarOpen ? "lg:ml-[260px]" : "lg:ml-0"}`}>
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 md:px-6 lg:px-8 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600" title="Toggle sidebar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              {displayedStation.logo_url && (
                <img
                  src={fileUrl(displayedStation.logo_url)!}
                  alt={displayedStation.name}
                  className="w-10 h-10 object-contain"
                  onError={(e) => handleImgError(e, displayedStation.name)}
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-slate-900">{displayName}</h1>
                <p className="text-sm text-slate-500">ID {displayedStation.id} · {trains.length} trens</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/displays" className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                ← Llista
              </Link>
              <Link to="/admin" className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
                Admin
              </Link>
            </div>
          </div>
        </header>

      <main className="flex-1 flex flex-col overflow-auto px-4 sm:px-6 py-4 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { id: "config", label: "Configuración" },
              { id: "platforms", label: "Vías y sectores" },
              { id: "style", label: "Estilo y reloj" },
              { id: "trains", label: "Trenes" },
              { id: "types", label: "Tipos de tren" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id ? "bg-blue-50 text-blue-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {activeTab === "config" && (
            <section className="space-y-4 h-full overflow-y-auto pr-1">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Configuración del display</h2>
                    <p className="text-sm text-slate-500">La configuración se guarda de forma independiente para esta estación.</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Modo global: {displayMode === "single" ? "solo un display" : "múltiples displays"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/display/${displayedStation.id}`}
                      target="_blank"
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                    >
                      Ver display
                    </Link>
                    <button
                      onClick={save}
                      disabled={saving || busy}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nombre de la estación</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={stationNameDraft}
                      onChange={(e) => setStationNameDraft(e.target.value)}
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Este es el unico nombre del display y se sincroniza con la base de datos.
                    </p>
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Modo</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.mode || "departures"}
                      onChange={(e) => update({ mode: e.target.value as Config["mode"] })}
                    >
                      <option value="departures">Salidas</option>
                      <option value="arrivals">Llegadas</option>
                    </select>
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Región / ciudad</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.routeRegion || ""}
                      onChange={(e) => update({ routeRegion: e.target.value })}
                    >
                      <option value="">Todas las regiones</option>
                      {routeRegions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Idiomas</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {displayedLanguages.map((language) => (
                        <span
                          key={language}
                          className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                        >
                          {LANGUAGES[language]}
                        </span>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(LANGUAGES).map(([code, name]) => {
                        const language = code as Language;
                        const active = displayedLanguages.includes(language);
                        return (
                          <label
                            key={code}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${active ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                          >
                            <input type="checkbox" checked={active} onChange={(e) => toggleDisplayLanguage(language, e.target.checked)} />
                            <span>{name}</span>
                          </label>
                        );
                      })}
                    </div>
<p className="text-xs text-slate-500 mt-2">
                                              El primer idioma es el principal. Los anuncios y las voces pueden usar cualquiera de los idiomas seleccionados.
                                            </p>
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Logo URL</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.logo_url || ""}
                      onChange={(e) => update({ logo_url: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "platforms" && (
            <section className="space-y-4 h-full overflow-y-auto pr-1">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Vías y sectores</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vía mínima</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.platformMin || "1"}
                      onChange={(e) => update({ platformMin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vía máxima</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.platformMax || "8"}
                      onChange={(e) => update({ platformMax: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={displayedConfig?.platformAllowEmpty !== false}
                      onChange={(e) => update({ platformAllowEmpty: e.target.checked })}
                    />
                    Permitir sin vía
                  </label>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sector mínimo</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.sectorMin || "A"}
                      onChange={(e) => update({ sectorMin: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sector máximo</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.sectorMax || "D"}
                      onChange={(e) => update({ sectorMax: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={displayedConfig?.sectorAllowEmpty !== false}
                      onChange={(e) => update({ sectorAllowEmpty: e.target.checked })}
                    />
                    Permitir sin sector
                  </label>
                  <label className="flex items-center gap-3 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displayedConfig?.showDestinationIcon !== false}
                      onChange={(e) => update({ showDestinationIcon: e.target.checked })}
                    />
                    Mostrar icono antes del destino
                  </label>
                </div>
              </div>
            </section>
          )}

          {activeTab === "style" && (
            <section className="space-y-4 h-full overflow-y-auto pr-1">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Estilo y reloj</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fondo</label>
                    <input
                      type="color"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                      value={displayedConfig?.bgColor || "#050a14"}
                      onChange={(e) => update({ bgColor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Cabecera</label>
                    <input
                      type="color"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                      value={displayedConfig?.headerBgColor || "#BFEFD5"}
                      onChange={(e) => update({ headerBgColor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Texto cabecera</label>
                    <input
                      type="color"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                      value={displayedConfig?.headerTextColor || "#102341"}
                      onChange={(e) => update({ headerTextColor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fila principal</label>
                    <input
                      type="color"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                      value={displayedConfig?.rowBgColor || "#1A3254"}
                      onChange={(e) => update({ rowBgColor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Fila alterna</label>
                    <input
                      type="color"
                      className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 h-10 cursor-pointer"
                      value={displayedConfig?.altBgColor || "#102341"}
                      onChange={(e) => update({ altBgColor: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reloj</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.clockMode || "real"}
                      onChange={(e) => update({ clockMode: e.target.value as Config["clockMode"] })}
                    >
                      <option value="real">Sistema</option>
                      <option value="fake">Ficticio</option>
                    </select>
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hora ficticia</label>
                    <input
                      type="time"
                      step="1"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.clockFakeTime || "12:00:00"}
                      onChange={(e) => update({ clockFakeTime: e.target.value })}
                      disabled={(displayedConfig?.clockMode || "real") !== "fake"}
                    />
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Avance</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.clockFakeStepSeconds || "1"}
                      onChange={(e) => update({ clockFakeStepSeconds: e.target.value })}
                      disabled={(displayedConfig?.clockMode || "real") !== "fake"}
                    >
                      {["1", "2", "5", "10", "15"].map((seconds) => (
                        <option key={seconds} value={seconds}>
                          {seconds}s / segundo
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Pie</label>
                    <input
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                      value={displayedConfig?.footerText || ""}
                      onChange={(e) => update({ footerText: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === "trains" && (
            <section className="space-y-4 h-full overflow-hidden">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col min-h-0">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Trenes del display</h3>
                    <p className="text-sm text-slate-500">{trains.length} trenes asociados</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => openTrainEditor()}
                      disabled={busy || trainSaving}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Añadir tren
                    </button>
                    <button
                      onClick={generateTrain}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Generar
                    </button>
                    <button
                      onClick={exportTrains}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Exportar trenes
                    </button>
                    <button
                      onClick={clearTrains}
                      disabled={busy}
                      className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Vaciar
                    </button>
                  </div>
                </div>

                {trains.length === 0 ? (
                  <div className="text-slate-500 text-sm py-4">No hay trenes para este display.</div>
                ) : (
                  <div className="overflow-auto rounded-xl border border-slate-200 flex-1 min-h-0">
                    <table className="w-full text-[13px]">
                      <thead className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                        <tr className="text-xs uppercase tracking-wide text-slate-500">
                          <th className="text-left py-2 px-3">Hora</th>
                          <th className="text-left py-2 px-3">Número</th>
                          <th className="text-left py-2 px-3">Tipo</th>
                          <th className="text-left py-2 px-3">Operador</th>
                          <th className="text-left py-2 px-3">Destino</th>
                          <th className="text-left py-2 px-3">Vía</th>
                          <th className="text-center py-2 px-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-sm">
                        {trains.map((train) => (
                          <tr key={train.id} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3 whitespace-nowrap font-mono text-slate-900">
                              <div className="flex flex-col gap-0.5">
                                <div className="font-semibold text-xs">{train.scheduled_time}</div>
                                {train.expected_time !== train.scheduled_time && (
                                  <div className="text-xs text-green-700">Est. {train.expected_time}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{train.number}</td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {(train.type_name?.includes("Cercanías") || train.type_name?.includes("cercanías")) && (
                                  <img
                                    src="https://info.adif.es/recursos/C01CERMAD.png?v=12"
                                    alt="Cercanías"
                                    style={{ height: "1.22em", width: "auto", flexShrink: 0, objectFit: "contain" }}
                                    onError={(e) => handleImgError(e, "Cercanías")}
                                  />
                                )}
                                {train.type_color ? (
                                  <span
                                    className="inline-flex items-center justify-center rounded px-2 py-0.5 text-xs font-bold text-white"
                                    style={{ backgroundColor: train.type_color, minWidth: "3rem" }}
                                  >
                                    {train.type_code || "—"}
                                  </span>
                                ) : (
                                  <span className="text-slate-900 text-xs">{train.type_code || "—"}</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-slate-700 whitespace-nowrap truncate max-w-[8rem]">
                              {train.operator_name || "—"}
                            </td>
                            <td className="py-2 px-3 text-slate-900">
                              <div className="flex items-center gap-1.5 truncate">
                                {train.type_destination_icon && (
                                  <img
                                    src={fileUrl(train.type_destination_icon) || ""}
                                    alt=""
                                    style={{ height: "1em", width: "auto", flexShrink: 0, objectFit: "contain" }}
                                    onError={(e) => handleImgError(e, train.destination || "Destino")}
                                  />
                                )}
                                <span className="truncate">{train.destination}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
<span
                                                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                    train.status === "Departed"
                                                      ? "bg-green-100 text-green-800"
                                                      : train.status === "Boarding"
                                                        ? "bg-amber-100 text-amber-800"
                                                        : train.status === "Delayed"
                                                          ? "bg-red-100 text-red-800"
                                                          : train.status === "Cancelled"
                                                            ? "bg-slate-100 text-slate-700"
                                                            : "bg-slate-100 text-slate-700"
                                                  }`}
                              >
                                {formatPlatform(train)}
                              </span>
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
<button
                                                  onClick={() => openTrainEditor(train)}
                                                  disabled={busy || trainSaving}
                                                  className="px-2 py-1 rounded bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                                  title="Editar"
                                                >
                                                  ✏️
                                                </button>
                                                 <button
                                                   onClick={() => announceRow(train)}
                                                   disabled={announcingId === train.id}
                                                   className="px-2 py-1 rounded bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                                   title="Anunciar"
                                                 >
                                                   🔊
                                                 </button>
                                                <button
                                                  onClick={() => deleteTrain(train.id)}
                                                  className="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100"
                                                  title="Eliminar"
                                                >
                                                  ✕
                                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "types" && (
            <section className="space-y-4 h-full overflow-hidden">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm h-full flex flex-col">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Tipos de tren</h3>
                  <p className="text-sm text-slate-500">Configura iconos y anuncios de megafonía por tipo de tren</p>
                </div>

                <div className="overflow-auto rounded-lg border border-slate-200 flex-1 min-h-0">
                  <div className="grid gap-3 p-4">
                    {trainTypes.map((type) => (
                      <TypeCard key={type.id} type={type} onUpdated={load} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>

      {announcePopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-xl p-5 w-80"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-slate-900">Anunciar tren</h4>
              <button onClick={() => setAnnouncePopup(null)} className="text-slate-400 hover:text-slate-600 text-sm">&times;</button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {announcePopup.train.type_name} {announcePopup.train.number} &middot; {announcePopup.train.destination}
            </p>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Evento</label>
            <div className="flex flex-wrap gap-1.5 mb-3 max-h-32 overflow-y-auto">
              {EVENT_TYPES.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setPopupEventType(event.id)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                    popupEventType === event.id
                      ? "bg-blue-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {event.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Idiomas</label>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3">
              {displayedLanguages.map((lang) => (
                <label key={lang} className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={popupLanguages.includes(lang)}
                    onChange={(e) => {
                      if (e.target.checked) setPopupLanguages((prev) => [...prev, lang]);
                      else setPopupLanguages((prev) => prev.filter((l) => l !== lang));
                    }}
                    className="rounded border-slate-300 accent-blue-900"
                  />
                  {LANGUAGES[lang]}
                </label>
              ))}
            </div>

            {audioAssets.length > 0 && (
              <>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">So d'avís</label>
                <select
                  value={popupSoundId ?? ""}
                  onChange={(e) => setPopupSoundId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition mb-3"
                >
                  <option value="">Sense so</option>
                  {audioAssets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setAnnouncePopup(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel·lar
              </button>
              <button
                onClick={executeAnnounce}
                disabled={announcingId === announcePopup.train.id || !popupLanguages.length}
                className="px-3 py-1.5 rounded-lg bg-blue-900 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {announcingId === announcePopup.train.id ? "Anunciant..." : "Anunciar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTrain && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !trainSaving && setEditingTrain(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingTrain.id ? "Editar tren" : "Añadir tren"}</h3>
                <p className="text-xs text-slate-500">{displayedStation.short || displayedStation.name}</p>
              </div>
              <button
                onClick={() => setEditingTrain(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Número 1</div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.number || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, number: e.target.value })}
                  />
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Número 2</div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.number2 || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, number2: e.target.value })}
                    placeholder="Opcional"
                  />
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Estado</div>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.status || "Scheduled"}
                    onChange={(e) => setEditingTrain({ ...editingTrain, status: e.target.value as Train["status"] })}
                  >
                    <option value="Scheduled">Programado</option>
                    <option value="Boarding">Embarque</option>
                    <option value="Delayed">Retrasado</option>
                    <option value="Departed">Salido</option>
                    <option value="Arrived">Llegado</option>
                    <option value="Cancelled">Cancelado</option>
                  </select>
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Operador</div>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.operator_id ?? ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, operator_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">—</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tipo</div>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.train_type_id ?? ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, train_type_id: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">—</option>
                    {trainTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.code} — {type.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Origen</div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.origin || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, origin: e.target.value })}
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Destino 1</div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.destination || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, destination: e.target.value })}
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Destino 2</div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.destination2 || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, destination2: e.target.value })}
                    placeholder="Opcional"
                  />
                </label>
                <label className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Imagen personalizada destino</div>
            <input
              type="file"
              accept="image/*"
              id={`train-icon-${editingTrain.id || "new"}`}
              className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:outline-none"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setTrainIconMode("custom");
                        setEditingTrain({ ...editingTrain, custom_icon_file: file });
                      }
                    }}
                  />
                  {editingTrain.custom_icon_url && (
                    <div className="mt-2 text-xs text-slate-500">Imagen actual: {editingTrain.custom_icon_url}</div>
                  )}
                </label>
                <label className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Mostrar</div>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={trainIconMode}
                    onChange={(e) => setTrainIconMode(e.target.value as typeof trainIconMode)}
                  >
                    <option value="none">No mostrar imagen</option>
                    <option value="custom">Imagen personalizada</option>
                    <option value="destination">Icono de destino (tipo tren)</option>
                    <option value="type">Logo de tipo de tren</option>
                    <option value="operator">Logo de operador</option>
                  </select>
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hora programada</div>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.scheduled_time || "12:00"}
                    onChange={(e) => setEditingTrain({ ...editingTrain, scheduled_time: e.target.value })}
                  />
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hora estimada</div>
                  <input
                    type="time"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.expected_time || "12:00"}
                    onChange={(e) => setEditingTrain({ ...editingTrain, expected_time: e.target.value })}
                  />
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Vía</div>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    placeholder="1, 1-3, 1,2,3 o buit"
                    value={editingTrain.platform || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, platform: e.target.value })}
                  />
                </label>
                <label className="block">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Sector</div>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition"
                    value={editingTrain.sector && editingTrain.sector !== "-" ? editingTrain.sector : ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, sector: e.target.value })}
                  >
                    {modalSectorOptions.map((sector) => (
                      <option key={sector || "empty"} value={sector}>
                        {sector ? `Sector ${sector}` : "— Sin sector —"}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="md:col-span-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t("fare-restrictions", displayLanguage)}</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {([
                      ["commuterTicketsNotAccepted", "fare-commuter-tickets"],
                      ["commuterPassesNotAccepted", "fare-commuter-passes"],
                      ["regionalTicketsNotAccepted", "fare-regional-tickets"],
                      ["regionalPassesNotAccepted", "fare-regional-passes"],
                      ["reservationRequired", "fare-reservation"],
                      ["supplementRequired", "fare-supplement"],
                      ["specificTicketRequired", "fare-specific-ticket"],
                    ] as const).map(([key, i18nKey]) => (
                      <label key={key} className="flex items-center gap-1.5 text-sm text-slate-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!!(editingTrain.fare_restrictions as any)?.[key]}
                          onChange={(e) => setEditingTrain({
                            ...editingTrain,
                            fare_restrictions: { ...(editingTrain.fare_restrictions as any || {}), [key]: e.target.checked },
                          })}
                          className="w-4 h-4 rounded border-slate-500 text-blue-900 focus:ring-blue-900"
                        />
                        {t(i18nKey, displayLanguage)}
                      </label>
                    ))}
                  </div>
                </div>
                <label className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Observaciones</div>
                  <textarea
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition min-h-24 resize-y"
                    value={editingTrain.observations || ""}
                    onChange={(e) => setEditingTrain({ ...editingTrain, observations: e.target.value })}
                  />
                </label>
                <div className="block md:col-span-2">
                  <div className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Paradas intermedias</div>
                  <StopsEditor stops={editingStops} onChange={setEditingStops} variant="light" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  onClick={() => setEditingTrain(null)}
                  disabled={trainSaving}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveTrain}
                  disabled={trainSaving}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {trainSaving ? "Guardando..." : "Guardar tren"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

function TypeCard({ type, onUpdated }: { type: TrainType; onUpdated: () => void }) {
  const [draft, setDraft] = useState(type.announce_template || "");

  const saveTemplate = async () => {
    try {
      await api.updateTrainType(type.id, type.code, type.name, type.color, undefined, undefined, draft || null);
      onUpdated();
    } catch (err) {
      alert("Error al guardar la plantilla");
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {type.color && (
            <span
              className="inline-flex items-center justify-center rounded px-3 py-1 text-xs font-bold text-white min-w-12 shrink-0"
              style={{ backgroundColor: type.color }}
            >
              {type.code}
            </span>
          )}
          <span className="font-semibold text-slate-900 truncate">{type.name}</span>
        </div>
        <button
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) {
                try {
                  await api.updateTrainType(type.id, type.code, type.name, type.color, undefined, file);
                  onUpdated();
                } catch (err) {
                  alert("Error al subir icono");
                }
              }
            };
            input.click();
          }}
          className="inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          {type.destination_icon_url ? "Cambiar" : "Agregar"} icono
        </button>
      </div>
      {type.destination_icon_url && <div className="text-xs text-slate-500 mb-2">Icono: {type.destination_icon_url}</div>}
      <div className="mt-3">
        <label className="blocktext-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Plantilla de megafonía (opcional)</label>
        <textarea
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-900 focus:outline-none transition text-sm min-h-[4rem] resize-y"
          placeholder="Ej: Atención. Tren {type_name}{number_text} con destino a {destination}, efectuará su salida por la vía {platform}{sector_text}. Paradas: {stops}."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <p className="text-[11px] text-slate-500 mt-1">
          Variables disponibles: {"{type_name}"}, {"{number_text}"}, {"{destination}"}, {"{platform}"}, {"{sector_text}"}, {"{stops}"},{" "}
          {"{origin}"}, {"{operator}"}
        </p>
        {draft !== (type.announce_template || "") && (
          <button
            onClick={saveTemplate}
            className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
          >
            Guardar plantilla
          </button>
        )}
      </div>
    </div>
  );
}
