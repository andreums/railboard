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
  tts_rate?: string;
  tts_pitch?: string;
  tts_volume?: string;
  tts_voice?: string;
};

const DEFAULT_DEPARTURE = "Atención. Tren {type_name} {number} con destino a {destination}, efectuará su salida por la vía {platform}, sector {sector}.";
const DEFAULT_ARRIVAL = "Atención. Tren {type_name} {number} procedente de {origin}, efectuará su llegada por la vía {platform}, sector {sector}.";

const DEFAULT_PRESETS: AnnouncePreset[] = [
  { id: "welcome", label: "Bienvenida", text: "Bienvenidos a la estación. Mantengan su billete a mano y no crucen las vías." },
  { id: "closing", label: "Cierre", text: "Atención. La estación va a cerrar. Asegúrense de recoger todas sus pertenencias." },
  { id: "workshop", label: "Taller", text: "Atención. El taller de iniciación a la soldadura comenzará en 5 minutos en la sala contigua." },
  { id: "delay-warning", label: "Retraso general", text: "Rogamos disculpen las molestias. Debido a la densidad de tráfico ferroviario, algunos trenes pueden sufrir retrasos." },
  { id: "photo", label: "Foto", text: "Atención. Dentro de 10 minutos realizaremos la foto de grupo. Les rogamos se acerquen al área central." },
];

export function defaultPresets(): AnnouncePreset[] {
  return DEFAULT_PRESETS;
}

export function defaultTemplate(mode: string): string {
  return mode === "arrivals" ? DEFAULT_ARRIVAL : DEFAULT_DEPARTURE;
}

export function renderTemplate(template: string, train: Trainish): string {
  const vars: Record<string, string> = {
    number: train.number || "",
    type_name: train.type_name || "",
    type_code: train.type_code || "",
    operator: train.operator_name || "",
    origin: train.origin || "",
    destination: train.destination || "",
    platform: train.platform || "",
    sector: train.sector || "",
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
  speak(text, vs, config?.language);
}

function resolvePreAnnounce(train: Trainish): string | null {
  return train.type_pre_announce
    || train.operator_pre_announce
    || train.station_pre_announce
    || null;
}

export function announceTrain(train: Trainish, config: Configish | null, template: string) {
  const text = renderTemplate(template, train);
  const vs = loadVoiceSettings(config);
  const lang = config?.language;
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
