import { useEffect, useState, useRef } from "react";
import { api, fileUrl, connectWS, type DisplayScreen } from "../lib/api";
import { useParams, Navigate } from "react-router-dom";
import { useAlternating } from "../lib/useAlternating";
import { t, type Language } from "../lib/i18n";
const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = "none"; };

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
        setScreen(data.display || data);
        setBoard(data.rows || []);
        setError(null);
      } catch {
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

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden" style={{ zoom: 0.85 * (screen.font_scale || 1) }}>
      {type === "PLATFORM" ? (
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
      )}
    </div>
  );
}

function TopBar({ screen, now, title }: { screen: DisplayScreen; now: string; title?: string }) {
  return (
    <div className="flex items-center justify-between mb-4 md:mb-8">
      <div className="flex items-center gap-3">
        <span className="text-2xl md:text-3xl font-bold text-slate-300 tabular-nums">{now}</span>
        {screen.station_name && (
          <span className="text-lg md:text-xl text-slate-400">{screen.station_name}</span>
        )}
      </div>
      <div className="text-right">
        <div className="text-lg md:text-xl text-slate-400">{title ?? screen.name}</div>
      </div>
    </div>
  );
}

function TrainHero({ screen, rows, lang, clock }: BoardProps) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const train = rows[0];
  const upcoming = rows.slice(1, 4);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col">
      <TopBar screen={screen} now={now} />
      {train ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3 md:gap-6 mb-4">
            {train.type_logo && (
              <img src={fileUrl(train.type_logo) || ""} alt="" className="h-8 md:h-12 opacity-80" onError={onImgError} />
            )}
            {train.operator_logo && (
              <img src={fileUrl(train.operator_logo) || ""} alt="" className="h-6 md:h-10 opacity-60" onError={onImgError} />
            )}
            <div className="flex flex-col items-center leading-tight">
              <span className="text-lg md:text-2xl font-bold text-slate-400">{train.number || ""}</span>
              {train.number2 && <span className="text-sm md:text-base font-bold text-slate-500">{train.number2}</span>}
            </div>
          </div>

          <div className="text-5xl md:text-8xl font-bold text-white mb-2 tabular-nums tracking-tight">
            {formatDisplayTime(train.scheduled_time)}
          </div>

          {isDelayed(train) && train.expected_time && (
            <div className="text-xl md:text-3xl text-red-400 mb-4">
              {t("new-time", lang)} {formatDisplayTime(train.expected_time)}
            </div>
          )}

          <AltValue primary={train.destination} secondary={train.destination2} className="text-3xl md:text-6xl font-bold text-yellow-300 mb-4 md:mb-6" containerClass="mb-4 md:mb-6" />

          {train.platform && (
            <div className="flex items-center gap-4 md:gap-6 text-2xl md:text-4xl font-bold mb-4">
              <span className="text-blue-300">{platText(train, lang)}</span>
              {train.sector && <span className="text-slate-400">· {train.sector}</span>}
            </div>
          )}

          <StatusBadge status={train.status} lang={lang} variant="lg" delayMinutes={train.delay_minutes} />

          {train.stops && train.stops.length > 0 && (
            <div className="mt-6 md:mt-8 text-sm md:text-base text-slate-400 max-w-lg">
              <div className="font-semibold text-slate-300 mb-1">{t("stops-label", lang)}</div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                {(typeof train.stops === "string" ? train.stops.split(/[·|;/\n]+/g).map((s: string) => s.trim()).filter(Boolean) : train.stops).map((stop: string, i: number) => (
                  <span key={i} className="text-slate-400">{stop}{i < (typeof train.stops === "string" ? train.stops.split(/[·|;/\n]+/g).map((s: string) => s.trim()).filter(Boolean).length : train.stops).length - 1 ? " ·" : ""}</span>
                ))}
              </div>
            </div>
          )}

          {train.observations && (
            <div className="mt-4 text-sm md:text-base text-yellow-400">{train.observations}</div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-2xl md:text-4xl text-slate-600">
          {t("no-train-info", lang)}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mt-auto pt-4 border-t border-slate-700">
          <div className="text-xs md:text-sm text-slate-400 mb-2">{t("upcoming-trains", lang)}</div>
          <div className="space-y-1">
            {upcoming.map((row: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs md:text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums text-slate-300">{formatDisplayTime(row.scheduled_time)}</span>
                  <AltValue primary={row.destination || ""} secondary={row.destination2} className="text-slate-400 truncate" />
                </div>
                <span className="text-slate-500">{platText(row, lang)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformDisplay(props: BoardProps) {
  return <TrainHero {...props} />;
}

function TrainInfoDisplay(props: BoardProps) {
  return <TrainHero {...props} />;
}

function ClockDisplay({ screen, rows, lang, clock }: BoardProps) {
  const time = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const dateLocale = lang === "ca" ? "ca-ES" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "eu" ? "eu-ES" : lang === "gl" ? "gl-ES" : "en-US";
  const date = clock.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const nextTrains = rows.slice(0, 5);
  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="text-8xl md:text-[12rem] font-bold tabular-nums tracking-tight text-white mb-4">{time}</div>
      <div className="text-xl md:text-2xl text-slate-400 capitalize mb-2">{date}</div>
      {screen.station_name && (
        <div className="text-lg md:text-xl text-slate-500 mt-2">{screen.station_name}</div>
      )}
      {nextTrains.length > 0 && (
        <div className="mt-8 md:mt-12 w-full max-w-lg">
          <div className="text-sm text-slate-500 uppercase tracking-wider mb-3 text-center">{t("upcoming-trains", lang)}</div>
          {nextTrains.map((row: any, i: number) => (
            <div key={row.id || i} className="flex items-center justify-between py-2 border-b border-slate-800 text-lg">
              <div className="tabular-nums text-slate-300">{formatDisplayTime(row.scheduled_time)}</div>
              <AltValue primary={row.destination || ""} secondary={row.destination2} className="text-slate-400 truncate mx-4 flex-1 text-center" containerClass="mx-4 flex-1 text-center" />
              <div className="text-slate-500">{platText(row, lang)}</div>
            </div>
          ))}
        </div>
      )}
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