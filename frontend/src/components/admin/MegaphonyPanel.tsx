import { useEffect, useState, useCallback, useRef } from "react";
import { api, fileUrl, connectWS, type Train, type Operator, type TrainType, type Station, type AudioAsset, type SoundRule, type SoundProfile } from "../../lib/api";
import { Volume2, Music, Settings, Play, List, Clock, History, Upload, Trash2, Plus, Mic, Speaker, Square, Ear } from "lucide-react";

type TabType = "dashboard" | "queue" | "history" | "audio" | "rules" | "profiles" | "test" | "locales";

const EVENT_TYPES = [
  "TRAIN_ANNOUNCEMENT", "COMPACT_SERVICE_ANNOUNCEMENT",
  "TRAIN_APPROACHING", "TRAIN_ARRIVING", "TRAIN_AT_PLATFORM", "TRAIN_STANDING_BY",
  "TRAIN_READY_FOR_BOARDING", "TRAIN_BOARDING", "TRAIN_READY_TO_DEPART",
  "TRAIN_IMMINENT_DEPARTURE", "TRAIN_DEPARTING", "TRAIN_DEPARTED",
  "PLATFORM_CHANGE", "TRAIN_DELAYED", "TRAIN_CANCELLED",
  "TRAIN_TERMINATES_HERE", "SERVICE_DISRUPTION", "GENERAL_INFORMATION",
  "LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT", "LONG_DISTANCE_BOARDING",
  "LONG_DISTANCE_READY_TO_DEPART", "LONG_DISTANCE_IMMINENT_DEPARTURE",
];

const LANGUAGES = ["ca", "es", "en", "va", "eu", "gl"];

const LANG_LABELS: Record<string, string> = {
  ca: "Català", es: "Español", en: "English", va: "Valencià", eu: "Euskera", gl: "Galego",
};

export default function MegaphonyPanel({ operators, trainTypes, trains, stations }: {
  operators: Operator[]; trainTypes: TrainType[]; trains: Train[]; stations: Station[];
}) {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [config, setConfig] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [soundRules, setSoundRules] = useState<SoundRule[]>([]);
  const [soundProfiles, setSoundProfiles] = useState<SoundProfile[]>([]);
  const [eventLog, setEventLog] = useState<any[]>([]);
  const [availableLocales, setAvailableLocales] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);
  const [nowPlaying, setNowPlaying] = useState<any>(null);

  // WebSocket auto-refresh
  useEffect(() => {
    const ws = connectWS(() => {});
    const unsub = ws.on("announcement_ready", () => { refresh(); });
    return () => { unsub(); ws.close(); };
  }, []);

  // Test form state
  const [testEventType, setTestEventType] = useState("TRAIN_ANNOUNCEMENT");
  const [testLanguages, setTestLanguages] = useState(["ca", "es", "en"]);
  const [testTrainId, setTestTrainId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testStationId, setTestStationId] = useState<number | null>(null);

  // Rule editor state
  const [editingRule, setEditingRule] = useState<Partial<SoundRule> | null>(null);

  // Audio upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState("CHIME");

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const playAnnouncementTexts = async (texts: Record<string, string>, languages: string[]) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    for (const lang of languages) {
      const text = texts[lang];
      if (!text) continue;
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === "ca" ? "ca-ES" : lang === "es" ? "es-ES" : lang === "en" ? "en-GB" : lang === "va" ? "ca-ES" : lang === "eu" ? "eu-ES" : "gl-ES";
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, q, h, audio, rules, profiles, events, locales] = await Promise.all([
        api.getAnnouncementConfig().catch(() => null),
        api.getAnnouncementQueue().catch(() => []),
        api.getAnnouncementHistory().catch(() => []),
        api.listAudioAssets().catch(() => []),
        api.listSoundRules().catch(() => []),
        api.listSoundProfiles().catch(() => []),
        api.getAnnouncementEvents().catch(() => []),
        api.getAvailableLocales().catch(() => []),
      ]);
      if (cfg) setConfig(cfg);
      setQueue(q);
      setHistory(h);
      setAudioAssets(audio);
      setSoundRules(rules);
      setSoundProfiles(profiles);
      setEventLog(events);
      setAvailableLocales(locales);
    } catch (err: any) {
      notify("error", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleTest = async () => {
    const trainData = testTrainId
      ? trains.find((t) => t.id === testTrainId)
      : {
          number: "TEST 001",
          type_code: "C",
          type_name: "Cercanías",
          operator_name: "Renfe",
          destination: "Mataró",
          platform: "1",
          sector: "A",
          line: "R1",
          status: "Scheduled",
          stops: ["Sant Adrià", "Badalona", "Montgat"],
          accessible: true,
        };
    if (!trainData) { notify("error", "Selecciona un tren existente o usa datos de ejemplo"); return; }
    try {
      const result = await api.testAnnouncement({
        train: trainData,
        eventType: testEventType,
        languages: testLanguages,
      });
      setTestResult(result);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleTrigger = async () => {
    const trainData = testTrainId
      ? trains.find((t) => t.id === testTrainId)
      : {
          number: "TEST 001",
          type_code: "C",
          type_name: "Cercanías",
          operator_name: "Renfe",
          destination: "Mataró",
          platform: "1",
          sector: "A",
          line: "R1",
        };
    if (!trainData) { notify("error", "Train data required"); return; }
    try {
      const result = await api.triggerAnnouncementEvent({
        train: trainData,
        eventType: testEventType,
        stationId: testStationId,
        languages: testLanguages,
      });
      notify("success", `Anuncio encolado (id: ${result.queueId})`);
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) { notify("error", "Selecciona un archivo"); return; }
    try {
      const result = await api.uploadAudioAsset(uploadFile, uploadName || uploadFile.name, uploadType);
      notify("success", `Audio subido: ${result.name}`);
      setUploadFile(null);
      setUploadName("");
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleDeleteAudio = async (id: number) => {
    if (!confirm("¿Eliminar este audio?")) return;
    try {
      await api.deleteAudioAsset(id);
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;
    try {
      if ((editingRule as any).id) {
        await api.updateSoundRule((editingRule as any).id, editingRule);
      } else {
        await api.createSoundRule(editingRule);
      }
      notify("success", "Regla guardada");
      setEditingRule(null);
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    try { await api.deleteSoundRule(id); refresh(); } catch (err: any) { notify("error", err.message); }
  };

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "dashboard", label: "Estado", icon: Volume2 },
    { id: "queue", label: "Cola", icon: List },
    { id: "history", label: "Historial", icon: History },
    { id: "test", label: "Simulador", icon: Play },
    { id: "audio", label: "Biblioteca", icon: Music },
    { id: "rules", label: "Reglas sonido", icon: Settings },
    { id: "profiles", label: "Perfiles", icon: Speaker },
  ];

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
          <Volume2 className="text-blue-900" size={24} />
          Megafonía
        </h2>
        <div className="flex gap-2 items-center text-xs text-slate-500">
          {nowPlaying && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full animate-pulse">
              <Ear size={14} />
              {nowPlaying.eventType}
              <button onClick={() => { window.speechSynthesis.cancel(); setNowPlaying(null); }}
                className="ml-1 p-0.5 hover:bg-emerald-200 rounded" title="Detener">
                <Square size={12} />
              </button>
            </span>
          )}
          {config && (
            <span className="px-2 py-1 bg-slate-100 rounded">
              {config.stats?.pending || 0} pendientes · {config.stats?.completed || 0} completados
            </span>
          )}
          <button onClick={refresh} className="px-3 py-1 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
            {loading ? "..." : "Actualizar"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id ? "bg-blue-50 text-blue-900" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard - Estado */}
      {activeTab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 col-span-1">
              {nowPlaying ? (
                <div>
                  <div className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
                    <Ear size={12} className="animate-pulse" /> Reproduciendo
                  </div>
                  <div className="text-sm font-medium text-slate-800">{nowPlaying.eventType}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {nowPlaying.languages?.join(", ")}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-slate-400 font-medium mb-1">Estado</div>
                  <div className="text-sm text-slate-500">En espera</div>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Locales disponibles</div>
              <div className="text-2xl font-bold text-slate-800">{availableLocales.length}</div>
              <div className="text-xs text-slate-400 mt-1">{availableLocales.join(", ") || "ninguno"}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Eventos disponibles</div>
              <div className="text-2xl font-bold text-slate-800">{EVENT_TYPES.length}</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm text-slate-500 mb-1">Assets de audio</div>
              <div className="text-2xl font-bold text-slate-800">{audioAssets.length}</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <Clock size={16} /> Últimos eventos
            </h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {eventLog.slice(0, 20).map((evt: any) => (
                <div key={evt.id} className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded text-sm">
                  <span className="font-medium text-slate-700">{evt.event_type}</span>
                  <span className="text-xs text-slate-400">{new Date(evt.created_at).toLocaleString()}</span>
                </div>
              ))}
              {eventLog.length === 0 && <p className="text-sm text-slate-400">Sin eventos registrados</p>}
            </div>
          </div>
        </div>
      )}

      {/* Queue - Cola */}
      {activeTab === "queue" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">Cola de anuncios</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Evento</th>
                  <th className="text-left px-4 py-2 font-medium">Prioridad</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                  <th className="text-left px-4 py-2 font-medium">Idiomas</th>
                  <th className="text-left px-4 py-2 font-medium">Creado</th>
                  <th className="text-left px-4 py-2 font-medium">Audio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item: any) => {
                  const texts = (() => { try { return JSON.parse(item.composed_data || "{}"); } catch { return {}; } })();
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{item.event_type}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          item.priority === "EMERGENCY" ? "bg-red-100 text-red-700" :
                          item.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                          item.priority === "LOW" ? "bg-slate-100 text-slate-500" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === "COMPLETED" || item.status === "PLAYING_ANNOUNCEMENT" ? "bg-green-100 text-green-700" :
                          item.status === "FAILED" || item.status === "CANCELLED" ? "bg-red-100 text-red-700" :
                          item.status === "PLAYING_SOUND" ? "bg-blue-100 text-blue-700" :
                          item.status === "READY" ? "bg-emerald-100 text-emerald-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{(() => { try { return JSON.parse(item.languages || "[]").join(", "); } catch { return ""; } })()}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => { setNowPlaying({ eventType: item.event_type, languages: JSON.parse(item.languages || "[]"), texts }); playAnnouncementTexts(texts, JSON.parse(item.languages || "[]")); }}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Reproducir">
                          <Play size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {queue.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Cola vacía</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History - Historial */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">Historial de anuncios</div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Evento</th>
                  <th className="text-left px-4 py-2 font-medium">Prioridad</th>
                  <th className="text-left px-4 py-2 font-medium">Idiomas</th>
                  <th className="text-left px-4 py-2 font-medium">Contenido</th>
                  <th className="text-left px-4 py-2 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium">Audio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item: any) => {
                  const texts = (() => { try { return JSON.parse(item.composed_data || "{}"); } catch { return {}; } })();
                  const langs = (() => { try { return JSON.parse(item.languages || "[]"); } catch { return []; } })();
                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{item.event_type}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          item.priority === "EMERGENCY" ? "bg-red-100 text-red-700" :
                          item.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>{item.priority}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{langs.join(", ")}</td>
                      <td className="px-4 py-2 text-xs text-slate-500 max-w-[300px] truncate">
                        {langs.map((l: string) => texts[l]).filter(Boolean).join(" | ")}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => { setNowPlaying({ eventType: item.event_type, languages: langs, texts }); playAnnouncementTexts(texts, langs); }}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Reproducir">
                          <Play size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {history.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin historial</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test - Simulador */}
      {activeTab === "test" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Probar anuncio</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Evento</label>
                <select value={testEventType} onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {EVENT_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Estación</label>
                <select value={testStationId || ""} onChange={(e) => setTestStationId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin estación</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tren (opcional, usa datos de ejemplo si no seleccionas)</label>
                <select value={testTrainId || ""} onChange={(e) => setTestTrainId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Usar datos de ejemplo</option>
                  {trains.map((t) => <option key={t.id} value={t.id}>{t.number} → {t.destination}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Idiomas</label>
                <div className="flex gap-2 flex-wrap">
                  {LANGUAGES.map((lang) => (
                    <label key={lang} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={testLanguages.includes(lang)}
                        onChange={() => setTestLanguages((prev) =>
                          prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                        )}
                        className="rounded border-slate-300" />
                      {LANG_LABELS[lang]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={handleTest}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
                  <Play size={15} /> Previsualizar texto
                </button>
                <button onClick={handleTrigger}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Mic size={15} /> Encolar anuncio
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Resultado</h3>
            {testResult ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">Evento: {testResult.eventType}</div>
                {testResult.chime && (
                  <div className="bg-slate-50 rounded-lg p-3 text-xs">
                    <span className="font-medium text-slate-600">Chime:</span>{' '}
                    {testResult.chime.assetPath ? (
                      <span className="text-emerald-600">✓ {testResult.chime.assetPath}</span>
                    ) : (
                      <span className="text-slate-400">Ninguno (predeterminado)</span>
                    )}
                    {testResult.ruleApplied && (
                      <div className="mt-1 text-slate-400">Regla: {JSON.stringify(testResult.ruleApplied)}</div>
                    )}
                  </div>
                )}
                {Object.entries(testResult.composed || {}).map(([lang, text]) => (
                  <div key={lang} className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs font-bold text-slate-600 uppercase mb-1">{LANG_LABELS[lang] || lang}</div>
                    <div className="text-sm text-slate-800">{text as string}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">Configura los parámetros y presiona "Previsualizar texto"</p>
            )}
          </div>
        </div>
      )}

      {/* Audio - Biblioteca */}
      {activeTab === "audio" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Subir audio</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Archivo (MP3, OGG, WAV)</label>
                <input type="file" accept=".mp3,.ogg,.wav,.opus" onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Nombre del asset" className="border border-slate-200 rounded-lg px-3 py-2 text-sm w-40" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="CHIME">Chime</option>
                  <option value="GONG">Gong</option>
                  <option value="ATTENTION_TONE">Tono de atención</option>
                  <option value="JINGLE">Jingle</option>
                  <option value="PRERECORDED_ANNOUNCEMENT">Anuncio pregrabado</option>
                  <option value="VOICE_FRAGMENT">Fragmento de voz</option>
                  <option value="CUSTOM">Personalizado</option>
                </select>
              </div>
              <button onClick={handleUpload}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
                <Upload size={15} /> Subir
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 font-semibold text-slate-800">Biblioteca de audio ({audioAssets.length})</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Nombre</th>
                    <th className="text-left px-4 py-2 font-medium">Tipo</th>
                    <th className="text-left px-4 py-2 font-medium">Formato</th>
                    <th className="text-left px-4 py-2 font-medium">Duración</th>
                    <th className="text-left px-4 py-2 font-medium">Estado</th>
                    <th className="text-left px-4 py-2 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {audioAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium text-slate-700">{asset.name}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          {asset.asset_type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{asset.format}</td>
                      <td className="px-4 py-2 text-slate-500">
                        {asset.duration_ms ? `${(asset.duration_ms / 1000).toFixed(1)}s` : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1 text-xs ${asset.enabled ? "text-green-600" : "text-slate-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${asset.enabled ? "bg-green-500" : "bg-slate-300"}`} />
                          {asset.enabled ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-1">
                          <button onClick={() => { const url = fileUrl(asset.file_path); if (url) new Audio(url).play(); }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Reproducir">
                            <Play size={14} />
                          </button>
                          <button onClick={() => handleDeleteAudio(asset.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {audioAssets.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin assets de audio. Sube tu primer archivo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rules - Reglas de sonido */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="font-semibold text-slate-800 mb-4">
              {editingRule ? (editingRule.id ? "Editar regla" : "Nueva regla") : "Reglas de sonido"}
            </h3>

            {editingRule ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Prioridad (menor = más prioritario)</label>
                    <input type="number" value={editingRule.priority ?? 0}
                      onChange={(e) => setEditingRule({ ...editingRule, priority: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Modo sonido</label>
                    <select value={editingRule.sound_mode || "SINGLE"}
                      onChange={(e) => setEditingRule({ ...editingRule, sound_mode: e.target.value as any })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="SINGLE">Single (un sonido)</option>
                      <option value="PER_LANGUAGE">Por idioma</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Match config (JSON)</label>
                  <textarea value={typeof editingRule.match_config === "string" ? editingRule.match_config : JSON.stringify(editingRule.match_config || {}, null, 2)}
                    onChange={(e) => setEditingRule({ ...editingRule, match_config: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" rows={4} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Asset de audio</label>
                    <select value={editingRule.sound_id || ""}
                      onChange={(e) => setEditingRule({ ...editingRule, sound_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Ninguno (voz directa)</option>
                      {audioAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de evento (opcional)</label>
                    <select value={editingRule.event_type || ""}
                      onChange={(e) => setEditingRule({ ...editingRule, event_type: e.target.value || undefined })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Todos los eventos</option>
                      {EVENT_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Delay post-sonido (ms)</label>
                    <input type="number" value={editingRule.delay_after_sound_ms ?? 600}
                      onChange={(e) => setEditingRule({ ...editingRule, delay_after_sound_ms: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Delay entre idiomas (ms)</label>
                    <input type="number" value={editingRule.delay_between_languages_ms ?? 1000}
                      onChange={(e) => setEditingRule({ ...editingRule, delay_between_languages_ms: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Activo</label>
                    <select value={editingRule.enabled ?? 1}
                      onChange={(e) => setEditingRule({ ...editingRule, enabled: Number(e.target.value) })}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      <option value={1}>Sí</option>
                      <option value={0}>No</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveRule}
                    className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">Guardar</button>
                  <button onClick={() => setEditingRule(null)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <button onClick={() => setEditingRule({ priority: 0, match_config: "{}", sound_mode: "SINGLE", enabled: 1 })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800 mb-4">
                  <Plus size={15} /> Nueva regla
                </button>
                <div className="space-y-2">
                  {soundRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">P{rule.priority}</span>
                          <span className="text-sm font-medium text-slate-700">{rule.asset_name || "Voz directa"}</span>
                          {rule.event_type && <span className="text-xs text-slate-400">{rule.event_type}</span>}
                          <span className={`text-xs px-1.5 py-0.5 rounded ${rule.sound_mode === "PER_LANGUAGE" ? "bg-purple-100 text-purple-600" : "bg-slate-200 text-slate-600"}`}>
                            {rule.sound_mode}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">{rule.match_config}</div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingRule(rule)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600" title="Editar">
                          <Settings size={14} />
                        </button>
                        <button onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {soundRules.length === 0 && <p className="text-sm text-slate-400">Sin reglas configuradas</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profiles - Perfiles sonoros */}
      {activeTab === "profiles" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Perfiles sonoros</h3>
          <p className="text-sm text-slate-400">Configuración de perfiles sonoros próximamente.</p>
        </div>
      )}
    </div>
  );
}
