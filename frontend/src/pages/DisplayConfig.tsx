import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fileUrl, type Config, type DisplaySummary, type Operator, type Train, type TrainType } from "../lib/api";
import { LANGUAGES, type Language } from "../lib/i18n";
import { announceTrain } from "../lib/tts";
import { buildPlatformOptions, buildSectorOptions } from "../lib/trainOptions";
import { fetchRegions } from "../services/routeApi";

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
});

const formatPlatform = (train: Train) => {
  const sector = train.sector && train.sector !== "-" ? train.sector : "";
  const platform = train.platform && train.platform !== "-" ? train.platform : "";
  if (!platform && !sector) return "—";
  if (!platform) return `Sector ${sector}`;
  if (!sector) return platform;
  return /^\d+$/.test(platform) && /^\d+$/.test(sector)
    ? `${platform}-${sector}`
    : `${platform}${sector}`;
};

export default function DisplayConfigPage() {
  const { stationId } = useParams<{ stationId?: string }>();
  const [activeTab, setActiveTab] = useState<"config" | "platforms" | "style" | "trains">("config");
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
  const [editingTrain, setEditingTrain] = useState<Partial<Train> | null>(null);
  const [trainSaving, setTrainSaving] = useState(false);
  const [editingStopsText, setEditingStopsText] = useState("");
  const [stationNameDraft, setStationNameDraft] = useState("");

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
  const displayName = stationNameDraft.trim() || displayedConfig?.station_name?.trim() || displayedStation?.short || displayedStation?.name || "—";
  const displayedLanguages = useMemo(() => {
    const langs = displayedConfig?.languages?.length
      ? displayedConfig.languages
      : [(displayedConfig?.language as Language) ?? "es"];
    return Array.from(new Set(langs.map((language) => language as Language))).filter(Boolean);
  }, [displayedConfig]);
  const displayPlatformOptions = buildPlatformOptions(displayedConfig, []);
  const displaySectorOptions = buildSectorOptions(displayedConfig, []);
  const trains = current?.trains || [];

  useEffect(() => {
    setStationNameDraft(displayedConfig?.station_name || displayedStation?.short || displayedStation?.name || "");
  }, [displayedStation?.id, displayedStation?.name, displayedStation?.short, displayedConfig?.station_name]);

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
    const next = checked
      ? Array.from(new Set([...displayedLanguages, language]))
      : displayedLanguages.filter((item) => item !== language);
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
    if (!displayedStation || !displayedConfig) return;
    try {
      setAnnouncingId(train.id);
      announceTrain(
        train as any,
        {
          ...(globalConfig || {}),
          ...(displayedConfig || {}),
        }
      );
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
          }
    );
    setEditingStopsText((train?.stops || []).join("\n"));
  };

  const saveTrain = async () => {
    if (!editingTrain || !displayedStation) return;
    try {
      setTrainSaving(true);
      const stops = editingStopsText
        .split(/[\r\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
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
      setEditingStopsText("");
      await load();
    } catch (err: any) {
      setError(err?.message || "No se pudo guardar el tren");
    } finally {
      setTrainSaving(false);
    }
  };

  const modalPlatformOptions = editingTrain?.platform && !displayPlatformOptions.includes(editingTrain.platform)
    ? [...displayPlatformOptions, editingTrain.platform]
    : displayPlatformOptions;
  const modalSectorOptions = editingTrain?.sector && !displaySectorOptions.includes(editingTrain.sector)
    ? [...displaySectorOptions, editingTrain.sector]
    : displaySectorOptions;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Cargando display...</p>
        </div>
      </div>
    );
  }

  if (error && !displays.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-6">
        <div className="max-w-3xl mx-auto bg-white/5 border border-white/10 rounded-xl p-6">
          <p className="text-red-300 font-semibold">{error}</p>
          <button onClick={load} className="mt-4 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (displayMode === "multiple" && !displayedStation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Displays</h1>
              <p className="text-slate-400">Modo múltiple activo. Selecciona una estación para configurar su pantalla.</p>
            </div>
            <Link to="/admin" className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10">
              ← Volver al admin
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displays.map((display) => (
              <Link
                key={display.station.id}
                to={`/admin/displays/${display.station.id}`}
                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-amber-400/60 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-white">{display.station.short || display.station.name}</h2>
                    <p className="text-sm text-slate-400">{display.station.name}</p>
                  </div>
                  {display.station.logo_url && (
                    <img src={fileUrl(display.station.logo_url)!} alt={display.station.name} className="w-10 h-10 object-contain" />
                  )}
                </div>
                <div className="mt-4 text-sm text-slate-300">
                  <div>{display.trains.length} trenes</div>
                  <div className="text-slate-500">Modo: {display.config.mode || "departures"}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!displayedStation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white p-6">
        <div className="max-w-3xl mx-auto bg-white/5 border border-white/10 rounded-xl p-6">
          <p className="text-slate-300">No hay displays configurados.</p>
          <Link to="/admin" className="inline-block mt-4 px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10">
            ← Volver al admin
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {displayedStation.logo_url && (
                <img src={fileUrl(displayedStation.logo_url)!} alt={displayedStation.name} className="w-10 h-10 object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <p className="text-xs text-slate-400">ID {displayedStation.id}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/admin/displays" className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10">
              ← Lista de displays
            </Link>
            <Link to="/admin" className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10">
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-81px)] max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4 overflow-hidden flex flex-col">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { id: "config", label: "Configuración" },
              { id: "platforms", label: "Vías y sectores" },
              { id: "style", label: "Estilo y reloj" },
              { id: "trains", label: "Trenes" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-amber-500 text-black"
                    : "bg-transparent text-slate-300 hover:bg-white/10"
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
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold">Configuración del display</h2>
                <p className="text-sm text-slate-400">La configuración se guarda de forma independiente para esta estación.</p>
                <p className="text-xs text-amber-300 mt-1">
                  Modo global: {displayMode === "single" ? "solo un display" : "múltiples displays"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  to={`/display/${displayedStation.id}`}
                  target="_blank"
                  className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10"
                >
                  Ver display
                </Link>
                <button
                  onClick={save}
                  disabled={saving || busy}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Nombre de la estación</label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                  value={stationNameDraft}
                  onChange={(e) => setStationNameDraft(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-slate-400">Este es el unico nombre del display y se sincroniza con la base de datos.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Modo</label>
                <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={displayedConfig?.mode || "departures"} onChange={(e) => update({ mode: e.target.value as Config["mode"] })}>
                  <option value="departures">Salidas</option>
                  <option value="arrivals">Llegadas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Región / ciudad</label>
                <select
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
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
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Idiomas</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {displayedLanguages.map((language) => (
                    <span key={language} className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-300/30 px-3 py-1 text-xs font-semibold text-amber-200">
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
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition ${active ? "border-amber-400/60 bg-amber-400/10 text-white" : "border-white/10 bg-black/30 text-slate-300 hover:bg-white/5"}`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => toggleDisplayLanguage(language, e.target.checked)}
                        />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-400 mt-2">El primer idioma es el principal. Los anuncios y las voces pueden usar cualquiera de los idiomas seleccionados.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Logo URL</label>
                <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={displayedConfig?.logo_url || ""} onChange={(e) => update({ logo_url: e.target.value })} />
              </div>
            </div>
          </div>
          </section>
          )}

          {activeTab === "platforms" && (
            <section className="space-y-4 h-full overflow-y-auto pr-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold mb-4">Vías y sectores</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vía mínima</label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                  value={displayedConfig?.platformMin || "1"}
                  onChange={(e) => update({ platformMin: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Vía máxima</label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                  value={displayedConfig?.platformMax || "8"}
                  onChange={(e) => update({ platformMax: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-200 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={displayedConfig?.platformAllowEmpty !== false}
                  onChange={(e) => update({ platformAllowEmpty: e.target.checked })}
                />
                Permitir sin vía
              </label>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Sector mínimo</label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                  value={displayedConfig?.sectorMin || "A"}
                  onChange={(e) => update({ sectorMin: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Sector máximo</label>
                <input
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white"
                  value={displayedConfig?.sectorMax || "D"}
                  onChange={(e) => update({ sectorMax: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-200 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={displayedConfig?.sectorAllowEmpty !== false}
                  onChange={(e) => update({ sectorAllowEmpty: e.target.checked })}
                />
                Permitir sin sector
              </label>
            </div>
          </div>
          </section>
          )}

          {activeTab === "style" && (
            <section className="space-y-4 h-full overflow-y-auto pr-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-lg font-bold mb-4">Estilo y reloj</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Fondo</label>
                <input type="color" className="w-full bg-black/40 rounded-lg px-2 py-1 h-10" value={displayedConfig?.bgColor || "#050a14"} onChange={(e) => update({ bgColor: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Cabecera</label>
                <input type="color" className="w-full bg-black/40 rounded-lg px-2 py-1 h-10" value={displayedConfig?.headerBgColor || "#BFEFD5"} onChange={(e) => update({ headerBgColor: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Texto cabecera</label>
                <input type="color" className="w-full bg-black/40 rounded-lg px-2 py-1 h-10" value={displayedConfig?.headerTextColor || "#102341"} onChange={(e) => update({ headerTextColor: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Fila principal</label>
                <input type="color" className="w-full bg-black/40 rounded-lg px-2 py-1 h-10" value={displayedConfig?.rowBgColor || "#1A3254"} onChange={(e) => update({ rowBgColor: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Fila alterna</label>
                <input type="color" className="w-full bg-black/40 rounded-lg px-2 py-1 h-10" value={displayedConfig?.altBgColor || "#102341"} onChange={(e) => update({ altBgColor: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Reloj</label>
                <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={displayedConfig?.clockMode || "real"} onChange={(e) => update({ clockMode: e.target.value as Config["clockMode"] })}>
                  <option value="real">Sistema</option>
                  <option value="fake">Ficticio</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Hora ficticia</label>
                <input type="time" step="1" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={displayedConfig?.clockFakeTime || "12:00:00"} onChange={(e) => update({ clockFakeTime: e.target.value })} disabled={(displayedConfig?.clockMode || "real") !== "fake"} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Avance</label>
                <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={displayedConfig?.clockFakeStepSeconds || "1"} onChange={(e) => update({ clockFakeStepSeconds: e.target.value })} disabled={(displayedConfig?.clockMode || "real") !== "fake"}>
                  {["1", "2", "5", "10", "15"].map((seconds) => (
                    <option key={seconds} value={seconds}>{seconds}s / segundo</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Pie</label>
                <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={displayedConfig?.footerText || ""} onChange={(e) => update({ footerText: e.target.value })} />
              </div>
            </div>
          </div>
          </section>
          )}

          {activeTab === "trains" && (
            <section className="space-y-4 h-full overflow-hidden">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5 h-full flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold">Trenes del display</h3>
                <p className="text-sm text-slate-400">{trains.length} trenes asociados</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button onClick={() => openTrainEditor()} disabled={busy || trainSaving} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-60">
                  Añadir tren
                </button>
                <button onClick={generateTrain} disabled={busy} className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-60">
                  Generar
                </button>
                <button onClick={exportTrains} disabled={busy} className="px-4 py-2 rounded-lg border border-white/10 text-slate-200 hover:bg-white/10 font-semibold disabled:opacity-60">
                  Exportar trenes
                </button>
                <button onClick={clearTrains} disabled={busy} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-60">
                  Vaciar
                </button>
              </div>
            </div>

            {trains.length === 0 ? (
              <div className="text-slate-400 text-sm py-4">No hay trenes para este display.</div>
            ) : (
              <div className="overflow-auto rounded-xl border border-white/10 flex-1 min-h-0">
                <table className="w-full text-[13px]">
                  <thead className="bg-black/30 border-b border-white/10 sticky top-0 z-10">
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="text-left py-3 px-3">Hora</th>
                      <th className="text-left py-3 px-3">Número</th>
                      <th className="text-left py-3 px-3">Tipo</th>
                      <th className="text-left py-3 px-3">Operador</th>
                      <th className="text-left py-3 px-3">Destino</th>
                      <th className="text-left py-3 px-3">Vía</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {trains.map((train) => (
                      <tr key={train.id} className="hover:bg-white/5 transition">
                        <td className="py-2 px-3 font-mono text-slate-200 whitespace-nowrap align-top">
                          <div className="font-semibold">{train.scheduled_time}</div>
                          {train.expected_time !== train.scheduled_time && (
                            <div className="text-xs text-green-300">Est. {train.expected_time}</div>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-1 rounded text-[11px] font-semibold ${train.status === "Departed" ? "bg-green-900/50 text-green-200" :
                                train.status === "Boarding" ? "bg-amber-900/50 text-amber-200" :
                                  train.status === "Delayed" ? "bg-red-900/50 text-red-200" :
                                    train.status === "Cancelled" ? "bg-gray-900/50 text-gray-200" :
                                      "bg-slate-900/50 text-slate-200"
                              }`}>
                              {train.status}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <button
                                onClick={() => openTrainEditor(train)}
                                disabled={busy || trainSaving}
                                className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-semibold disabled:opacity-60"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => announceRow(train)}
                                disabled={announcingId === train.id}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold disabled:opacity-60"
                              >
                                {announcingId === train.id ? "Anunciando..." : "🔊"}
                              </button>
                              <button
                                onClick={() => deleteTrain(train.id)}
                                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-semibold text-white"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-amber-300 font-semibold whitespace-nowrap">
                          {train.number}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {train.type_color ? (
                              <span
                                className="inline-flex min-w-14 items-center justify-center rounded px-2 py-1 text-[11px] font-bold text-white"
                                style={{ backgroundColor: train.type_color }}
                              >
                                {train.type_code || "—"}
                              </span>
                            ) : (
                              <span className="text-white">{train.type_code || "—"}</span>
                            )}
                            <span className="text-[11px] text-slate-400 truncate max-w-[10rem]">
                              {train.type_name || ""}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-slate-200 whitespace-nowrap">
                          {train.operator_name || "—"}
                        </td>
                        <td className="py-2 px-3 text-white min-w-[14rem]">
                          <div className="font-semibold truncate">{train.destination}</div>
                          {train.stops?.length ? (
                            <div className="text-xs text-slate-400 truncate">{train.stops.join(" · ")}</div>
                          ) : (
                            <div className="text-xs text-slate-500">Sin paradas intermedias</div>
                          )}
                          {train.observations && (
                            <div className="text-xs text-emerald-300 truncate">{train.observations}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="bg-blue-900/50 text-blue-200 px-2 py-1 rounded text-xs font-semibold">
                            {formatPlatform(train)}
                          </span>
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
        </div>
      </main>

      {editingTrain && (
        <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !trainSaving && setEditingTrain(null)}>
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 bg-white/5">
              <div>
                <h3 className="text-xl font-bold">{editingTrain.id ? "Editar tren" : "Añadir tren"}</h3>
                <p className="text-xs text-slate-400">{displayedStation.short || displayedStation.name}</p>
              </div>
              <button
                onClick={() => setEditingTrain(null)}
                className="w-9 h-9 rounded-full border border-white/10 text-slate-300 hover:bg-white/10"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Número</div>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.number || ""} onChange={(e) => setEditingTrain({ ...editingTrain, number: e.target.value })} />
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Estado</div>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.status || "Scheduled"} onChange={(e) => setEditingTrain({ ...editingTrain, status: e.target.value as Train["status"] })}>
                    <option value="Scheduled">Programado</option>
                    <option value="Boarding">Embarque</option>
                    <option value="Delayed">Retrasado</option>
                    <option value="Departed">Salido</option>
                    <option value="Arrived">Llegado</option>
                    <option value="Cancelled">Cancelado</option>
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Operador</div>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.operator_id ?? ""} onChange={(e) => setEditingTrain({ ...editingTrain, operator_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>{op.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Tipo</div>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.train_type_id ?? ""} onChange={(e) => setEditingTrain({ ...editingTrain, train_type_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {trainTypes.map((type) => (
                      <option key={type.id} value={type.id}>{type.code} — {type.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Origen</div>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.origin || ""} onChange={(e) => setEditingTrain({ ...editingTrain, origin: e.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Destino</div>
                  <input className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.destination || ""} onChange={(e) => setEditingTrain({ ...editingTrain, destination: e.target.value })} />
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Hora programada</div>
                  <input type="time" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.scheduled_time || "12:00"} onChange={(e) => setEditingTrain({ ...editingTrain, scheduled_time: e.target.value })} />
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Hora estimada</div>
                  <input type="time" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.expected_time || "12:00"} onChange={(e) => setEditingTrain({ ...editingTrain, expected_time: e.target.value })} />
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Vía</div>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.platform && editingTrain.platform !== "-" ? editingTrain.platform : ""} onChange={(e) => setEditingTrain({ ...editingTrain, platform: e.target.value })}>
                    {modalPlatformOptions.map((platform) => (
                      <option key={platform || "empty"} value={platform}>
                        {platform ? `Vía ${platform}` : "— Sin vía —"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Sector</div>
                  <select className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" value={editingTrain.sector && editingTrain.sector !== "-" ? editingTrain.sector : ""} onChange={(e) => setEditingTrain({ ...editingTrain, sector: e.target.value })}>
                    {modalSectorOptions.map((sector) => (
                      <option key={sector || "empty"} value={sector}>
                        {sector ? `Sector ${sector}` : "— Sin sector —"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Observaciones</div>
                  <textarea className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white min-h-24 resize-y" value={editingTrain.observations || ""} onChange={(e) => setEditingTrain({ ...editingTrain, observations: e.target.value })} />
                </label>
                <label className="block md:col-span-2">
                  <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Paradas intermedias</div>
                  <textarea
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white min-h-24 resize-y"
                    placeholder="Una parada por línea. Usa ';' para separar en la misma línea."
                    value={editingStopsText}
                    onChange={(e) => setEditingStopsText(e.target.value)}
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5">
                <button onClick={() => setEditingTrain(null)} disabled={trainSaving} className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 disabled:opacity-60">
                  Cancelar
                </button>
                <button onClick={saveTrain} disabled={trainSaving} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold disabled:opacity-60">
                  {trainSaving ? "Guardando..." : "Guardar tren"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
