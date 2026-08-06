import { useEffect, useState, useRef, type ReactNode } from "react";
import { api, fileUrl, connectWS, type DisplayScreen } from "../lib/api";
import { useParams, Navigate } from "react-router-dom";
import { useAlternating } from "../lib/useAlternating";
import { t, type Language } from "../lib/i18n";
import { normalizeStops } from "../lib/trainStops";
import LineBadge from "../components/pis/LineBadge";
import { ScrollText } from "../components/pis/DepartureRow";
import TrainJourneyDisplay from "../components/displays/TrainJourneyDisplay";
import { selectTrainInfoTrain } from "../components/displays/trainInfoDisplay.selector";
const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = "none"; };

if (!document.getElementById("board-fonts")) {
  const link = document.createElement("link");
  link.id = "board-fonts";
  link.rel = "stylesheet";
  link.href = "/fonts/fonts.css";
  document.head.appendChild(link);
}

type BoardProps = { screen: DisplayScreen; rows: any[]; lang: Language; clock: Date };

function AltValue({ primary, secondary, className, containerClass }: { primary: string; secondary?: string | null; className?: string; containerClass?: string }) {
  const showSecond = useAlternating(!!secondary);
  const display = secondary && showSecond ? secondary : primary;
  if (!containerClass) return <span className={className}>{display}</span>;
  return <div className={containerClass}><span className={className}>{display}</span></div>;
}

function isDelayed(row: any) {
  return row.status === "Delayed" || (row.expected_time && row.scheduled_time && row.expected_time !== row.scheduled_time);
}

function isDepartedOrCancelled(row: any) {
  return row.status === "Departed" || row.status === "Cancelled";
}

function formatDisplayTime(time: string) {
  if (!time) return "--:--";
  return time.length >= 5 ? time.slice(0, 5) : time;
}

function minutesSinceMidnight(hhmm?: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Fraction of the journey elapsed, from departure to the last known stop time.
function computeJourneyProgress(startTime: string | undefined, endTime: string | undefined | null, clock: Date) {
  const start = minutesSinceMidnight(startTime);
  const end = minutesSinceMidnight(endTime);
  if (start == null || end == null) return null;
  const endAdj = end <= start ? end + 24 * 60 : end;
  const nowRaw = clock.getHours() * 60 + clock.getMinutes() + clock.getSeconds() / 60;
  const nowAdj = nowRaw < start - 5 ? nowRaw + 24 * 60 : nowRaw;
  return Math.max(0, Math.min(1, (nowAdj - start) / (endAdj - start)));
}

const PROGRESS_SEGMENTS = 18;

const fullStatusText = (status: string | undefined, lang: Language) => {
  switch (status) {
    case "Scheduled": return t("scheduled", lang);
    case "Approaching": return t("approaching", lang);
    case "Arriving": return t("arriving", lang);
    case "Boarding": return t("boarding", lang);
    case "Delayed": return t("delayed", lang);
    case "Cancelled": return t("cancelled", lang);
    case "Departed": return t("departed", lang);
    default: return status || "";
  }
};

const statusAbbr = (status: string | undefined, lang: Language) => {
  if (!status || status === "Scheduled") return "";
  const letters = { Delayed: "R", Cancelled: "C", Boarding: "E", Departed: "S", Arrived: "A" } as Record<string, string>;
  const english = { Delayed: "DEL", Cancelled: "CAN", Boarding: "BRD", Departed: "DEP", Arrived: "ARR" } as Record<string, string>;
  return (lang === "ca" || lang === "es" ? letters : english)[status] || "";
};

function StatusBadge({ status, lang, variant, delayMinutes }: { status?: string; lang: Language; variant: "lg" | "sm" | "mini"; delayMinutes?: string }) {
  const delayed = status === "Delayed";
  const color =
    status === "Departed" ? "bg-slate-700 text-slate-300" :
    status === "Cancelled" ? "bg-red-900 text-red-200" :
    status === "Delayed" ? "bg-orange-900 text-orange-200" :
    status === "Boarding" ? "bg-green-900 text-green-200" :
    status === "Arrived" ? "bg-blue-900 text-blue-200" :
    status === "Scheduled" ? "bg-blue-900/50 text-blue-200" :
    "bg-blue-900 text-blue-200";

  if (variant === "lg") {
    return (
      <span className={`inline-flex px-4 md:px-6 py-2 rounded-full text-lg md:text-xl font-bold ${color}`}>
        {delayed ? t("delayed-min", lang).replace("{min}", delayMinutes || "") : fullStatusText(status, lang)}
      </span>
    );
  }
  if (variant === "mini") {
    const mini = status === "Cancelled" ? "bg-red-900 text-red-200" : "bg-orange-900 text-orange-200";
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${mini}`}>
        {delayed ? t("delayed", lang) : fullStatusText(status, lang)}
      </span>
    );
  }
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
      {statusAbbr(status, lang)}
    </span>
  );
}

function platText(row: any, lang: Language) {
  return row.platform ? `${t("platform-abbr", lang)} ${row.platform}` : "";
}

export default function DisplayPage() {
  const { displayId } = useParams();
  const [screen, setScreen] = useState<DisplayScreen | null>(null);
  const [board, setBoard] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const wsRef = useRef<ReturnType<typeof connectWS> | null>(null);

  useEffect(() => {
    if (!displayId) return;
    let cancelled = false;
    const fetchBoard = async () => {
      try {
        const data = await api.getDisplayScreenBoard(displayId);
        if (cancelled) return;
        if (!data) { setError("Display no encontrado"); return; }
        const display = data.display || data;
        console.log(`[display ${displayId}] params:`, {
          display_type: display.display_type,
          platform: display.platform,
          sector: display.sector,
          station_id: display.station_id,
          station_name: display.station_name,
          language: display.language,
          max_rows: display.max_rows,
          refresh_mode: display.refresh_mode,
        }, "rows:", data.rows?.length ?? 0, data.rows);
        setScreen(display);
        setBoard(data.rows || []);
        setError(null);
      } catch (err) {
        console.log(`[display ${displayId}] error`, err);
        if (!cancelled) setError("Error al cargar datos");
      }
    };
    fetchBoard();
    const pollInterval = setInterval(fetchBoard, 30000);

    const ws = connectWS(() => { fetchBoard(); });
    wsRef.current = ws;

    // Subscribe to display-specific updates
    ws.send({ type: "subscribe", displayId });
    // Listen for display_update events
    const unsub = ws.on("display_update", (msg: any) => {
      if (msg.displayId === displayId) fetchBoard();
    });

    // Heartbeat every 30s
    const deviceId = `display-${displayId}`;
    const hbInterval = setInterval(() => {
      ws.send({ type: "heartbeat", deviceId, displayId, deviceType: "DISPLAY" });
    }, 30000);
    ws.send({ type: "heartbeat", deviceId, displayId, deviceType: "DISPLAY" });

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      clearInterval(hbInterval);
      unsub();
      ws.close();
      wsRef.current = null;
    };
  }, [displayId]);

  if (!displayId) return <Navigate to="/" replace />;
  if (error) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="text-6xl mb-4">🚉</div>
        <h1 className="text-2xl font-bold mb-2">RailBoard</h1>
        <p className="text-slate-400">{error}</p>
      </div>
    </div>
  );
  if (!screen) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const type = screen.display_type;
  const lang = (screen.language || "ca") as Language;
  const rows = board.slice(0, screen.max_rows || 10);
  const bgColor =
    type === "PLATFORM" || type === "TRAIN_INFO" || type === "CLOCK" ? "#0a1642" : "#0f172a";
  const scale = 0.85 * (screen.font_scale || 1);

  const content = (
      type === "PLATFORM" ? (
        <PlatformDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "CLOCK" ? (
        <ClockDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "TRAIN_INFO" ? (
        <TrainInfoDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "DISRUPTIONS" ? (
        <DisruptionsDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "BUS" ? (
        <BUSTERMDisplay screen={screen} rows={rows} lang={lang} type={type} clock={clock} />
      ) : (
        <BoardDisplay screen={screen} rows={rows} lang={lang} type={type} clock={clock} />
        )
  );

  return (
    <div className="h-screen w-screen overflow-hidden text-white" style={{ backgroundColor: bgColor }}>
      {type === "TRAIN_INFO" ? content : <div style={{ width: "100vw", height: "100vh", transform: `scale(${scale})`, transformOrigin: "center center" }}>{content}</div>}
    </div>
  );
}

function VerticalAutoScroll({ children }: { children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    let paused = false;
    let last: number | null = null;
    let pauseTimer: ReturnType<typeof setTimeout> | null = null;
    const PX_PER_SEC = 26;
    const PAUSE_MS = 5000;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (paused) return;
      if (last === null) { last = now; return; }
      const dt = (now - last) / 1000;
      last = now;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      const next = el.scrollTop + PX_PER_SEC * dt;
      if (next >= max) {
        el.scrollTop = max;
        paused = true;
        pauseTimer = setTimeout(() => {
          el.scrollTop = 0;
          paused = false;
          last = null;
        }, PAUSE_MS);
      } else {
        el.scrollTop = next;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (pauseTimer) clearTimeout(pauseTimer);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: "relative", overflowY: "auto", overflowX: "hidden", scrollbarWidth: "none" }}>
      {children}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "clamp(40px, 5vh, 80px)",
          pointerEvents: "none",
          background: "linear-gradient(to bottom, #0a1642, rgba(10,22,66,0))",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "clamp(40px, 5vh, 80px)",
          pointerEvents: "none",
          background: "linear-gradient(to top, #0a1642, rgba(10,22,66,0))",
        }}
      />
    </div>
  );
}

function HeroDestination({ primary, secondary }: { primary: string; secondary?: string | null }) {
  const showSecond = useAlternating(!!secondary);
  const display = secondary && showSecond ? secondary : primary;
  return (
    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
      <ScrollText
        text={display}
        color="#FFFFFF"
        fontSize="clamp(36px, 4vw, 80px)"
        fontWeight={700}
        fontFamily="'Roboto Condensed', 'Oswald', Arial, sans-serif"
      />
    </div>
  );
}

function TrainHero({ screen, rows, lang, clock }: BoardProps) {
  const train = rows[0];
  const stops = train ? normalizeStops(train.stops) : [];
  const delayed = train ? isDelayed(train) : false;
  const cancelled = train?.status === "Cancelled";
  const headerTime = train ? train.expected_time || train.scheduled_time : "";
  const journeyEndTime = stops.length > 0 ? stops[stops.length - 1].time : null;
  const progress = train ? computeJourneyProgress(train.scheduled_time, journeyEndTime, clock) : null;

  const stationName = screen.station_name || "";
  const stationLogo = screen.station_logo_url ? fileUrl(screen.station_logo_url) || "/adif.svg" : "/adif.svg";

  if (!train) {
    return (
      <div className="h-screen flex flex-col overflow-hidden text-white" style={{ backgroundColor: "#0a1642" }}>
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <img src={stationLogo} alt={stationName} style={{ height: "clamp(40px, 4vw, 80px)", width: "auto", objectFit: "contain" }} onError={onImgError} />
          <div className="text-2xl md:text-4xl text-slate-600">{t("no-train-info", lang)}</div>
        </div>
      </div>
    );
  }

  const isCommuter = train.type_code && /^([A-Z]{2,3}-)?C(-\d+[A-Z]?|\d+[A-Z]?)?$|^R\d*[A-Z]?$/i.test(train.type_code);
  const iconMode = train.icon_mode || "destination";
  let iconUrl: string | undefined | null = null;
  if (iconMode === "custom") iconUrl = train.custom_icon_url;
  else if (iconMode === "destination") iconUrl = train.type_destination_icon || (isCommuter ? null : train.operator_logo);
  else if (iconMode === "type") iconUrl = train.type_logo;
  else if (iconMode === "operator") iconUrl = train.operator_logo;

  return (
    <div className="h-screen flex flex-col overflow-hidden text-white" style={{ backgroundColor: "#0a1642" }}>
      {/* Hero: logo estación + hora + insignia/icono/destino + logos/número/vía */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(12px, 1.5vw, 30px)",
          padding: "clamp(14px, 1.6vh, 26px) clamp(12px, 1.5vw, 30px)",
          backgroundColor: "rgba(255,255,255,0.04)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img
            src={stationLogo}
            alt={stationName}
            style={{ height: "clamp(36px, 3.4vw, 68px)", width: "auto", flexShrink: 0, objectFit: "contain" }}
            onError={onImgError}
          />
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "clamp(6px, 0.8vw, 16px)", flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(40px, 4.5vw, 90px)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
              color: delayed ? "#FBBF24" : "#FFFFFF",
              whiteSpace: "nowrap",
            }}
          >
            {formatDisplayTime(headerTime)}
          </span>
          {delayed && (
            <span
              style={{
                fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
                fontWeight: 700,
                fontSize: "clamp(18px, 1.8vw, 36px)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: "rgba(255,255,255,0.45)",
                textDecoration: "line-through",
                whiteSpace: "nowrap",
              }}
            >
              {formatDisplayTime(train.scheduled_time)}
            </span>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "clamp(8px, 0.8vw, 16px)",
            opacity: cancelled ? 0.45 : 1,
          }}
        >
          {isCommuter && train.type_code && <LineBadge code={train.type_code} color={train.type_color} />}
          {iconUrl && (
            <img
              src={fileUrl(iconUrl)!}
              alt=""
              style={{ height: "clamp(24px, 2.4vw, 48px)", width: "auto", flexShrink: 0, objectFit: "contain" }}
              onError={onImgError}
            />
          )}
          <HeroDestination primary={train.destination} secondary={train.destination2} />
          {cancelled && (
            <span
              style={{
                fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
                fontWeight: 700,
                fontSize: "clamp(18px, 1.8vw, 36px)",
                lineHeight: 1,
                color: "#F87171",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              {t("cancelled", lang)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1vw, 20px)", flexShrink: 0 }}>
          {(train.type_logo || train.operator_logo) && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(2px, 0.3vw, 6px)" }}>
              {train.type_logo && (
                <img src={fileUrl(train.type_logo) || ""} alt="" style={{ height: "clamp(24px, 2.4vw, 48px)", objectFit: "contain" }} onError={onImgError} />
              )}
              {train.operator_logo && (
                <img src={fileUrl(train.operator_logo) || ""} alt="" style={{ height: "clamp(18px, 1.8vw, 36px)", objectFit: "contain", opacity: 0.8 }} onError={onImgError} />
              )}
            </div>
          )}
          <div style={{ textAlign: "right", lineHeight: 1 }}>
            <div
              style={{
                fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace",
                fontWeight: 600,
                fontSize: "clamp(22px, 2.2vw, 44px)",
                fontVariantNumeric: "tabular-nums",
                color: "#FFFFFF",
              }}
            >
              {train.number}
            </div>
            {train.number2 && (
              <div style={{ fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace", fontSize: "clamp(13px, 1.3vw, 26px)", color: "rgba(255,255,255,0.7)" }}>
                {train.number2}
              </div>
            )}
          </div>
          {train.platform && train.platform !== "-" && (
            <div style={{ borderLeft: "4px solid #6EE7B7", paddingLeft: "clamp(10px, 1vw, 20px)" }}>
              <div
                style={{
                  fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
                  fontWeight: 700,
                  fontSize: "clamp(40px, 4.5vw, 90px)",
                  lineHeight: 1,
                  color: "#FFFFFF",
                }}
              >
                {train.platform}
              </div>
              {train.sector && train.sector !== "-" && (
                <div style={{ fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif", fontSize: "clamp(14px, 1.4vw, 28px)", color: "rgba(255,255,255,0.7)", marginTop: "clamp(2px, 0.3vh, 6px)" }}>
                  {train.sector}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lista de estaciones con auto-scroll */}
      <VerticalAutoScroll>
        <div style={{ padding: "clamp(16px, 2vh, 32px) clamp(12px, 1.5vw, 30px)", paddingBottom: "clamp(32px, 4vh, 64px)" }}>
          {stops.length > 0 && (
            <div className="relative">
              <div className="absolute left-[7px] md:left-[9px] top-3 bottom-3 w-0.5 bg-white/25" />
              {stops.map((stop, i) => (
                <div key={i} className="relative flex items-center gap-4 md:gap-6 py-2.5 md:py-4">
                  <div className="w-16 md:w-24 shrink-0 text-right text-lg md:text-3xl font-bold tabular-nums text-white">
                    {stop.time || ""}
                  </div>
                  <div className="w-3.5 h-3.5 md:w-5 md:h-5 rounded-full bg-white shrink-0 z-10" />
                  <div className="text-lg md:text-3xl font-semibold text-white truncate">{stop.station}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </VerticalAutoScroll>

      {progress != null && (
        <div className="px-5 md:px-10 pb-6 md:pb-10 pt-4 flexShrink-0">
          <div className="flex gap-1 md:gap-1.5">
            {Array.from({ length: PROGRESS_SEGMENTS }).map((_, i) => (
              <div
                key={i}
                className={`h-3 md:h-4 flex-1 rounded-full ${i / PROGRESS_SEGMENTS < progress ? "bg-emerald-300" : "bg-white/10"}`}
              />
            ))}
          </div>
        </div>
      )}

      {train.observations && (
        <div className="px-5 md:px-10 pb-6 text-sm md:text-base text-amber-300 flexShrink-0">{train.observations}</div>
      )}
    </div>
  );
}

function PlatformDisplay(props: BoardProps) {
  return <TrainHero {...props} />;
}

function TrainInfoDisplay({ screen, rows, lang, clock }: BoardProps) {
  const train = selectTrainInfoTrain(rows, screen, clock);
  return <TrainJourneyDisplay train={train} lang={lang} clock={clock} />;
}

function ClockDisplay({ screen, clock }: BoardProps) {
  const hhmm = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const ss = String(clock.getSeconds()).padStart(2, "0");
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-10 md:gap-16 px-6"
      style={{ backgroundColor: "#0a1642" }}
    >
      {screen.station_logo_url ? (
        <img
          src={fileUrl(screen.station_logo_url) || ""}
          alt={screen.station_name || screen.name}
          className="h-20 md:h-36 w-auto object-contain"
          onError={onImgError}
        />
      ) : screen.station_name ? (
        <div className="text-3xl md:text-5xl font-bold text-white tracking-wide text-center">{screen.station_name}</div>
      ) : null}

      <div className="flex items-end leading-none text-white tabular-nums font-bold">
        <span className="text-[16vw] md:text-[11rem]">{hhmm}</span>
        <span className="text-[7vw] md:text-[4.75rem] ml-1 md:ml-2 mb-1 md:mb-3 opacity-90">:{ss}</span>
      </div>
    </div>
  );
}

function DisruptionsDisplay({ screen, rows, lang, clock }: BoardProps) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const disruptedRows = rows.filter((r: any) => r.status === "Cancelled" || r.status === "Delayed" || (r.observations && r.observations.length > 0));
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-8 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-3xl font-bold tracking-wider text-red-400">{t("disruptions", lang)}</h1>
          {screen.station_name && <span className="text-sm md:text-lg text-slate-400">{screen.station_name}</span>}
        </div>
        <div className="text-xl md:text-3xl font-bold tabular-nums text-slate-300">{now}</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {disruptedRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-lg">{t("no-disruptions", lang)}</div>
        ) : (
          disruptedRows.map((row: any, i: number) => (
            <div key={row.id || i} className={`py-3 md:py-4 border-b border-slate-800 ${row.status === "Cancelled" ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 mb-1">
                <StatusBadge status={row.status} lang={lang} variant="mini" />
                <span className="font-bold text-slate-200">{row.number}</span>
                <span className="text-slate-400">{row.destination}</span>
              </div>
              <div className="text-sm text-slate-500">
                {t("scheduled", lang)}: {formatDisplayTime(row.scheduled_time)}
                {row.expected_time && row.expected_time !== row.scheduled_time && (
                  <span className="text-orange-400 ml-2">{t("new-time", lang)} {formatDisplayTime(row.expected_time)}</span>
                )}
              </div>
              {row.observations && <div className="text-sm text-yellow-400 mt-1">{row.observations}</div>}
              {row.platform && <div className="text-sm text-slate-500 mt-1">{platText(row, lang)}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BoardDisplay({ screen, rows, lang, type, clock }: { screen: DisplayScreen; rows: any[]; lang: Language; type: string; clock: Date }) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const title = type === "ARRIVALS"
    ? t("arrivals", lang)
    : type === "CUSTOM"
    ? (screen.name || t("departures", lang))
    : t("departures", lang);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-3 md:p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-6 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-3xl font-bold tracking-wider uppercase text-yellow-300">{title}</h1>
          {screen.station_name && (
            <span className="text-sm md:text-lg text-slate-400 hidden sm:inline">{screen.station_name}</span>
          )}
        </div>
        <div className="text-xl md:text-3xl font-bold tabular-nums text-slate-300">{now}</div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[0.7fr_1.2fr_0.8fr_0.5fr] md:grid-cols-[0.5fr_0.8fr_2fr_0.6fr_0.5fr] gap-2 md:gap-4 px-2 py-1.5 text-xs md:text-sm font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700">
        <span>{t("time", lang)}</span>
        <span className="hidden md:inline">{t("train", lang)}</span>
        <span>{t("destination", lang)}</span>
        <span>{t("platform-abbr", lang)}</span>
        <span className="text-right">{t("status", lang)}</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-lg">{t("no-trains", lang)}</div>
        ) : (
          rows.map((row: any, i: number) => (
            <div key={row.id || i}
              className={`grid grid-cols-[0.7fr_1.2fr_0.8fr_0.5fr] md:grid-cols-[0.5fr_0.8fr_2fr_0.6fr_0.5fr] gap-2 md:gap-4 px-2 py-2 md:py-3 items-center border-b border-slate-800 text-sm md:text-base ${
                isDepartedOrCancelled(row) ? "opacity-40" : ""
              } ${isDelayed(row) ? "bg-red-900/10" : ""}`}
            >
              <div className="tabular-nums">
                <span className={isDelayed(row) ? "text-red-400" : "text-white"}>
                  {formatDisplayTime(row.expected_time || row.scheduled_time)}
                </span>
                {isDelayed(row) && row.expected_time !== row.scheduled_time && (
                  <span className="text-xs text-red-500 line-through ml-1 hidden md:inline">{formatDisplayTime(row.scheduled_time)}</span>
                )}
              </div>
              <div className="hidden md:flex items-center gap-1.5 min-w-0">
                {row.type_logo && (
                  <img src={fileUrl(row.type_logo) || ""} alt="" className="h-4 opacity-60 shrink-0" onError={onImgError} />
                )}
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="truncate text-slate-300">{row.number || ""}</span>
                  {row.number2 && <span className="truncate text-xs text-slate-500">{row.number2}</span>}
                </div>
              </div>
              <AltValue primary={row.destination || ""} secondary={row.destination2} className="truncate font-medium text-white" />
              <div className="tabular-nums text-slate-400">{platText(row, lang)}</div>
              <div className="text-right">
                <StatusBadge status={row.status} lang={lang} variant="sm" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-800 text-xs text-slate-600 flex items-center justify-between">
        <span>{screen.name || "RailBoard"}</span>
        <span>RailBoard · {screen.station_name || ""}</span>
      </div>
    </div>
  );
}

function BUSTERMDisplay({ screen, rows, lang, type, clock }: { screen: DisplayScreen; rows: any[]; lang: Language; type: string; clock: Date }) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const title = type === "ARRIVALS" ? t("arrivals", lang) : t("departures", lang);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-3 md:p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-6 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-3xl font-bold tracking-wider uppercase text-yellow-300">{title}</h1>
          {screen.station_name && (
            <span className="text-sm md:text-lg text-slate-400 hidden sm:inline">{screen.station_name}</span>
          )}
        </div>
        <div className="text-xl md:text-3xl font-bold tabular-nums text-slate-300">{now}</div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[0.7fr_1.1fr_1.4fr_0.6fr_0.6fr_0.5fr] md:grid-cols-[0.5fr_0.7fr_1.8fr_0.6fr_0.6fr_0.5fr] gap-2 md:gap-4 px-2 py-1.5 text-xs md:text-sm font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700">
        <span>{t("time", lang)}</span>
        <span>{t("line", lang)}</span>
        <span>{t("destination", lang)}</span>
        <span>{t("floor", lang)}</span>
        <span>{t("dock", lang)}</span>
        <span className="text-right">{t("status", lang)}</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-lg">{t("no-services", lang)}</div>
        ) : (
          rows.map((row: any, i: number) => (
            <div key={row.id || i}
              className={`grid grid-cols-[0.7fr_1.1fr_1.4fr_0.6fr_0.6fr_0.5fr] md:grid-cols-[0.5fr_0.7fr_1.8fr_0.6fr_0.6fr_0.5fr] gap-2 md:gap-4 px-2 py-2 md:py-3 items-center border-b border-slate-800 text-sm md:text-base ${
                isDepartedOrCancelled(row) ? "opacity-40" : ""
              } ${isDelayed(row) ? "bg-red-900/10" : ""}`}
            >
              <div className="tabular-nums">
                <span className={isDelayed(row) ? "text-red-400" : "text-white"}>
                  {formatDisplayTime(row.expected_time || row.scheduled_time)}
                </span>
                {isDelayed(row) && row.expected_time !== row.scheduled_time && (
                  <span className="text-xs text-red-500 line-through ml-1 hidden md:inline">{formatDisplayTime(row.scheduled_time)}</span>
                )}
              </div>
              <div className="truncate text-slate-300">{row.number || "—"}</div>
              <AltValue primary={row.destination || ""} secondary={row.destination2} className="truncate font-medium text-white" />
              <div className="tabular-nums text-slate-400">{row.platform && row.platform !== "-" ? row.platform : ""}</div>
              <div className="tabular-nums text-slate-400">{row.sector && row.sector !== "-" ? row.sector : ""}</div>
              <div className="text-right">
                <StatusBadge status={row.status} lang={lang} variant="sm" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="pt-2 border-t border-slate-800 text-xs text-slate-600 flex items-center justify-between">
        <span>{screen.name || "RailBoard"}</span>
        <span>RailBoard · {screen.station_name || ""}</span>
      </div>
    </div>
  );
}