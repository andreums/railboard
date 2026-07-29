import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { api, connectWS, type Config, type Train, type Station, type Place } from "../lib/api";
import { useParams } from "react-router-dom";
import SteamTrain from "../components/SteamTrain";
import { t, type Language } from "../lib/i18n";
import { resolveDisplayLanguage } from "../lib/tts";
import BoardHeader from "../components/pis/BoardHeader";
import DepartureRow from "../components/pis/DepartureRow";

const SUPPORTED_LANGUAGES = new Set<string>(["es", "ca", "en", "fr", "eu", "gl"]);

function resolveDisplayLanguages(config: Config | null): Language[] {
  const rawList = Array.isArray(config?.languages)
    ? config.languages
    : typeof config?.languages === "string" && (config.languages as string).trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(config.languages as string);
            return Array.isArray(parsed) ? parsed : [config.languages];
          } catch {
            return [config.languages];
          }
        })()
      : typeof config?.languages === "string" && (config.languages as string).includes(",")
        ? (config.languages as string).split(",")
        : config?.languages != null
          ? [config.languages]
          : [];

  return rawList
    .map((v) =>
      String(v || "")
        .toLowerCase()
        .trim(),
    )
    .filter((v): v is Language => SUPPORTED_LANGUAGES.has(v))
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

if (!document.getElementById("board-fonts")) {
  const link = document.createElement("link");
  link.id = "board-fonts";
  link.rel = "stylesheet";
  link.href = "/fonts/fonts.css";
  document.head.appendChild(link);
}

function minutesUntil(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  let diff = Math.round((target.getTime() - now.getTime()) / 60000);
  if (diff < -60) diff += 24 * 60;
  return diff;
}

function orderMinutesUntil(hhmm: string) {
  let diff = minutesUntil(hhmm);
  if (diff < -5) diff += 24 * 60;
  return diff;
}

function parseStopsText(stopsText?: string | null) {
  return String(stopsText || "")
    .split(/[·|;/\n]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

const MAX_VISIBLE_ROWS = 7;

const ROW_HEIGHT_PX = 134; // approximate px for scroll height calculation

export default function Display() {
  const { stationId: stationIdParam } = useParams<{ stationId?: string }>();
  const [config, setConfig] = useState<Config | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [boardStationName, setBoardStationName] = useState<string>("\u2014");
  const [boardMode, setBoardMode] = useState<"departures" | "arrivals" | "mixed">("departures");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [langIndex, setLangIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  const refresh = async () => {
    try {
      const [c, st, p] = await Promise.all([api.getConfig(), api.listStations(), api.listPlaces()]);
      setStations(st);
      setPlaces(p);

      const displayMode = c?.displayMode || "multiple";
      let stationId = 1;
      if (displayMode === "single") {
        if (c?.station_name && st?.length) {
          const found = st.find((s) => s.name.includes(c.station_name) || c.station_name.includes(s.name));
          if (found) stationId = found.id;
        } else if (st?.length) {
          stationId = st[0].id;
        }
      } else {
        const parsedStationId = Number(stationIdParam);
        if (Number.isFinite(parsedStationId) && parsedStationId > 0 && st.some((s) => s.id === parsedStationId)) {
          stationId = parsedStationId;
        } else if (c?.station_name && st?.length) {
          const found = st.find((s) => s.name.includes(c.station_name) || c.station_name.includes(s.name));
          if (found) stationId = found.id;
        } else if (st?.length) {
          stationId = st[0].id;
        }
      }

      let stationConfig = c;
      try {
        stationConfig = await api.getStationDisplayConfig(stationId);
      } catch {
        stationConfig = c;
      }
      setConfig(stationConfig);

      const mode = stationConfig?.mode || c?.mode || "departures";
      try {
        const boardData = await api.getStationBoard(stationId, mode as "departures" | "arrivals");
        const normalizedRows: Train[] = (boardData.rows || []).map((row: any, idx: number) => ({
          id: Number(row.stopId || row.serviceId || idx + 1),
          number: row.number,
          operator_id: null,
          operator_name: row.operatorName,
          operator_logo: row.operatorLogo || null,
          train_type_id: null,
          type_code: row.trainTypeCode,
          type_name: row.trainTypeName,
          type_color: row.trainTypeColor || null,
          type_logo: row.trainTypeLogo || null,
          type_destination_icon: row.trainTypeDestinationIcon || null,
          custom_icon_url: row.customIcon || null,
          icon_mode: row.iconMode || "destination",
          origin: row.origin || "Origen",
          destination: row.destination || "Destino",
          stops: parseStopsText(row.stopsText),
          scheduled_time: row.time,
          expected_time: row.expectedTime || row.time,
          platform: row.platform || "?",
          sector: row.sector || "",
          status: row.status || "Scheduled",
          observations: row.observations || row.notes || "",
        }));
        setTrains(normalizedRows);
        setBoardStationName(
          boardData?.station?.displayName || boardData?.station?.name || stationConfig?.station_name || c?.station_name || "\u2014",
        );
        setBoardMode((boardData?.mode || mode) as "departures" | "arrivals" | "mixed");
        setError(null);
      } catch (boardError) {
        try {
          const tr = await api.listTrains();
          setTrains(tr);
          setBoardStationName(stationConfig?.station_name || c?.station_name || "\u2014");
          setBoardMode((mode as "departures" | "arrivals") || "departures");
          setError(null);
        } catch (fallbackError) {
          setTrains([]);
          setError("No se pudieron cargar los trenes. Intentando de nuevo...");
          console.error("Both board and legacy trains failed:", fallbackError);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error("Refresh error:", error);
      setTrains([]);
      setError("Error al cargar la configuraci\u00f3n");
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const ws = connectWS(refresh);
    const unsubscribe = ws?.on?.("service_updated", refresh);
    const poll = setInterval(refresh, 5000);
    const tick = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      if (ws && typeof ws.close === "function") ws.close();
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [stationIdParam]);

  const displayLanguages = useMemo(() => resolveDisplayLanguages(config), [config]);
  const hasMultipleLanguages = displayLanguages.length > 1;

  useEffect(() => {
    if (!hasMultipleLanguages) return;
    setLangIndex(0);
    const interval = setInterval(() => {
      setLangIndex((prev) => (prev + 1) % displayLanguages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasMultipleLanguages, displayLanguages.length]);

  const mode = boardMode || (config?.mode as "departures" | "arrivals") || "departures";
  const lang = hasMultipleLanguages ? displayLanguages[langIndex] || displayLanguages[0] : (resolveDisplayLanguage(config) as Language);

  const rows = useMemo(
    () =>
      [...trains.filter((tr) => !["Departed", "Arrived"].includes(tr.status))].sort((a, b) => {
        const aTime = a.expected_time !== "\u2014" ? a.expected_time : a.scheduled_time;
        const bTime = b.expected_time !== "\u2014" ? b.expected_time : b.scheduled_time;
        if (aTime === "\u2014" || bTime === "\u2014") return 0;
        return orderMinutesUntil(aTime) - orderMinutesUntil(bTime);
      }),
    [trains],
  );

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const VISIBLE_BUFFER = 3;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - VISIBLE_BUFFER);
  const endIdx = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT_PX) + VISIBLE_BUFFER);
  const visibleRows = rows.slice(startIdx, endIdx);
  const totalHeight = rows.length * ROW_HEIGHT_PX;
  const offsetY = startIdx * ROW_HEIGHT_PX;

  if (error) {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          backgroundColor: "#050a14",
          color: "#fff",
          fontFamily: "'Roboto Condensed', sans-serif",
          gap: "2rem",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>&#9888;&#65039;</div>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.5rem 0" }}>{error}</h1>
          <p style={{ fontSize: "0.9rem", opacity: 0.7, margin: 0 }}>Reintentando en 5 segundos...</p>
        </div>
        <button
          onClick={() => refresh()}
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Reintentar ahora
        </button>
      </div>
    );
  }

  if (loading || rows.length === 0) return <SteamTrain />;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#050a14",
        fontFamily: "'Roboto Condensed', 'Inter', Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <BoardHeader
        stationName={boardStationName}
        mode={mode as "departures" | "arrivals"}
        lang={lang}
        clockMode={config?.clockMode as "real" | "fake" | undefined}
        fakeTime={config?.clockFakeTime}
        fakeStepSeconds={Number(config?.clockFakeStepSeconds || 1)}
        headerBg={config?.headerBgColor}
        headerTextColor={config?.headerTextColor}
        logoUrl={config?.logo_url}
      />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              transform: `translateY(${offsetY}px)`,
            }}
          >
            {visibleRows.map((train, i) => (
              <DepartureRow
                key={train.id}
                train={train}
                index={startIdx + i}
                mode={mode as "departures" | "arrivals"}
                showDestinationIcon={config?.showDestinationIcon !== false}
              />
            ))}
          </div>
        </div>
      </div>

      {config?.footerText && (
        <footer
          style={{
            flexShrink: 0,
            height: "clamp(28px, 3vh, 48px)",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "rgba(0,0,0,0.35)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            className="animate-marquee-full"
            style={{
              whiteSpace: "nowrap",
              color: "#3d5a80",
              fontSize: "clamp(14px, 1.6vh, 24px)",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontWeight: 700,
            }}
          >
            <span>{config.footerText}</span>
          </div>
        </footer>
      )}
    </div>
  );
}
