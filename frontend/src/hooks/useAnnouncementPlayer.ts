import { useEffect, useRef, useCallback, useState } from "react";
import { connectWS, fileUrl } from "../lib/api";

export interface AnnouncementReadyEvent {
  type: "announcement_ready";
  data: {
    id: number;
    trainId: number | null;
    serviceId: number | null;
    stationId: number | null;
    eventType: string;
    priority: string;
    languages: string[];
    texts: Record<string, string>;
    chime: { id: number; name: string; filePath: string; durationMs: number | null } | null;
    createdAt: string;
  };
}

export function useAnnouncementPlayer(onPlay?: (data: AnnouncementReadyEvent["data"]) => void) {
  const [playing, setPlaying] = useState<AnnouncementReadyEvent["data"] | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const wsRef = useRef<ReturnType<typeof connectWS> | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const currentLangRef = useRef<string | null>(null);

  const speak = useCallback((text: string, lang: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const synth = synthRef.current;
      if (!synth) { resolve(); return; }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "ca" ? "ca-ES" : lang === "es" ? "es-ES" : lang === "en" ? "en-GB" : lang === "va" ? "ca-ES" : lang === "eu" ? "eu-ES" : lang === "gl" ? "gl-ES" : "ca-ES";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      currentLangRef.current = lang;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
      setSpeaking(true);
    });
  }, []);

  const playChime = useCallback((chime: AnnouncementReadyEvent["data"]["chime"]): Promise<void> => {
    return new Promise((resolve) => {
      if (!chime?.filePath) { resolve(); return; }
      const url = fileUrl(chime.filePath);
      if (!url) { resolve(); return; }
      const audio = new Audio(url);
      audio.volume = 0.7;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }, []);

  const playAnnouncement = useCallback(async (data: AnnouncementReadyEvent["data"]) => {
    setPlaying(data);
    if (data.chime) await playChime(data.chime);
    for (const lang of data.languages) {
      const text = data.texts[lang];
      if (!text) continue;
      await speak(text, lang);
    }
    setPlaying(null);
    setSpeaking(false);
    currentLangRef.current = null;
  }, [playChime, speak]);

  useEffect(() => {
    const ws = connectWS(() => {});
    wsRef.current = ws;
    const unsub = ws.on("announcement_ready", (msg: AnnouncementReadyEvent) => {
      const data = msg.data;
      if (data) {
        onPlay?.(data);
        playAnnouncement(data);
      }
    });
    return () => { unsub(); ws.close(); synthRef.current.cancel(); };
  }, [playAnnouncement, onPlay]);

  const stop = useCallback(() => {
    synthRef.current.cancel();
    setPlaying(null);
    setSpeaking(false);
  }, []);

  return { playing, speaking, stop };
}
