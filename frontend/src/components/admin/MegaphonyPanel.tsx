import { useEffect, useState, useCallback, useRef } from "react";
import { api, fileUrl, connectWS, type Train, type Operator, type TrainType, type Station, type AudioAsset, type SoundRule, type SoundProfile } from "../../lib/api";
import { Volume2, Music, Settings, Play, List, Clock, History, Upload, Trash2, Plus, Mic, Speaker, Square, Ear, FileText, Save } from "lucide-react";
import { speakWithFallback, loadVoiceSettings, getVoiceURIForLanguage } from "../../lib/tts";
import { LANGUAGES as I18N_LANGUAGES } from "../../lib/i18n";

type TabType = "dashboard" | "queue" | "history" | "audio" | "rules" | "profiles" | "test" | "templates";

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

const EVENT_LABELS: Record<string, string> = {
  TRAIN_ANNOUNCEMENT: "Anunci de tren",
  COMPACT_SERVICE_ANNOUNCEMENT: "Anunci de servei compacte",
  TRAIN_APPROACHING: "Tren apropant-se",
  TRAIN_ARRIVING: "Tren arribant",
  TRAIN_AT_PLATFORM: "Tren a via",
  TRAIN_STANDING_BY: "Tren preparat",
  TRAIN_READY_FOR_BOARDING: "Preparat per a embarcar",
  TRAIN_BOARDING: "Embarcant",
  TRAIN_READY_TO_DEPART: "Preparat per a eixir",
  TRAIN_IMMINENT_DEPARTURE: "Eixida imminent",
  TRAIN_DEPARTING: "Tren eixint",
  TRAIN_DEPARTED: "Tren eixit",
  PLATFORM_CHANGE: "Canvi de via",
  TRAIN_DELAYED: "Tren amb retard",
  TRAIN_CANCELLED: "Tren cancel·lat",
  TRAIN_TERMINATES_HERE: "Tren finalitza aquí",
  SERVICE_DISRUPTION: "Pertorbació del servei",
  GENERAL_INFORMATION: "Informació general",
  LONG_DISTANCE_DEPARTURE_ANNOUNCEMENT: "Anunci de eixida LL.DD.",
  LONG_DISTANCE_BOARDING: "Embarcament LL.DD.",
  LONG_DISTANCE_READY_TO_DEPART: "LL.DD. preparat per a eixir",
  LONG_DISTANCE_IMMINENT_DEPARTURE: "Eixida imminent LL.DD.",
};

const LANGUAGES = Object.keys(I18N_LANGUAGES);

const LANG_LABELS: Record<string, string> = I18N_LANGUAGES;

const TRAIN_PRESETS: Record<string, any> = {
  "Cercanías R1": {
    number: "C1 456", type_code: "C", type_name: "Cercanías", operator_name: "Renfe",
    destination: "Mataró", origin: "L'Hospitalet de Llobregat", platform: "3", sector: "A", line: "R1",
    status: "Scheduled", stops: ["Barcelona-Passeig de Gràcia", "Sant Adrià de Besòs", "Badalona Pompeu Fabra", "Montgat", "El Masnou", "Ocata"],
    accessible: false, scheduled_time: "14:30",
  },
  "Cercanías R2 Nord": {
    number: "C2 789", type_code: "C", type_name: "Cercanías", operator_name: "Renfe",
    destination: "Granollers Centre", origin: "Barcelona-Plaça de Catalunya", platform: "2", sector: "B", line: "R2",
    status: "Scheduled", stops: ["Barcelona-Clot-Aragó", "Sant Andreu Comtal", "Montcada i Reixac", "Montornès del Vallès"],
    accessible: true, scheduled_time: "15:45",
  },
  "Cercanías R4": {
    number: "C4 312", type_code: "C", type_name: "Cercanías", operator_name: "Renfe",
    destination: "Vic", origin: "Barcelona-Sant Andreu Comtal", platform: "5", sector: "C", line: "R4",
    status: "Scheduled", stops: ["Montcada i Reixac", "Cardedeu", "Llinars del Vallès", "Granollers-Canovelles", "Balenyà", "Seva"],
    accessible: true, scheduled_time: "09:15",
  },
  "Regional R13": {
    number: "MD 876", type_code: "MD", type_name: "Regional Mitjana Distància", operator_name: "Renfe",
    destination: "Lleida Pirineus", origin: "Barcelona-Estació de França", platform: "7", line: "R13",
    status: "Scheduled", stops: ["Vilafranca del Penedès", "Tarragona", "Reus", "Lleida Pirineus"],
    accessible: false, scheduled_time: "16:20", stoppingPattern: "ONLY_STOPS_AT",
  },
  "Regional R14 - Totes les estacions": {
    number: "REG 234", type_code: "REG", type_name: "Regional", operator_name: "Renfe",
    destination: "Tortosa", origin: "Barcelona-Estació de França", platform: "9", line: "R14",
    status: "Scheduled", accessible: false, scheduled_time: "17:10",
    stoppingPattern: "ALL_STATIONS",
    stops: ["Sant Vicenç de Calders", "Vilanova i la Geltrú", "Sitges", "Barcelona-El Prat", "Tarragona", "Salou", "Cambrils", "L'Aldea", "Amposta", "Tortosa"],
  },
  "Regional R11 - Salta Granollers": {
    number: "R 567", type_code: "R", type_name: "Regional", operator_name: "Renfe",
    destination: "Girona", origin: "Barcelona-Passeig de Gràcia", platform: "4", line: "R11",
    status: "Scheduled", accessible: false, scheduled_time: "10:30",
    stoppingPattern: "ALL_EXCEPT", exceptStations: ["Granollers Centre"],
    stops: ["Barcelona-Clot-Aragó", "Sant Andreu Comtal", "Montcada i Reixac", "Cardedeu", "Llinars del Vallès", "Figueres", "Girona"],
  },
  "Avant": {
    number: "AVANT 1456", type_code: "AVANT", type_name: "Avant", operator_name: "Renfe",
    destination: "Figueres-Vilafant", origin: "Barcelona-Sants", platform: "6", sector: "A", line: "",
    status: "Scheduled", stops: ["Girona", "Figueres-Vilafant"], accessible: true, scheduled_time: "12:00",
  },
  "AVE S-103": {
    number: "AVE 3055", type_code: "AVE", type_name: "AVE", operator_name: "Renfe",
    destination: "Madrid Puerta de Atocha", origin: "Barcelona-Sants", platform: "10", sector: "C", line: "",
    status: "Scheduled", accessible: true, scheduled_time: "09:15",
    stops: ["Camp de Tarragona", "Lleida Pirineus", "Zaragoza-Delicias", "Guadalajara"],
    stoppingPattern: "ONLY_STOPS_AT",
  },
  "AVE S-103 Directe": {
    number: "AVE 3056", type_code: "AVE", type_name: "AVE", operator_name: "Renfe",
    destination: "Madrid Puerta de Atocha", origin: "Barcelona-Sants", platform: "10", sector: "C", line: "",
    status: "Scheduled", accessible: true, scheduled_time: "13:00",
    stoppingPattern: "DIRECT",
  },
  "AVE (AVE 1042)": {
    number: "AVE 1042", type_code: "AVE", type_name: "AVE", operator_name: "Renfe",
    destination: "Sevilla Santa Justa", origin: "Barcelona-Sants", platform: "11", sector: "D", line: "",
    status: "Scheduled", accessible: true, scheduled_time: "08:30",
    stops: ["Zaragoza-Delicias", "Ciudad Real", "Puertollano", "Córdoba"],
    stoppingPattern: "ONLY_STOPS_AT",
  },
  "Ouigo": {
    number: "OUIGO 7782", type_code: "OUIGO", type_name: "Ouigo", operator_name: "Ouigo España",
    destination: "Madrid Puerta de Atocha", origin: "Barcelona-Sants", platform: "12", sector: "B", line: "",
    status: "Scheduled", accessible: true, scheduled_time: "07:45",
    stops: ["Zaragoza-Delicias", "Camp de Tarragona"],
    stoppingPattern: "ONLY_STOPS_AT",
  },
  "Alvia": {
    number: "ALVIA 4090", type_code: "ALVIA", type_name: "Alvia", operator_name: "Renfe",
    destination: "Gijón", origin: "Barcelona-Sants", platform: "4", sector: "D", line: "",
    status: "Scheduled", stops: ["Zaragoza-Delicias", "Huesca", "Jaca", "Canfranc", "Pamplona", "Tafalla", "Vitòria-Gasteiz", "Burgos", "León", "Oviedo"],
    accessible: true, scheduled_time: "11:30", stoppingPattern: "ONLY_STOPS_AT",
    fareRestrictions: { commuterTicketsNotAccepted: true, commuterPassesNotAccepted: true, reservationRequired: true },
  },
  "Euromed": {
    number: "EUR 654", type_code: "EUR", type_name: "Euromed", operator_name: "Renfe",
    destination: "València Nord", origin: "Barcelona-Sants", platform: "8", sector: "A", line: "",
    status: "Scheduled", stops: ["Tarragona", "Castelló de la Plana", "València Nord"],
    accessible: true, scheduled_time: "10:00", stoppingPattern: "ONLY_STOPS_AT",
  },
  "Intercity": {
    number: "IC 8723", type_code: "IC", type_name: "Intercity", operator_name: "Renfe",
    destination: "Cádiz", origin: "Barcelona-Sants", platform: "3", line: "",
    status: "Scheduled", stops: ["Zaragoza-Delicias", "Madrid Puerta de Atocha", "Córdoba", "Sevilla", "Jerez"],
    accessible: false, scheduled_time: "06:45", stoppingPattern: "ONLY_STOPS_AT",
  },
  "Trenhotel": {
    number: "TH 1732", type_code: "TH", type_name: "Trenhotel", operator_name: "Renfe",
    destination: "Paris Gare de Lyon", origin: "Barcelona-Sants", platform: "13", line: "",
    status: "Scheduled", stops: ["Figueres", "Perpignan", "Montpeller", "Lió", "Lyon Part-Dieu"],
    accessible: false, scheduled_time: "21:30", stoppingPattern: "ONLY_STOPS_AT",
  },
  "Amb retard": {
    number: "C1 458", type_code: "C", type_name: "Cercanías", operator_name: "Renfe",
    destination: "Mataró", origin: "L'Hospitalet de Llobregat", platform: "1", line: "R1",
    status: "Delayed", delayMinutes: 12, delayReason: "lliscament a Montgat Nord",
    stops: ["Barcelona-Passeig de Gràcia", "Sant Adrià de Besòs", "Badalona"],
    accessible: false, scheduled_time: "19:30",
  },
  "Cancel·lat": {
    number: "R 570", type_code: "R", type_name: "Regional", operator_name: "Renfe",
    destination: "Girona", origin: "Barcelona-Passeig de Gràcia", platform: "2", line: "R11",
    status: "Cancelled", cancelReason: "fallada al sistema de senyals entre Montcada i Cardedeu",
    stops: ["Montcada i Reixac", "Cardedeu", "Llinars del Vallès", "Figueres"],
    accessible: false, scheduled_time: "18:00",
  },
};

export default function MegaphonyPanel({ operators, trainTypes, trains, stations, ttsConfig }: {
  operators: Operator[]; trainTypes: TrainType[]; trains: Train[]; stations: Station[]; ttsConfig?: any;
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
  const [testLanguages, setTestLanguages] = useState(["ca", "va", "es", "en", "eu", "gl"]);
  const [testTrainId, setTestTrainId] = useState<number | null>(null);
  const [testPresetId, setTestPresetId] = useState("Cercanías C1");
  const [testResult, setTestResult] = useState<any>(null);
  const [testStationId, setTestStationId] = useState<number | null>(null);
  const [testAllResults, setTestAllResults] = useState<any[] | null>(null);
  const [testSoundId, setTestSoundId] = useState<number | null>(null);
  const [testLangAudio, setTestLangAudio] = useState<Record<string, number | null>>({});
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const langDropdownRef = useRef<HTMLDivElement>(null);

  // Per-station megaphony language toggles
  const [langConfigStationId, setLangConfigStationId] = useState<number | null>(null);
  const [langConfigLanguages, setLangConfigLanguages] = useState<string[]>([]);
  const [langConfigLoading, setLangConfigLoading] = useState(false);
  const [langConfigSaving, setLangConfigSaving] = useState(false);
  const [langConfigDirty, setLangConfigDirty] = useState(false);

  // Template editor state
  const [templateLang, setTemplateLang] = useState("ca");
  const [templateData, setTemplateData] = useState<any>(null);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [templateSection, setTemplateSection] = useState("events");
  const [templateEventKey, setTemplateEventKey] = useState("TRAIN_ANNOUNCEMENT");
  const [templateVarKey, setTemplateVarKey] = useState("departure");
  const [templateBlockKey, setTemplateBlockKey] = useState("operator");

  // Rule editor state
  const [editingRule, setEditingRule] = useState<Partial<SoundRule> | null>(null);

  // Profile editor state
  const [editingProfile, setEditingProfile] = useState<Partial<SoundProfile> | null>(null);

  // Load template on tab switch
  useEffect(() => {
    if (activeTab === "templates" && !templateData) loadTemplate(templateLang);
  }, [activeTab]);

  // Audio upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState("CHIME");

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const playAudioFile = (assetPath?: string): Promise<void> => {
    if (!assetPath) return Promise.resolve();
    return new Promise((resolve) => {
      const audio = new Audio(fileUrl(assetPath) || assetPath);
      audio.volume = 0.7;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  };

  const getLangAudioMap = (): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const [lang, assetId] of Object.entries(testLangAudio)) {
      if (!assetId) continue;
      const asset = audioAssets.find((a) => a.id === assetId);
      if (asset?.file_path) map[lang] = asset.file_path;
    }
    return map;
  };

  const playAnnouncementTexts = async (texts: Record<string, string>, languages: string[], chimeAssetPath?: string, languageSounds?: Record<string, string>) => {
    if (chimeAssetPath) await playAudioFile(chimeAssetPath);
    for (const lang of languages) {
      const vs = {
        ...loadVoiceSettings(ttsConfig),
        voiceURI: getVoiceURIForLanguage(ttsConfig, lang),
      };
      const langSound = languageSounds?.[lang];
      if (langSound) await playAudioFile(langSound);
      const text = texts[lang];
      if (!text) continue;
      await speakWithFallback(text, lang, vs);
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

  useEffect(() => {
    if (!langDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target as Node)) setLangDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [langDropdownOpen]);

  useEffect(() => {
    if (langConfigStationId == null && stations.length > 0) setLangConfigStationId(stations[0].id);
  }, [stations, langConfigStationId]);

  useEffect(() => {
    if (langConfigStationId == null) return;
    let cancelled = false;
    setLangConfigLoading(true);
    api.getStationAnnouncementConfig(langConfigStationId)
      .then((cfg) => {
        if (cancelled) return;
        const raw = cfg?.languages;
        const parsed = Array.isArray(raw)
          ? raw
          : typeof raw === "string"
            ? (() => { try { return JSON.parse(raw); } catch { return ["ca", "es", "en"]; } })()
            : ["ca", "es", "en"];
        setLangConfigLanguages(parsed);
        setLangConfigDirty(false);
      })
      .catch(() => { if (!cancelled) setLangConfigLanguages(["ca", "es", "en"]); })
      .finally(() => { if (!cancelled) setLangConfigLoading(false); });
    return () => { cancelled = true; };
  }, [langConfigStationId]);

  const toggleLangConfigLanguage = (lang: string) => {
    setLangConfigLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));
    setLangConfigDirty(true);
  };

  const saveLangConfig = async () => {
    if (langConfigStationId == null) return;
    try {
      setLangConfigSaving(true);
      await api.saveStationAnnouncementConfig(langConfigStationId, { languages: langConfigLanguages });
      notify("success", "Idiomas de megafonía guardados");
      setLangConfigDirty(false);
    } catch (err: any) {
      notify("error", err.message);
    } finally {
      setLangConfigSaving(false);
    }
  };

  const getTestTrain = () => {
    if (testTrainId) return trains.find((t) => t.id === testTrainId);
    return TRAIN_PRESETS[testPresetId] || TRAIN_PRESETS["Cercanías R1"];
  };

  const handleTest = async () => {
    const trainData = getTestTrain();
    if (!trainData) { notify("error", "Selecciona un tren existente o usa datos de ejemplo"); return; }
    try {
      const result = await api.testAnnouncement({
        train: trainData,
        eventType: testEventType,
        languages: testLanguages,
        sound_id: testSoundId,
      });
      setTestResult(result);
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  // Auto-preview when simulator params change
  const handleTestRef = useRef(handleTest);
  handleTestRef.current = handleTest;
  const autoPreviewRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activeTab !== "test") return;
    if (autoPreviewRef.current) clearTimeout(autoPreviewRef.current);
    autoPreviewRef.current = setTimeout(() => { handleTestRef.current(); }, 300);
    return () => { if (autoPreviewRef.current) clearTimeout(autoPreviewRef.current); };
  }, [testEventType, testPresetId, testTrainId, testLanguages, testSoundId, testLangAudio, activeTab]);

  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    try {
      if (editingProfile.id) {
        await api.updateSoundProfile(editingProfile.id, editingProfile);
        notify("success", "Perfil actualizado");
      } else {
        await api.createSoundProfile(editingProfile);
        notify("success", "Perfil creado");
      }
      setEditingProfile(null);
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const loadTemplate = async (lang: string, section?: string) => {
    try {
      const data = await api.getLocaleContent(lang);
      setTemplateData(data);
      setTemplateLang(lang);
      setTemplateDirty(false);
      if (section) setTemplateSection(section);
      const events = Object.keys(data.events || {});
      if (events.length > 0) { setTemplateEventKey(events[0]); }
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const saveTemplate = async () => {
    if (!templateData) return;
    try {
      await api.updateLocaleContent(templateLang, templateData);
      setTemplateDirty(false);
      notify("success", "Plantilla guardada");
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleDeleteProfile = async (id: number) => {
    if (!confirm("¿Eliminar este perfil sonoro?")) return;
    try {
      await api.deleteSoundProfile(id);
      notify("success", "Perfil eliminado");
      refresh();
    } catch (err: any) {
      notify("error", err.message);
    }
  };

  const handleTestAll = async () => {
    const trainData = getTestTrain();
    if (!trainData) return;
    const results: any[] = [];
    for (const et of EVENT_TYPES) {
      try {
        const r = await api.testAnnouncement({ train: trainData, eventType: et, languages: testLanguages, sound_id: testSoundId });
        results.push({ eventType: et, result: r });
      } catch { /* skip failed */ }
    }
    setTestAllResults(results);
    setTestResult(null);
    notify("success", `Probados ${results.length} eventos`);
  };

  const handleTrigger = async () => {
    const trainData = getTestTrain();
    if (!trainData) { notify("error", "Train data required"); return; }
    try {
      const result = await api.triggerAnnouncementEvent({
        train: trainData,
        eventType: testEventType,
        stationId: testStationId,
        languages: testLanguages,
      });
      notify("success", `Anuncio encolado #${result.queueId}`);
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
    { id: "templates", label: "Plantilles", icon: FileText },
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
            <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Mic size={16} /> Idiomas de megafonía
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={langConfigStationId ?? ""}
                  onChange={(e) => setLangConfigStationId(e.target.value ? Number(e.target.value) : null)}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs"
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.short || s.name}</option>
                  ))}
                </select>
                {langConfigDirty && (
                  <button
                    onClick={saveLangConfig}
                    disabled={langConfigSaving}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <Save size={12} /> {langConfigSaving ? "Guardant..." : "Guardar"}
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Tria en quins idiomes es generen i reprodueixen els anuncis automàtics de megafonia per a esta estació.
            </p>
            {langConfigLoading ? (
              <p className="text-sm text-slate-400">Carregant...</p>
            ) : stations.length === 0 ? (
              <p className="text-sm text-slate-400">No hi ha estacions configurades.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const active = langConfigLanguages.includes(lang);
                  return (
                    <label
                      key={lang}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition ${
                        active ? "border-blue-200 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleLangConfigLanguage(lang)}
                        className="rounded border-slate-300 accent-blue-900"
                      />
                      {LANG_LABELS[lang] || lang}
                    </label>
                  );
                })}
              </div>
            )}
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
                        <button onClick={() => {
                          const chimeAsset = audioAssets.find((a) => a.id === item.chime_asset_id);
                          setNowPlaying({ eventType: item.event_type, languages: JSON.parse(item.languages || "[]"), texts });
                          playAnnouncementTexts(texts, JSON.parse(item.languages || "[]"), chimeAsset?.file_path);
                        }}
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
                        <button onClick={() => {
                          const chimeAsset = audioAssets.find((a) => a.id === item.chime_asset_id);
                          setNowPlaying({ eventType: item.event_type, languages: langs, texts });
                          playAnnouncementTexts(texts, langs, chimeAsset?.file_path);
                        }}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">Evento</label>
                <select value={testEventType} onChange={(e) => setTestEventType(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {EVENT_TYPES.map((et) => <option key={et} value={et}>{EVENT_LABELS[et] || et}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Estación</label>
                <select value={testStationId || ""} onChange={(e) => setTestStationId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Sin estación</option>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Tren real (si existe en el sistema)</label>
                <select value={testTrainId || ""} onChange={(e) => { setTestTrainId(e.target.value ? Number(e.target.value) : null); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Ninguno (usa perfil de ejemplo)</option>
                  {trains.map((t) => <option key={t.id} value={t.id}>{t.number} → {t.destination}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Perfil de tren de ejemplo</label>
                <select value={testPresetId} onChange={(e) => setTestPresetId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {Object.keys(TRAIN_PRESETS).map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              <div className="relative" ref={langDropdownRef}>
                <label className="block text-xs font-medium text-slate-700 mb-1">Idiomas</label>
                <button type="button" onClick={() => setLangDropdownOpen((p) => !p)}
                  className="w-full flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white hover:border-slate-300 transition">
                  <span className={testLanguages.length === 0 ? "text-slate-400" : "text-slate-800"}>
                    {testLanguages.length === 0
                      ? "Seleccionar idiomas"
                      : testLanguages.map((l) => LANG_LABELS[l] || l).join(", ")}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${langDropdownOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {langDropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                      <label key={lang} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={testLanguages.includes(lang)}
                          onChange={() => {
                            setTestLanguages((prev) => prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]);
                          }}
                          className="rounded border-slate-300 accent-blue-900" />
                        <span className="font-medium text-slate-700">{lang.toUpperCase()}</span>
                        <span className="text-slate-400">{LANG_LABELS[lang]}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 bg-white">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Audio por idioma</span>
                  <span className="text-xs text-slate-400 ml-2">(vacío = voz TTS)</span>
                </div>
                {testLanguages.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-slate-400 text-center">Selecciona idiomas arriba</div>
                ) : (
                  <div className="divide-y divide-slate-200">
                    {testLanguages.map((lang) => (
                      <div key={lang} className="flex items-center gap-3 px-3 py-2 bg-white">
                        <span className="text-xs font-bold uppercase text-slate-400 w-5 shrink-0">{lang}</span>
                        <select
                          value={testLangAudio[lang] ?? ""}
                          onChange={(e) => setTestLangAudio((prev) => ({ ...prev, [lang]: e.target.value ? Number(e.target.value) : null }))}
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white">
                          <option value="">Voz TTS</option>
                          {audioAssets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.asset_type})</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Chime / jingle general (opcional)</label>
                <select value={testSoundId ?? ""} onChange={(e) => setTestSoundId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Ninguno</option>
                  {audioAssets.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.asset_type})</option>)}
                </select>
              </div>

              <div className="flex gap-2 pt-2 flex-wrap">
                <button onClick={handleTest}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
                  <Play size={15} /> Previsualizar texto
                </button>
                <button onClick={handleTestAll}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                  <List size={15} /> Probar todos los eventos
                </button>
                <button onClick={handleTrigger}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                  <Mic size={15} /> Encolar anuncio
                </button>
              </div>
            </div>
          </div>

          {testAllResults ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Todos los eventos ({testAllResults.length})</h3>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    const userLangAudio = getLangAudioMap();
                    for (const { result } of testAllResults) {
                      const texts = result.composed || result;
                      const langs = Object.keys(texts).filter((k) => !["eventType","chime","ruleApplied","queueId","status"].includes(k));
                      const merged = { ...result.chime?.languageSounds, ...userLangAudio };
                      await playAnnouncementTexts(texts, langs, result.chime?.assetPath, Object.keys(merged).length ? merged : undefined);
                    }
                  }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700">
                    <Speaker size={13} /> Reproducir todos
                  </button>
                  <button onClick={() => setTestAllResults(null)}
                    className="text-xs text-slate-400 hover:text-slate-600">Cerrar</button>
                </div>
              </div>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                {testAllResults.map(({ eventType, result }) => {
                  const texts = result.composed || result;
                  const langs = Object.keys(texts).filter((k) => !["eventType","chime","ruleApplied","queueId","status"].includes(k));
                  return (
                    <details key={eventType} className="group bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                      <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-slate-100 transition">
                        {result.chime?.assetPath && (
                          <span className="text-xs text-emerald-600 shrink-0" title={result.chime.assetPath}>♪</span>
                        )}
                        <span className="text-sm font-semibold text-slate-800 flex-1">{EVENT_LABELS[eventType] || eventType.replace(/_/g, " ")}</span>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); const merged = { ...result.chime?.languageSounds, ...getLangAudioMap() }; playAnnouncementTexts(texts, langs, result.chime?.assetPath, Object.keys(merged).length ? merged : undefined); }}
                          className="text-emerald-600 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50" title="Reproducir">
                          <Speaker size={14} />
                        </button>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTestResult(result); setTestAllResults(null); }}
                          className="text-blue-600 hover:text-blue-800 text-xs hover:underline">Ver individual</button>
                        <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                      </summary>
                      <div className="px-4 pb-3 space-y-2 border-t border-slate-200">
                        {langs.map((lang) => (
                          <div key={lang} className="flex gap-3 items-start pt-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 w-6 pt-0.5">{lang}</span>
                            <span className="text-sm text-slate-700 leading-relaxed">{(texts as any)[lang]}</span>
                          </div>
                        ))}
                        {langs.length === 0 && (
                          <p className="text-xs text-slate-400 pt-2">Sin textos generados</p>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Resultado</h3>
                {testResult && (
                  <button onClick={() => {
                    const texts = testResult.composed || testResult;
                    const langs = Object.keys(texts).filter((k) => !["eventType","chime","ruleApplied","queueId","status"].includes(k));
                    const merged = { ...testResult.chime?.languageSounds, ...getLangAudioMap() };
                    playAnnouncementTexts(texts, langs, testResult.chime?.assetPath, Object.keys(merged).length ? merged : undefined);
                  }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs hover:bg-amber-700">
                    <Speaker size={13} /> Reproducir
                  </button>
                )}
              </div>
              {testResult ? (
                <div className="space-y-3">
                  {testResult.eventType && (
                    <div className="text-xs text-slate-500">Evento: {EVENT_LABELS[testResult.eventType] || testResult.eventType}</div>
                  )}
                  {testResult.chime && (
                    <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
                      <div>
                        <span className="font-medium text-slate-600">Chime:</span>{' '}
                        {testResult.chime.assetPath ? (
                          <span className="text-emerald-600">✓ {testResult.chime.assetPath}</span>
                        ) : (
                          <span className="text-slate-400">Ninguno (predeterminado)</span>
                        )}
                      </div>
                      {testResult.chime.languageSounds && Object.keys(testResult.chime.languageSounds).length > 0 && (
                        <div>
                          <span className="font-medium text-slate-600">Per lengua:</span>{' '}
                          {Object.entries(testResult.chime.languageSounds).map(([lang, path]) => (
                            <span key={lang} className="text-emerald-600 mr-2">{lang}: ✓ {path as string}</span>
                          ))}
                        </div>
                      )}
                      {testResult.ruleApplied && (
                        <div className="text-slate-400">Regla: {JSON.stringify(testResult.ruleApplied)}</div>
                      )}
                    </div>
                  )}
                  {(Object.entries(testResult.composed || testResult).filter(([k]) => !["eventType","chime","ruleApplied","queueId","status"].includes(k))).map(([lang, text]) => (
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
          )}
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
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      {editingRule.sound_mode === "PER_LANGUAGE" ? "Asset global (fallback)" : "Asset de audio"}
                    </label>
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
                {editingRule.sound_mode === "PER_LANGUAGE" && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {LANGUAGES.map((lang) => (
                      <div key={lang}>
                        <label className="block text-xs font-medium text-slate-500 mb-1">{LANG_LABELS[lang] || lang}</label>
                        <select value={(editingRule.language_sounds ? (typeof editingRule.language_sounds === "string" ? JSON.parse(editingRule.language_sounds) : editingRule.language_sounds)[lang] : "") || ""}
                          onChange={(e) => {
                            const current = editingRule.language_sounds
                              ? (typeof editingRule.language_sounds === "string" ? JSON.parse(editingRule.language_sounds) : editingRule.language_sounds)
                              : {};
                            setEditingRule({
                              ...editingRule,
                              language_sounds: { ...current, [lang]: e.target.value ? Number(e.target.value) : undefined },
                            });
                          }}
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                          <option value="">Ninguno</option>
                          {audioAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
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

      {/* Templates - Plantilles */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Seccions</h3>
              <div className="flex items-center gap-2">
                <select value={templateLang} onChange={(e) => loadTemplate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs">
                  {availableLocales.map((l) => <option key={l} value={l}>{LANG_LABELS[l] || l}</option>)}
                </select>
              </div>
            </div>
            {templateData && (
              <div className="space-y-1">
                {["events", "blocks", "service_intro", "closing_messages", "attention", "accessibility", "stopping_patterns", "fare_restrictions", "pre_recorded_fragments"].map((section) => {
                  const count = templateData[section] ? Object.keys(templateData[section]).length : 0;
                  return (
                    <button key={section} onClick={() => setTemplateSection(section)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition ${
                        templateSection === section ? "bg-blue-50 text-blue-900 font-medium" : "text-slate-600 hover:bg-slate-50"
                      }`}>
                      <span>{section.replace(/_/g, " ")}</span>
                      <span className="text-xs text-slate-400">{count}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!templateData && <p className="text-sm text-slate-400 py-4">Carregant...</p>}
          </div>

          <div className="lg:col-span-2 space-y-4">
            {templateSection === "events" && templateData && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">Esdeveniments</h3>
                  {templateDirty && (
                    <button onClick={saveTemplate}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                      <Save size={14} /> Guardar
                    </button>
                  )}
                </div>
                <div className="flex gap-3 mb-3">
                  <select value={templateEventKey} onChange={(e) => setTemplateEventKey(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {Object.keys(templateData.events || {}).map((k) => (
                      <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                  <select value={templateVarKey} onChange={(e) => setTemplateVarKey(e.target.value)}
                    className="w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    {Object.keys(templateData.events?.[templateEventKey] || {}).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                {templateData.events?.[templateEventKey] && (
                  <textarea
                    value={templateData.events[templateEventKey][templateVarKey] || ""}
                    onChange={(e) => {
                      const newData = { ...templateData };
                      newData.events[templateEventKey][templateVarKey] = e.target.value;
                      setTemplateData(newData);
                      setTemplateDirty(true);
                    }}
                    className="w-full h-32 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                    spellCheck={false}
                  />
                )}
              </div>
            )}

            {templateSection === "blocks" && templateData && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">Fragments reutilitzables</h3>
                  {templateDirty && (
                    <button onClick={saveTemplate}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                      <Save size={14} /> Guardar
                    </button>
                  )}
                </div>
                <select value={templateBlockKey} onChange={(e) => setTemplateBlockKey(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3">
                  {Object.keys(templateData.blocks || {}).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <textarea
                  value={templateData.blocks?.[templateBlockKey] || ""}
                  onChange={(e) => {
                    const newData = { ...templateData };
                    newData.blocks[templateBlockKey] = e.target.value;
                    setTemplateData(newData);
                    setTemplateDirty(true);
                  }}
                  className="w-full h-20 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                  spellCheck={false}
                />
              </div>
            )}

            {templateSection === "service_intro" && templateData && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">Introducció de servei</h3>
                  {templateDirty && (
                    <button onClick={saveTemplate}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                      <Save size={14} /> Guardar
                    </button>
                  )}
                </div>
                {Object.entries(templateData.service_intro || {}).map(([key, val]) => (
                  <div key={key} className="mb-2">
                    <label className="block text-xs text-slate-500 mb-1">{key}</label>
                    <input value={val as string} onChange={(e) => {
                      const newData = { ...templateData };
                      newData.service_intro[key] = e.target.value;
                      setTemplateData(newData);
                      setTemplateDirty(true);
                    }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
            )}

            {["closing_messages", "attention", "accessibility", "stopping_patterns", "fare_restrictions", "pre_recorded_fragments"].includes(templateSection) && templateData && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">{templateSection.replace(/_/g, " ")}</h3>
                  {templateDirty && (
                    <button onClick={saveTemplate}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
                      <Save size={14} /> Guardar
                    </button>
                  )}
                </div>
                {Object.entries(templateData[templateSection] || {}).map(([key, val]) => (
                  <div key={key} className="mb-2">
                    <label className="block text-xs text-slate-500 mb-1">{key}</label>
                    <input value={val as string} onChange={(e) => {
                      const newData = { ...templateData };
                      newData[templateSection][key] = e.target.value;
                      setTemplateData(newData);
                      setTemplateDirty(true);
                    }}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Profiles - Perfiles sonoros */}
      {activeTab === "profiles" && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Perfiles sonoros</h3>
            <button onClick={() => setEditingProfile({ name: "", sound_volume: 1.0, speech_volume: 1.0, delay_after_sound_ms: 600, enabled: 1 })}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Nuevo perfil
            </button>
          </div>

          {editingProfile && (
            <div className="mb-6 bg-slate-50 rounded-xl p-4 border border-slate-200">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm">
                {editingProfile.id ? `Editar: ${editingProfile.name}` : "Nuevo perfil sonoro"}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                  <input value={editingProfile.name || ""} onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Perfil Renfe LD" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Compañía</label>
                  <input value={editingProfile.company || ""} onChange={(e) => setEditingProfile({ ...editingProfile, company: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Renfe, Ouigo, Iryo..." />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Estación</label>
                  <select value={editingProfile.station_id || ""} onChange={(e) => setEditingProfile({ ...editingProfile, station_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Todas</option>
                    {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Operador</label>
                  <select value={editingProfile.operator_id || ""} onChange={(e) => setEditingProfile({ ...editingProfile, operator_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Todos</option>
                    {operators.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tipo de tren</label>
                  <select value={editingProfile.train_type_id || ""} onChange={(e) => setEditingProfile({ ...editingProfile, train_type_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Todos</option>
                    {trainTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Servicio comercial</label>
                  <input value={editingProfile.commercial_service || ""} onChange={(e) => setEditingProfile({ ...editingProfile, commercial_service: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ej: AVE, Avant..." />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Tipo de servicio</label>
                  <input value={editingProfile.service_type || ""} onChange={(e) => setEditingProfile({ ...editingProfile, service_type: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ej: LARGA_DISTANCIA, MEDIA_DISTANCIA..." />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Sonido por defecto</label>
                  <select value={editingProfile.default_sound_id || ""} onChange={(e) => setEditingProfile({ ...editingProfile, default_sound_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Ninguno</option>
                    {audioAssets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Delay post-sonido (ms)</label>
                  <input type="number" value={editingProfile.delay_after_sound_ms ?? 600} onChange={(e) => setEditingProfile({ ...editingProfile, delay_after_sound_ms: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Volumen sonido (0-1)</label>
                  <input type="number" step="0.1" min="0" max="1" value={editingProfile.sound_volume ?? 1.0} onChange={(e) => setEditingProfile({ ...editingProfile, sound_volume: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Volumen voz (0-1)</label>
                  <input type="number" step="0.1" min="0" max="1" value={editingProfile.speech_volume ?? 1.0} onChange={(e) => setEditingProfile({ ...editingProfile, speech_volume: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm pb-2">
                    <input type="checkbox" checked={editingProfile.enabled !== 0}
                      onChange={(e) => setEditingProfile({ ...editingProfile, enabled: e.target.checked ? 1 : 0 })}
                      className="rounded border-slate-300 accent-blue-900" />
                    Activo
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleSaveProfile}
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">
                  {editingProfile.id ? "Actualizar" : "Crear perfil"}
                </button>
                <button onClick={() => setEditingProfile(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Cancelar</button>
              </div>
            </div>
          )}

          {soundProfiles.length === 0 ? (
            <div className="text-center py-10 text-slate-400">No hay perfiles sonoros configurados.</div>
          ) : (
            <div className="space-y-2">
              {soundProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-slate-200 hover:shadow-sm transition">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{profile.name}</span>
                      {profile.company && <span className="text-xs text-slate-400">{profile.company}</span>}
                      {profile.enabled ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">Activo</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">Inactivo</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      {profile.station_id && <span>Estación específica</span>}
                      {profile.operator_id && <span>Operador específico</span>}
                      {profile.train_type_id && <span>Tipo de tren específico</span>}
                      {profile.commercial_service && <span>Servicio: {profile.commercial_service}</span>}
                      {profile.service_type && <span>Tipo: {profile.service_type}</span>}
                      <span>Vol. sonido: {profile.sound_volume}</span>
                      <span>Vol. voz: {profile.speech_volume}</span>
                      <span>Delay: {profile.delay_after_sound_ms}ms</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 ml-3">
                    <button onClick={() => setEditingProfile(profile)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" title="Editar">
                      <Settings size={14} />
                    </button>
                    <button onClick={() => handleDeleteProfile(profile.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
