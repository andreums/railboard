import { useEffect, useMemo, useState, useRef } from "react";
import { api, connectWS, fileUrl, type Config, type Train, type Place, type Station } from "../lib/api";
import { useParams } from "react-router-dom";
import Clock from "../components/Clock";
import SteamTrain from "../components/SteamTrain";
import { t, type Language } from "../lib/i18n";
import { resolveDisplayLanguage } from "../lib/tts";

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
    .map((v) => String(v || "").toLowerCase().trim())
    .filter((v): v is Language => SUPPORTED_LANGUAGES.has(v))
    .filter((v, i, arr) => arr.indexOf(v) === i);
}

if (!document.getElementById("board-fonts")) {
  const link = document.createElement("link");
  link.id = "board-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Roboto+Condensed:wght@300;400;700&family=Roboto+Mono:wght@400;700&display=swap";
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
  // Keep imminent trains at the top, but move clearly-past trains to next-day order.
  let diff = minutesUntil(hhmm);
  if (diff < -5) diff += 24 * 60;
  return diff;
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function clockMinuteDelta(fromHHMM: string, toHHMM: string) {
  let diff = timeToMinutes(toHHMM) - timeToMinutes(fromHHMM);
  if (diff > 12 * 60) diff -= 24 * 60;
  if (diff < -12 * 60) diff += 24 * 60;
  return diff;
}

function parseStopsText(stopsText?: string | null) {
  return String(stopsText || "")
    .split(/[·|;/\n]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function TrainTypeBadge({
  code,
  color,
}: {
  code: string;
  color?: string | null;
}) {
  const label = code.toUpperCase().trim();
  // Use color from DB always; only fall back to defaults if no color provided
  const isCommuter = /^(C(-\d+)?[A-Z]?|R\d+[A-Z]?)$/i.test(label);
  const bg = color && color.trim() ? color : (isCommuter ? "#2E4DA7" : "#7C1D2E");
  const width = isCommuter ? "2.45em" : "2.95em";
  const fontSize = label.length > 4 ? 23 : label.length > 3 ? 25 : 28;

  return (
    <svg
      viewBox="0 0 100.1 54.6"
      aria-label={label}
      role="img"
      style={{
        display: "block",
        width,
        height: "1.22em",
        overflow: "visible",
        transform: "translateY(0.25em)",
      }}
    >
      <rect x="0" y="0" width="100.1" height="54.6" rx="14" fill={bg} />
      <text
        x="50"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Oswald, Arial, sans-serif"
        fontSize={fontSize}
        fontWeight="700"
        fill="#fff"
      >
        {label}
      </text>
    </svg>
  );
}

/** Scrolls horizontally only when text overflows its container */
function ScrollText({
  text,
  color,
  bold,
  fontSize,
}: {
  text: string;
  color: string;
  bold?: boolean;
  fontSize?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const check = () => {
      if (wrapRef.current && spanRef.current)
        setScrolling(spanRef.current.scrollWidth > wrapRef.current.clientWidth + 1);
    };
    const timer = setTimeout(check, 120);
    window.addEventListener("resize", check);
    return () => { clearTimeout(timer); window.removeEventListener("resize", check); };
  }, [text]);

  return (
    <div ref={wrapRef} style={{ overflow: "hidden", width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <span
        ref={spanRef}
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          color,
          fontWeight: bold ? 700 : 400,
          fontSize: fontSize ?? "inherit",
          animation: scrolling ? "marquee-pause 18s linear infinite" : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

export default function Display() {
  const { stationId: stationIdParam } = useParams<{ stationId?: string }>();
  const [config, setConfig] = useState<Config | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [boardStationName, setBoardStationName] = useState<string>("—");
  const [boardMode, setBoardMode] = useState<"departures" | "arrivals" | "mixed">("departures");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [langIndex, setLangIndex] = useState(0);

  const refresh = async () => {
    try {
      const [c, st, p] = await Promise.all([api.getConfig(), api.listStations(), api.listPlaces()]);
      setStations(st);
      setPlaces(p);

      // Respect displayMode: "single" ignores URL param, "multiple" uses it
      const displayMode = c?.displayMode || "multiple";
      let stationId = 1;
      if (displayMode === "single") {
        // Single mode: always use the configured station (ignore URL param)
        if (c?.station_name && st?.length) {
          const found = st.find(s => s.name.includes(c.station_name) || c.station_name.includes(s.name));
          if (found) stationId = found.id;
        } else if (st?.length) {
          stationId = st[0].id;
        }
      } else {
        // Multiple mode: use URL param, fall back to config or first station
        const parsedStationId = Number(stationIdParam);
        if (Number.isFinite(parsedStationId) && parsedStationId > 0 && st.some((s) => s.id === parsedStationId)) {
          stationId = parsedStationId;
        } else if (c?.station_name && st?.length) {
          const found = st.find(s => s.name.includes(c.station_name) || c.station_name.includes(s.name));
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

      // Get board data already normalized by backend
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
        setBoardStationName(boardData?.station?.displayName || boardData?.station?.name || stationConfig?.station_name || c?.station_name || "—");
        setBoardMode((boardData?.mode || mode) as "departures" | "arrivals" | "mixed");
        setError(null);
      } catch (boardError) {
        // Fallback to legacy trains if board endpoint fails
        try {
          const tr = await api.listTrains();
          setTrains(tr);
          setBoardStationName(stationConfig?.station_name || c?.station_name || "—");
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
      setError("Error al cargar la configuración");
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

  // ── Language rotation: cycle every 5s when multiple languages configured ──
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
  const lang = hasMultipleLanguages
    ? displayLanguages[langIndex] || displayLanguages[0]
    : (resolveDisplayLanguage(config) as Language);
  const rows = useMemo(() => [
    ...trains.filter((tr) => !["Departed", "Arrived"].includes(tr.status)),
  ]
    .sort((a, b) => {
      const aTime = a.expected_time !== "—" ? a.expected_time : a.scheduled_time;
      const bTime = b.expected_time !== "—" ? b.expected_time : b.scheduled_time;
      if (aTime === "—" || bTime === "—") return 0;
      return orderMinutesUntil(aTime) - orderMinutesUntil(bTime);
    })
    .slice(0, 12),
    [trains]);

  const bgColor = (config?.bgColor as string) || "#050a14";
  const headerBg = (config?.headerBgColor as string) || "#BFEFD5";
  const headerColor = (config?.headerTextColor as string) || "#102341";
  const rowBg = (config?.rowBgColor as string) || "#1A3254";
  const altBg = (config?.altBgColor as string) || "#102341";

  const n = rows.length || 1;

  // ── Gravita technique: row height as CSS font-size base ──
  // Row height = tableHeight / n, capped so rows never get too tall.
  // The cap ensures that with few trains (2-3) on a large screen,
  // text doesn't become absurdly huge.
  // Gravita uses ~96px as practical max row height on a 1080p screen.
  const tableH = "84dvh";
  // Cap lower to prevent oversized rows that clip inner elements when few rows are visible.
  const rowH = `min(calc(${tableH} / ${n}), 10dvh)`;

  // Column widths — mirror Gravita exactly
  const W_TIME = "11.17%";
  const W_DEST = "51%";
  const W_PROD = "23%";
  const W_PLAT = "8.5%";
  // margin between dest and prod: 0.5%
  const W_MARG = "0.5%";
  // access not shown (no access data)

  if (error) {
    return (
      <div style={{
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
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>⚠️</div>
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
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      backgroundColor: bgColor,
      fontFamily: "'Roboto Condensed', sans-serif",
      overflow: "hidden",
    }}>

      {/* ══════════ HEADER — ~10dvh ══════════ */}
      <header style={{
        backgroundColor: headerBg,
        color: headerColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "12dvh",
        padding: "0 2rem",
        borderBottom: "2px solid rgba(0,0,0,0.10)",
        flexShrink: 0,
        gap: "1rem",
        boxSizing: "border-box",
      }}>
        {/* Logo + mode + station */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, height: "100%" }}>
          {config?.logo_url && (
            <img
              src={config.logo_url}
              alt="Logo"
              style={{ height: "70%", width: "auto", flexShrink: 0 }}
            />
          )}
          <span style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(3rem, 7dvh, 7rem)",
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {t(mode === "departures" ? "departures" : "arrivals", lang)}
          </span>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "baseline", marginLeft: "0.6rem", gap: "0.6rem", minWidth: 0 }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: "clamp(1.0rem, 2.2dvh, 2.6rem)", letterSpacing: 0, opacity: 1, lineHeight: 1 }}>
              {t("station-of", lang)}
            </span>
            <span style={{
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(3rem, 7dvh, 7rem)",
              lineHeight: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "40vw",
              flexShrink: 0,
            }}>
              {boardStationName}
            </span>
          </div>
        </div>
        {/* Clock */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Roboto Mono', monospace",
            fontWeight: 700,
            fontSize: "clamp(3rem, 6.5dvh, 7rem)",
            lineHeight: 1,
          }}>
            <Clock
              mode={config?.clockMode === "fake" ? "fake" : "real"}
              fakeTime={config?.clockFakeTime || "12:00:00"}
              fakeStepSeconds={Number(config?.clockFakeStepSeconds || 1)}
            />
          </div>
          <span style={{ fontSize: "clamp(1rem, 2.5dvh, 2.4rem)", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.75, marginTop: "0.1rem", fontWeight: 700 }}>
            {t("platform", lang)}
          </span>
        </div>
      </header>

      {/* ══════════ TABLE ══════════ */}
      <div style={{ height: tableH, overflow: "hidden", flexShrink: 0 }}>
        {rows.map((train, i) => {
          const place = mode === "departures" ? train.destination : train.origin;
          const minutes = minutesUntil(train.expected_time);
          const isCancelled = train.status === "Cancelled";
          const isDelayed = train.expected_time !== train.scheduled_time;
          const expectedDelta = clockMinuteDelta(train.scheduled_time, train.expected_time);
          const isAhead = expectedDelta < 0;
          const isBoarding = train.status === "Boarding";
          const isLeaving = !isCancelled && (isBoarding || (minutes >= 0 && minutes <= 2));
          const padNum = train.number ? String(train.number).padStart(5, "0") : "00000";
          const showCountdown = !isCancelled && !isDelayed && minutes >= 0 && minutes <= 15;
          const timeStruck = isCancelled || isDelayed;
          const hasStops = train.stops?.length > 0;
          const hasObservations = Boolean(train.observations?.trim());

          const platform = train.platform && train.platform !== "-" && train.platform !== "?" ? train.platform : "";
          const sector = train.sector && train.sector !== "-" ? train.sector : "";
          const platText = platform
            ? sector
              ? /^\d+$/.test(platform) && /^\d+$/.test(sector)
                ? `${platform}-${sector}`
                : `${platform}${sector}`
              : platform
            : "-";

          return (
            <div
              key={train.id}
              style={{
                // ── Gravita core technique ──
                // font-size = row height → all % children scale perfectly
                fontSize: rowH,
                height: rowH,
                width: "100%",
                display: "flex",
                flexWrap: "wrap",        // matches Gravita: upper row + lower row
                boxSizing: "border-box",
                backgroundColor: i % 2 === 0 ? rowBg : altBg,
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                overflow: "hidden",
                color: "white",
                paddingLeft: "1rem",
                paddingRight: "1rem",
              }}
            >
              {/* ═══ UPPER ROW — 60% of row height ═══ */}

              {/* TIME — 11.17% wide, 60% tall, font 50% of rowH */}
              <div style={{
                width: W_TIME,
                height: "60%",
                fontSize: "46%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "flex-start",
                fontFamily: "'Roboto Mono', monospace",
                fontWeight: 700,
                lineHeight: 1,
                overflow: "hidden",
                boxSizing: "border-box",
              }}>
                <div style={{
                  whiteSpace: "nowrap",
                  textDecoration: timeStruck ? "line-through" : "none",
                  textDecorationColor: isCancelled ? "#555" : "#999",
                  color: isCancelled ? "#4a5568" : "#ffffff",
                  animation: isLeaving ? "departure-time-blink 0.9s ease-in-out infinite" : "none",
                  transform: "translateY(0.25em)",
                }}>
                  {showCountdown
                    ? <>{Math.max(0, minutes)}<span style={{ fontSize: "40%", marginLeft: "0.2em" }}>{t("minute-short", lang)}</span></>
                    : train.scheduled_time
                  }
                </div>
              </div>

              {/* DESTINATION — 56.33% wide, 60% tall, font 50% of rowH */}
              <div style={{
                width: W_DEST,
                height: "60%",
                fontSize: "38%",
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
                boxSizing: "border-box",
                paddingLeft: "calc(0.4em - 10px)",
                gap: "0.5em",
              }}>
                {(() => {
                  const mode = train.icon_mode || (config?.showDestinationIcon !== false ? "destination" : "none");
                  if (mode === "none") return null;

                  let iconUrl: string | undefined | null = null;
                  if (mode === "custom") iconUrl = train.custom_icon_url;
                  else if (mode === "destination") iconUrl = train.type_destination_icon || train.type_logo || train.operator_logo;
                  else if (mode === "type") iconUrl = train.type_logo;
                  else if (mode === "operator") iconUrl = train.operator_logo;

                  if (!iconUrl) return null;

                  return (
                    <img
                      src={fileUrl(iconUrl || null)!}
                      alt=""
                      style={{
                        height: "1em",
                        width: "auto",
                        flexShrink: 0,
                        objectFit: "contain",
                      }}
                    />
                  );
                })()}
                <div style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
                  <div style={{
                    fontFamily: "'Oswald', sans-serif",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: isCancelled ? "#4a5568" : "#ffffff",
                    textDecoration: isCancelled ? "line-through" : "none",
                    lineHeight: 1,
                    width: "100%",
                  }}>
                    {place}
                  </div>
                </div>
              </div>

              {/* MARGIN */}
              <div style={{ width: W_MARG, height: "60%" }} />

              {/* PRODUCT (logo + number) — 18% wide, 60% tall */}
              {/* Internal split: logo 61%, margin 2%, number 35%, margin 2% */}
              <div style={{
                width: W_PROD,
                height: "60%",
                fontSize: "50%",
                display: "flex",
                flexWrap: "nowrap",
                justifyContent: "center",
                alignItems: "center",
                overflow: "visible",
                boxSizing: "border-box",
              }}>
                {/* Logo slot */}
                <div style={{
                  width: "48%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center start",
                  overflow: "visible",
                  lineHeight: 0,
                }}>
                  {train.type_logo ? (
                    <img
                      src={fileUrl(train.type_logo)!}
                      alt={train.type_code || ""}
                      style={{
                        maxWidth: "100%",
                        height: "40%",
                        width: "auto",
                        objectFit: "contain",
                        borderRadius: "0.2em",
                        display: "block",
                        margin: 0,
                      }}
                    />
                  ) : train.type_code ? (
                    <TrainTypeBadge code={train.type_code} color={train.type_color} />
                  ) : train.operator_logo ? (
                    <img
                      src={fileUrl(train.operator_logo)!}
                      alt={train.operator_name || ""}
                      style={{
                        maxWidth: "100%",
                        height: "1.22em",
                        width: "auto",
                        objectFit: "contain",
                        borderRadius: "0.2em",
                        display: "block",
                        margin: 0,
                        overflow: "visible",
                        transform: "translateY(0.25em)",
                      }}
                    />
                  ) : train.operator_name ? (
                    <span style={{
                      fontSize: "55%",
                      fontWeight: 700,
                      fontFamily: "'Roboto Condensed', sans-serif",
                      color: "#ffffff",
                      lineHeight: 1,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      transform: "translateY(0.25em)",
                      display: "inline-block",
                    }}>
                      {train.operator_name}
                    </span>
                  ) : null}
                </div>
                {/* Margin */}
                <div style={{ width: "2%" }} />
                {/* Number slot */}
                <div style={{
                  width: "48%",
                  height: "100%",
                  fontSize: "90%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  overflow: "hidden",
                  fontFamily: "'Roboto Mono', monospace",
                  fontWeight: 700,
                  textAlign: "center",
                }}>
                  <div style={{ whiteSpace: "nowrap", minWidth: "5ch", transform: "translateY(0.25em)" }}>{padNum}</div>
                </div>
                {/* Margin */}
                <div style={{ width: "2%" }} />
              </div>

              {/* PLATFORM — 7.5% wide, 60% tall, font 50% of rowH */}
              <div style={{
                width: W_PLAT,
                height: "60%",
                fontSize: "46%",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                overflow: "visible",
                boxSizing: "border-box",
                fontFamily: "'Oswald', sans-serif",
                fontWeight: 700,
                whiteSpace: "nowrap",
                paddingRight: 0,
                paddingLeft: "0.2em",
              }}>
                <div style={{ transform: "translateY(0.12em)" }}>{platText}</div>
              </div>

              {/* ═══ LOWER ROW — 40% of row height, font 32% of rowH ═══ */}

              {/* STATUS — lower row on TIME column */}
              <div style={{
                width: W_TIME,
                height: "40%",
                fontSize: "20%",
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
                fontFamily: "'Roboto Mono', monospace",
                fontWeight: 700,
                whiteSpace: "nowrap",
                boxSizing: "border-box",
              }}>
                {isDelayed && !isCancelled && (
                  <span style={{ color: isAhead ? "#5FE0AF" : "#FF8557" }}>
                    {t("estimated", lang)}&nbsp;{train.expected_time}
                  </span>
                )}
                {isCancelled && (
                  <span style={{ color: "#FF8557" }}>{t("cancelled", lang)}</span>
                )}
              </div>

              {/* STOPS — lower row only under DESTINATION column */}
              <div style={{
                width: W_DEST,
                height: "40%",
                fontSize: "19%",
                display: "flex",
                alignItems: "center",
                overflow: "hidden",
                boxSizing: "border-box",
                paddingLeft: "0.4em",
                fontFamily: "'Roboto Condensed', sans-serif",
              }}>
                {hasStops && (
                  <div style={{ width: "100%", minWidth: 0, overflow: "hidden", marginTop: "10px" }}>
                    <ScrollText
                      text={train.stops.join(" · ")}
                      color="#ffffff"
                      bold
                      fontSize="100%"
                    />
                  </div>
                )}
              </div>

              {/* MARGIN */}
              <div style={{ width: W_MARG, height: "40%" }} />

              {/* OBSERVATIONS — only under type + train number column */}
              <div style={{
                width: `calc(${W_PROD} + ${W_PLAT})`,
                height: "40%",
                fontSize: "19%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                overflow: "hidden",
                boxSizing: "border-box",
              }}>
                {(train.type_name?.includes("Cercanías") || train.type_name?.includes("cercanías")) && (
                  <div style={{ paddingBottom: "8px", flexShrink: 0 }}>
                    <img
                      src="https://info.adif.es/recursos/C01CERMAD.png?v=12"
                      alt="Cercanías"
                      style={{ height: "1.2em", width: "auto", objectFit: "contain" }}
                    />
                  </div>
                )}
                {hasObservations && (
                  <div style={{ width: "100%", minWidth: 0, overflow: "hidden" }}>
                    <ScrollText
                      text={train.observations!}
                      color="#5FE0AF"
                      bold
                      fontSize="100%"
                    />
                  </div>
                )}
              </div>

              {/* PLATFORM lower (empty, keeps column alignment) */}
              <div style={{ width: 0, height: "40%" }} />

            </div>
          );
        })}
      </div>

      {/* ══════════ FOOTER — ~4dvh ══════════ */}
      <footer style={{
        flex: 1,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        backgroundColor: "rgba(0,0,0,0.35)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
      }}>
        <div
          className="animate-marquee-full"
          style={{
            whiteSpace: "nowrap",
            color: "#3d5a80",
            fontSize: "clamp(1.2rem, 2.4dvh, 2rem)",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            fontWeight: 700,
          }}
        >
          <span>
            {config?.footerText ||
              `${t("welcome", lang)} ${boardStationName} · ${t("ticket", lang)} · ${t("tracks", lang)} · ${t("wifi", lang)} · ${t("event", lang)}`}
          </span>
        </div>
      </footer>
    </div>
  );
}
