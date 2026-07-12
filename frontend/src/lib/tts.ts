import { API_URL } from "./api";

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
  stops?: string[] | null;
  type_pre_announce?: string | null;
  operator_pre_announce?: string | null;
  station_pre_announce?: string | null;
};

const LANG_TO_BCP47: Record<string, string> = {
  es: "es-ES",
  ca: "ca-ES",
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
    departures: "Atención. Tren {type_name} {number} con destino a {destination}, efectuará su salida por la vía {platform}, sector {sector}.",
    arrivals: "Atención. Tren {type_name} {number} procedente de {origin}, efectuará su llegada por la vía {platform}, sector {sector}.",
  },
  ca: {
    departures: "Atenció. Tren {type_name} {number} amb destinació a {destination}, efectuarà la seva sortida per la via {platform}, sector {sector}.",
    arrivals: "Atenció. Tren {type_name} {number} procedent de {origin}, efectuarà la seva arribada per la via {platform}, sector {sector}.",
  },
  en: {
    departures: "Attention. Train {type_name} {number} to {destination}, will depart from platform {platform}, sector {sector}.",
    arrivals: "Attention. Train {type_name} {number} from {origin}, will arrive at platform {platform}, sector {sector}.",
  },
  fr: {
    departures: "Attention. Le train {type_name} {number} à destination de {destination} partira voie {platform}, secteur {sector}.",
    arrivals: "Attention. Le train {type_name} {number} en provenance de {origin} arrivera voie {platform}, secteur {sector}.",
  },
  eu: {
    departures: "Adi. {destination} helmuga duen {type_name} {number} trena {platform} bidetik irtengo da, {sector} sektorean.",
    arrivals: "Adi. {origin}tik datorren {type_name} {number} trena {platform} bidetik iritsiko da, {sector} sektorean.",
  },
  gl: {
    departures: "Atención. O tren {type_name} {number} con destino a {destination} sairá pola vía {platform}, sector {sector}.",
    arrivals: "Atención. O tren {type_name} {number} procedente de {origin} chegará pola vía {platform}, sector {sector}.",
  },
};

const DEFAULT_PRESETS: AnnouncePreset[] = [
  { id: "welcome", label: "Bienvenida", text: "Bienvenidos a la estación. Mantengan su billete a mano y no crucen las vías." },
  { id: "closing", label: "Cierre", text: "Atención. La estación va a cerrar. Asegúrense de recoger todas sus pertenencias." },
  { id: "workshop", label: "Taller", text: "Atención. El taller de iniciación a la soldadura comenzará en 5 minutos en la sala contigua." },
  { id: "delay-warning", label: "Retraso general", text: "Rogamos disculpen las molestias. Debido a la densidad de tráfico ferroviario, algunos trenes pueden sufrir retrasos." },
  { id: "photo", label: "Foto", text: "Atención. Dentro de 10 minutos realizaremos la foto de grupo. Les rogamos se acerquen al área central." },
];

const SUPPORTED_LANGUAGES = new Set(["es", "ca", "en", "fr", "eu", "gl"]);

function normalizeLanguageCode(value?: string | null) {
  const lang = String(value || "").toLowerCase().trim();
  return SUPPORTED_LANGUAGES.has(lang) ? lang : "es";
}

export function resolveDisplayLanguage(config: Configish | null, preferredLanguage?: string) {
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

  const normalized = rawList
    .map((value) => normalizeLanguageCode(String(value)))
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const primary = normalizeLanguageCode(preferredLanguage || config?.language || normalized[0] || "es");
  return normalized.includes(primary) ? primary : (normalized[0] || primary);
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

export function renderTemplate(template: string, train: Trainish): string {
  const vars: Record<string, string> = {
    number: train.number || "",
    type_name: train.type_name || "",
    type_code: train.type_code || "",
    operator: train.operator_name || "",
    origin: train.origin || "",
    destination: train.destination || "",
    platform: train.platform && train.platform !== "-" ? train.platform : "sin vía asignada",
    sector: train.sector && train.sector !== "-" ? train.sector : "sin sector",
    status: train.status || "",
    stops: train.stops?.join(", ") || "",
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
    const match = voices.find(v => v.lang.startsWith(langPrefix));
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

export function speak(text: string, settings?: VoiceSettings, langCode?: string) {
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
}

export function speakWithConfig(text: string, config: Configish | null) {
  const vs = loadVoiceSettings(config);
  speak(text, vs, resolveDisplayLanguage(config));
}

function resolvePreAnnounce(train: Trainish): string | null {
  return train.type_pre_announce
    || train.operator_pre_announce
    || train.station_pre_announce
    || null;
}

export function announceTrain(train: Trainish, config: Configish | null, template?: string) {
  const lang = resolveDisplayLanguage(config);
  const mode = config?.mode === "arrivals" ? "arrivals" : "departures";
  const resolvedTemplate = template || getAnnouncementTemplate(config, mode, lang);
  const text = renderTemplate(resolvedTemplate, train);
  const vs = {
    ...loadVoiceSettings(config),
    voiceURI: getVoiceURIForLanguage(config, lang),
  };
  const pre = resolvePreAnnounce(train);
  const doSpeak = () => speak(text, vs, lang);
  if (pre) {
    const audio = new Audio(pre.startsWith("http") ? pre : `${API_URL}${pre}`);
    audio.onended = doSpeak;
    audio.play().catch(doSpeak);
  } else {
    doSpeak();
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
