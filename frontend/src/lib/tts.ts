import { API_URL } from "./api";
import { stopsToNames, type TrainStop } from "./trainStops";

export type AnnouncePreset = {
  id: string;
  label: string;
  text: string;
};

type Trainish = {
  number?: string | null;
  type_name?: string | null;
  type_code?: string | null;
  operator_name?: string | null;
  origin?: string | null;
  destination?: string | null;
  platform?: string | null;
  sector?: string | null;
  status?: string | null;
  stops?: (string | TrainStop)[] | null;
  type_pre_announce?: string | null;
  type_announce_template?: string | null;
  operator_pre_announce?: string | null;
  station_pre_announce?: string | null;
};

const LANG_TO_BCP47: Record<string, string> = {
  es: "es-ES",
  ca: "ca-ES",
  va: "ca-ES-valencia",
  en: "en-US",
  fr: "fr-FR",
  eu: "eu-ES",
  gl: "gl-ES",
};

export type VoiceSettings = {
  rate: number;
  pitch: number;
  volume: number;
  voiceURI: string;
};

type Configish = {
  mode?: string;
  language?: string;
  languages?: string[] | string;
  tts_rate?: string;
  tts_pitch?: string;
  tts_volume?: string;
  tts_voice?: string;
  tts_voice_map?: string;
  announce_departure?: string;
  announce_arrival?: string;
  announce_templates_map?: string;
};

type AnnouncementTemplates = {
  departures: string;
  arrivals: string;
};

const DEFAULT_TEMPLATES: Record<string, AnnouncementTemplates> = {
  es: {
    departures:
      "Atención. Tren {type_name}{number_text} con destino a {destination}, efectuará su salida por la vía {platform}{sector_text}.",
    arrivals: "Atención. Tren {type_name}{number_text} procedente de {origin}, efectuará su llegada por la vía {platform}{sector_text}.",
  },
  ca: {
    departures:
      "Atenció. Tren {type_name}{number_text} amb destinació a {destination}, efectuarà la seva sortida per la via {platform}{sector_text}.",
    arrivals:
      "Atenció. Tren {type_name}{number_text} procedent de {origin}, efectuarà la seva arribada per la via {platform}{sector_text}.",
  },
  va: {
    departures:
      "Atenció. Tren {type_name}{number_text} amb destinació a {destination}, efectuarà la seua eixida per la via {platform}{sector_text}.",
    arrivals:
      "Atenció. Tren {type_name}{number_text} procedent de {origin}, efectuarà la seua arribada per la via {platform}{sector_text}.",
  },
  en: {
    departures: "Attention. Train {type_name}{number_text} to {destination}, will depart from platform {platform}{sector_text}.",
    arrivals: "Attention. Train {type_name}{number_text} from {origin}, will arrive at platform {platform}{sector_text}.",
  },
  fr: {
    departures: "Attention. Le train {type_name}{number_text} à destination de {destination} partira voie {platform}{sector_text}.",
    arrivals: "Attention. Le train {type_name}{number_text} en provenance de {origin} arrivera voie {platform}{sector_text}.",
  },
  eu: {
    departures: "Adi. {destination} helmuga duen {type_name}{number_text} trena {platform} bidetik irtengo da{sector_text}.",
    arrivals: "Adi. {origin}tik datorren {type_name}{number_text} trena {platform} bidetik iritsiko da{sector_text}.",
  },
  gl: {
    departures: "Atención. O tren {type_name}{number_text} con destino a {destination} sairá pola vía {platform}{sector_text}.",
    arrivals: "Atención. O tren {type_name}{number_text} procedente de {origin} chegará pola vía {platform}{sector_text}.",
  },
};

const DEFAULT_PRESETS: AnnouncePreset[] = [
  { id: "welcome", label: "Bienvenida", text: "Bienvenidos a la estación. Mantengan su billete a mano y no crucen las vías." },
  { id: "closing", label: "Cierre", text: "Atención. La estación va a cerrar. Asegúrense de recoger todas sus pertenencias." },
  { id: "workshop", label: "Taller", text: "Atención. El taller de iniciación a la soldadura comenzará en 5 minutos en la sala contigua." },
  {
    id: "delay-warning",
    label: "Retraso general",
    text: "Rogamos disculpen las molestias. Debido a la densidad de tráfico ferroviario, algunos trenes pueden sufrir retrasos.",
  },
  {
    id: "photo",
    label: "Foto",
    text: "Atención. Dentro de 10 minutos realizaremos la foto de grupo. Les rogamos se acerquen al área central.",
  },
];

const SUPPORTED_LANGUAGES = new Set(["es", "ca", "va", "en", "fr", "eu", "gl"]);

const SECTOR_TEXT_FORMATS: Record<string, string> = {
  es: ", sector {sector}",
  ca: ", sector {sector}",
  va: ", sector {sector}",
  en: ", sector {sector}",
  fr: ", secteur {sector}",
  eu: ", {sector} sektorean",
  gl: ", sector {sector}",
};

function normalizeLanguageCode(value?: string | null) {
  const lang = String(value || "")
    .toLowerCase()
    .trim();
  return SUPPORTED_LANGUAGES.has(lang) ? lang : "es";
}

function parseLanguageList(config: Configish | null): string[] {
  const rawList = Array.isArray(config?.languages)
    ? config?.languages
    : typeof config?.languages === "string" && config.languages.trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(config.languages);
            return Array.isArray(parsed) ? parsed : [config.languages];
          } catch {
            return [config.languages];
          }
        })()
      : typeof config?.languages === "string" && config.languages.includes(",")
        ? config.languages.split(",")
        : config?.languages != null
          ? [config.languages]
          : [];

  return rawList
    .map((value) => normalizeLanguageCode(String(value)))
    .filter((value, index, arr) => arr.indexOf(value) === index);
}

export function resolveDisplayLanguage(config: Configish | null, preferredLanguage?: string) {
  const normalized = parseLanguageList(config);
  const primary = normalizeLanguageCode(preferredLanguage || config?.language || normalized[0] || "es");
  return normalized.includes(primary) ? primary : normalized[0] || primary;
}

export function resolveDisplayLanguages(config: Configish | null): string[] {
  const list = parseLanguageList(config);
  return list.length > 0 ? list : ["es"];
}

export function defaultPresets(): AnnouncePreset[] {
  return DEFAULT_PRESETS;
}

function safeParse<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function defaultTemplate(mode: string, language = "es"): string {
  const templates = DEFAULT_TEMPLATES[language] || DEFAULT_TEMPLATES.es;
  return mode === "arrivals" ? templates.arrivals : templates.departures;
}

export function renderTemplate(template: string, train: Trainish, language?: string): string {
  const lang = language ? normalizeLanguageCode(language) : "es";
  const isCommuter = /^(C(-\d+)?|R\d+[A-Z]?)$/i.test(train.type_code || "");
  const sectorValue = train.sector && train.sector !== "-" ? train.sector : "";
  const sectorFormat = SECTOR_TEXT_FORMATS[lang] || SECTOR_TEXT_FORMATS.es;
  const sectorText = sectorValue ? sectorFormat.replace("{sector}", sectorValue) : "";
  const numberText = isCommuter || !train.number ? "" : ` ${train.number}`;
  const vars: Record<string, string> = {
    number: isCommuter ? "" : train.number || "",
    number_text: numberText,
    type_name: train.type_name || "",
    type_code: train.type_code || "",
    operator: train.operator_name || "",
    origin: train.origin || "",
    destination: train.destination || "",
    platform: train.platform && train.platform !== "-" ? train.platform : "sin vía asignada",
    sector: sectorValue,
    sector_text: sectorText,
    status: train.status || "",
    stops: stopsToNames(train.stops).join(", "),
  };
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || "");
}

export function loadVoiceSettings(config: Configish | null): VoiceSettings {
  return {
    rate: config?.tts_rate ? parseFloat(config.tts_rate) : 0.95,
    pitch: config?.tts_pitch ? parseFloat(config.tts_pitch) : 1,
    volume: config?.tts_volume ? parseFloat(config.tts_volume) : 1,
    voiceURI: config?.tts_voice || "",
  };
}

export function getVoiceURIForLanguage(config: Configish | null, language?: string) {
  const lang = resolveDisplayLanguage(config, language);
  const voiceMap = safeParse<Record<string, string>>(config?.tts_voice_map, {});
  const configured = voiceMap[lang] || config?.tts_voice || "";
  if (configured) return configured;
  const bcp47 = LANG_TO_BCP47[lang];
  if (bcp47) {
    const langPrefix = bcp47.split("-")[0];
    const voices = window.speechSynthesis.getVoices();
    const match = voices.find((v) => v.lang.startsWith(langPrefix));
    if (match) return match.voiceURI;
  }
  return "";
}

export function getAnnouncementTemplate(config: Configish | null, mode: string, language?: string) {
  const lang = resolveDisplayLanguage(config, language);
  const templateMap = safeParse<Record<string, AnnouncementTemplates>>(config?.announce_templates_map, {});
  const byLang = templateMap[lang];
  if (byLang && typeof byLang === "object") {
    return mode === "arrivals"
      ? byLang.arrivals || defaultTemplate("arrivals", lang)
      : byLang.departures || defaultTemplate("departures", lang);
  }
  const legacy = mode === "arrivals" ? config?.announce_arrival : config?.announce_departure;
  return legacy || defaultTemplate(mode, lang);
}

export function speak(text: string, settings?: VoiceSettings, langCode?: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  if (settings?.voiceURI) {
    const voices = window.speechSynthesis.getVoices();
    const found = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (found) u.voice = found;
  }
  u.lang = LANG_TO_BCP47[langCode || ""] || "es-ES";
  u.rate = settings?.rate ?? 0.95;
  u.pitch = settings?.pitch ?? 1;
  u.volume = settings?.volume ?? 1;
  window.speechSynthesis.speak(u);
  return u;
}

let serverTtsAvailable: boolean | null = null;

export async function speakServerSide(text: string, langCode: string, settings?: VoiceSettings): Promise<boolean> {
  if (serverTtsAvailable === false) return false;
  try {
    const { api } = await import("./api");
    if (serverTtsAvailable === null) {
      const info = await api.ttsGetProvider();
      serverTtsAvailable = info.available;
      if (!serverTtsAvailable) return false;
    }
    const blob = await api.ttsSynthesize(text, langCode, settings?.voiceURI || undefined, settings?.rate, settings?.pitch);
    if (!blob || blob.size === 0) return false;
    const url = URL.createObjectURL(blob);
    return new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); resolve(true); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
      audio.play().catch(() => { URL.revokeObjectURL(url); resolve(false); });
    });
  } catch {
    serverTtsAvailable = false;
    return false;
  }
}

export async function speakWithFallback(text: string, langCode: string, settings?: VoiceSettings): Promise<void> {
  const usedServer = await speakServerSide(text, langCode, settings);
  if (!usedServer) {
    speak(text, settings, langCode);
  }
}

export function speakWithConfig(text: string, config: Configish | null) {
  const vs = loadVoiceSettings(config);
  speak(text, vs, resolveDisplayLanguage(config));
}

function resolvePreAnnounce(train: Trainish): string | null {
  return train.type_pre_announce || train.operator_pre_announce || train.station_pre_announce || null;
}

export function announceTrain(train: Trainish, config: Configish | null, template?: string) {
  const languages = resolveDisplayLanguages(config);
  const mode = config?.mode === "arrivals" ? "arrivals" : "departures";
  const pre = resolvePreAnnounce(train);

  const speakIndex = async (index: number) => {
    if (index >= languages.length) return;
    const lang = languages[index];
    const resolvedTemplate = template || train.type_announce_template || getAnnouncementTemplate(config, mode, lang);
    const text = renderTemplate(resolvedTemplate, train, lang);
    const vs = {
      ...loadVoiceSettings(config),
      voiceURI: getVoiceURIForLanguage(config, lang),
    };
    await speakWithFallback(text, lang, vs);
    speakIndex(index + 1);
  };

  if (pre) {
    const audio = new Audio(pre.startsWith("http") ? pre : `${API_URL}${pre}`);
    audio.onended = () => speakIndex(0);
    audio.play().catch(() => speakIndex(0));
  } else {
    speakIndex(0);
  }
}

export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}

export function parsePresets(raw: string | null | undefined): AnnouncePreset[] {
  if (!raw) return DEFAULT_PRESETS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}
