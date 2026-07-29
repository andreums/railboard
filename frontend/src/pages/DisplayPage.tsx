import { useEffect, useState, useRef, useCallback } from "react";
import { api, fileUrl, connectWS, type DisplayScreen } from "../lib/api";
import { useParams, Navigate } from "react-router-dom";
import { useAlternating } from "../lib/useAlternating";
const onImgError = (e: React.SyntheticEvent<HTMLImageElement>) => { (e.target as HTMLImageElement).style.display = "none"; };

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
  const lang = screen.language || "ca";
  const rows = board.slice(0, screen.max_rows || 10);

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden" style={{ fontSize: `${0.85 * (screen.font_scale || 1)}rem` }}>
      {type === "PLATFORM" ? (
        <PlatformDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "CLOCK" ? (
        <ClockDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "TRAIN_INFO" ? (
        <TrainInfoDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : type === "DISRUPTIONS" ? (
        <DisruptionsDisplay screen={screen} rows={rows} lang={lang} clock={clock} />
      ) : (
        <BoardDisplay screen={screen} rows={rows} lang={lang} type={type} clock={clock} />
      )}
    </div>
  );
}

function PlatformDisplay({ screen, rows, lang, clock }: { screen: DisplayScreen; rows: any[]; lang: string; clock: Date }) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const train = rows[0];
  const upcoming = rows.slice(1, 4);
  const isLandscape = screen.orientation === "LANDSCAPE";

  return (
    <div className={`min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col ${isLandscape ? "" : ""}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl md:text-3xl font-bold text-slate-300 tabular-nums">{now}</span>
          {screen.station_name && (
            <span className="text-lg md:text-xl text-slate-400 hidden sm:inline">{screen.station_name}</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg md:text-xl text-slate-400">{screen.name}</div>
        </div>
      </div>

      {/* Train info */}
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
              {lang === "ca" ? "Nova hora:" : lang === "es" ? "Nueva hora:" : "New time:"} {formatDisplayTime(train.expected_time)}
            </div>
          )}

          <AltValue primary={train.destination} secondary={train.destination2} className="text-3xl md:text-6xl font-bold text-yellow-300 mb-4 md:mb-6" containerClass="mb-4 md:mb-6" />

          {train.platform && (
            <div className="flex items-center gap-4 md:gap-6 text-2xl md:text-4xl font-bold mb-4">
              <span className="text-blue-300">
                {lang === "ca" ? "VIA" : lang === "es" ? "VÍA" : "PLATFORM"} {train.platform}
              </span>
              {train.sector && <span className="text-slate-400">· {train.sector}</span>}
            </div>
          )}

          {/* Status badge */}
          <div className={`inline-flex px-4 md:px-6 py-2 rounded-full text-lg md:text-xl font-bold ${
            train.status === "Departed" ? "bg-slate-700 text-slate-300" :
            train.status === "Cancelled" ? "bg-red-900 text-red-200" :
            train.status === "Delayed" ? "bg-orange-900 text-orange-200" :
            train.status === "Boarding" ? "bg-green-900 text-green-200" :
            train.status === "Arrived" ? "bg-blue-900 text-blue-200" :
            "bg-blue-900 text-blue-200"
          }`}>
            {train.status === "Scheduled" ? (lang === "ca" ? "Programat" : lang === "es" ? "Programado" : "Scheduled") :
             train.status === "Approaching" ? (lang === "ca" ? "Aproximant-se" : lang === "es" ? "Aproximándose" : "Approaching") :
             train.status === "Arriving" ? (lang === "ca" ? "Entrant" : lang === "es" ? "Entrando" : "Arriving") :
             train.status === "Boarding" ? (lang === "ca" ? "Embarque" : lang === "es" ? "Embarque" : "Boarding") :
             train.status === "Delayed" ? (lang === "ca" ? `Retard ${train.delay_minutes || ""} min` : lang === "es" ? `Retraso ${train.delay_minutes || ""} min` : `Delayed ${train.delay_minutes || ""} min`) :
             train.status === "Cancelled" ? (lang === "ca" ? "Cancel·lat" : lang === "es" ? "Cancelado" : "Cancelled") :
             train.status === "Departed" ? (lang === "ca" ? "Sortit" : lang === "es" ? "Salido" : "Departed") :
             train.status}
          </div>

          {/* Stops */}
          {train.stops && train.stops.length > 0 && (
            <div className="mt-6 md:mt-8 text-sm md:text-base text-slate-400 max-w-lg">
              <div className="font-semibold text-slate-300 mb-1">
                {lang === "ca" ? "Parades:" : lang === "es" ? "Paradas:" : "Stops:"}
              </div>
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
          {lang === "ca" ? "Sense informació de tren" : lang === "es" ? "Sin información de tren" : "No train information"}
        </div>
      )}

      {/* Upcoming trains */}
      {upcoming.length > 0 && (
        <div className="mt-auto pt-4 border-t border-slate-700">
          <div className="text-xs md:text-sm text-slate-400 mb-2">
            {lang === "ca" ? "Pròxims trens" : lang === "es" ? "Próximos trenes" : "Upcoming trains"}
          </div>
          <div className="space-y-1">
            {upcoming.map((row: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs md:text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums text-slate-300">{formatDisplayTime(row.scheduled_time)}</span>
                  <AltValue primary={row.destination || ""} secondary={row.destination2} className="text-slate-400 truncate" />
                </div>
                <span className="text-slate-500">{row.platform ? `V${row.platform}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClockDisplay({ screen, rows, lang, clock }: { screen: DisplayScreen; rows: any[]; lang: string; clock: Date }) {
  const time = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const date = clock.toLocaleDateString(lang === "ca" ? "ca-ES" : lang === "es" ? "es-ES" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
          <div className="text-sm text-slate-500 uppercase tracking-wider mb-3 text-center">
            {lang === "ca" ? "Pròxims trens" : lang === "es" ? "Próximos trenes" : "Next trains"}
          </div>
          {nextTrains.map((row: any, i: number) => (
            <div key={row.id || i} className="flex items-center justify-between py-2 border-b border-slate-800 text-lg">
              <div className="tabular-nums text-slate-300">{formatDisplayTime(row.scheduled_time)}</div>
              <AltValue primary={row.destination || ""} secondary={row.destination2} className="text-slate-400 truncate mx-4 flex-1 text-center" containerClass="mx-4 flex-1 text-center" />
              <div className="text-slate-500">{row.platform ? `V${row.platform}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainInfoDisplay({ screen, rows, lang, clock }: { screen: DisplayScreen; rows: any[]; lang: string; clock: Date }) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const train = rows[0];
  const upcoming = rows.slice(1, 4);
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-8">
        <div className="flex items-center gap-3">
          <span className="text-2xl md:text-3xl font-bold text-slate-300 tabular-nums">{now}</span>
          {screen.station_name && <span className="text-lg md:text-xl text-slate-400">{screen.station_name}</span>}
        </div>
        <div className="text-right text-lg md:text-xl text-slate-400">{screen.name}</div>
      </div>
      {train ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3 md:gap-6 mb-4">
            {train.type_logo && <img src={fileUrl(train.type_logo) || ""} alt="" className="h-8 md:h-12 opacity-80" onError={onImgError} />}
            {train.operator_logo && <img src={fileUrl(train.operator_logo) || ""} alt="" className="h-6 md:h-10 opacity-60" onError={onImgError} />}
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
              {lang === "ca" ? "Nova hora:" : lang === "es" ? "Nueva hora:" : "New time:"} {formatDisplayTime(train.expected_time)}
            </div>
          )}
          <AltValue primary={train.destination} secondary={train.destination2} className="text-3xl md:text-6xl font-bold text-yellow-300 mb-4 md:mb-6" containerClass="mb-4 md:mb-6" />
          <div className="flex items-center gap-4 md:gap-6 text-2xl md:text-4xl font-bold mb-4">
            <span className="text-blue-300">
              {lang === "ca" ? "VIA" : lang === "es" ? "VÍA" : "PLATFORM"} {train.platform}
            </span>
            {train.sector && <span className="text-slate-400">· {train.sector}</span>}
          </div>
          <div className={`inline-flex px-4 md:px-6 py-2 rounded-full text-lg md:text-xl font-bold ${
            train.status === "Departed" ? "bg-slate-700 text-slate-300" :
            train.status === "Cancelled" ? "bg-red-900 text-red-200" :
            train.status === "Delayed" ? "bg-orange-900 text-orange-200" :
            train.status === "Boarding" ? "bg-green-900 text-green-200" :
            train.status === "Arrived" ? "bg-blue-900 text-blue-200" :
            "bg-blue-900 text-blue-200"
          }`}>
            {train.status === "Scheduled" ? (lang === "ca" ? "Programat" : lang === "es" ? "Programado" : "Scheduled") :
             train.status === "Approaching" ? (lang === "ca" ? "Aproximant-se" : lang === "es" ? "Aproximándose" : "Approaching") :
             train.status === "Arriving" ? (lang === "ca" ? "Entrant" : lang === "es" ? "Entrando" : "Arriving") :
             train.status === "Boarding" ? (lang === "ca" ? "Embarque" : lang === "es" ? "Embarque" : "Boarding") :
             train.status === "Delayed" ? (lang === "ca" ? `Retard ${train.delay_minutes || ""} min` : lang === "es" ? `Retraso ${train.delay_minutes || ""} min` : `Delayed ${train.delay_minutes || ""} min`) :
             train.status === "Cancelled" ? (lang === "ca" ? "Cancel·lat" : lang === "es" ? "Cancelado" : "Cancelled") :
             train.status === "Departed" ? (lang === "ca" ? "Sortit" : lang === "es" ? "Salido" : "Departed") :
             train.status}
          </div>
          {train.stops && train.stops.length > 0 && (
            <div className="mt-6 md:mt-8 text-sm md:text-base text-slate-400 max-w-lg">
              <div className="font-semibold text-slate-300 mb-1">
                {lang === "ca" ? "Parades:" : lang === "es" ? "Paradas:" : "Stops:"}
              </div>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                {(typeof train.stops === "string" ? train.stops.split(/[·|;/\n]+/g).map((s: string) => s.trim()).filter(Boolean) : train.stops).map((stop: string, i: number) => (
                  <span key={i} className="text-slate-400">{stop}{i < (typeof train.stops === "string" ? train.stops.split(/[·|;/\n]+/g).map((s: string) => s.trim()).filter(Boolean).length : train.stops).length - 1 ? " ·" : ""}</span>
                ))}
              </div>
            </div>
          )}
          {train.observations && <div className="mt-4 text-sm md:text-base text-yellow-400">{train.observations}</div>}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-2xl md:text-4xl text-slate-600">
          {lang === "ca" ? "Sense informació de tren" : lang === "es" ? "Sin información de tren" : "No train information"}
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="mt-auto pt-4 border-t border-slate-700">
          <div className="text-xs md:text-sm text-slate-400 mb-2">
            {lang === "ca" ? "Pròxims trens" : lang === "es" ? "Próximos trenes" : "Upcoming trains"}
          </div>
          <div className="space-y-1">
            {upcoming.map((row: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-xs md:text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono tabular-nums text-slate-300">{formatDisplayTime(row.scheduled_time)}</span>
                  <AltValue primary={row.destination || ""} secondary={row.destination2} className="text-slate-400 truncate" />
                </div>
                <span className="text-slate-500">{row.platform ? `V${row.platform}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DisruptionsDisplay({ screen, rows, lang, clock }: { screen: DisplayScreen; rows: any[]; lang: string; clock: Date }) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const disruptedRows = rows.filter((r: any) => r.status === "Cancelled" || r.status === "Delayed" || (r.observations && r.observations.length > 0));
  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 flex flex-col">
      <div className="flex items-center justify-between mb-4 md:mb-8 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-3xl font-bold tracking-wider text-red-400">
            {lang === "ca" ? "INCIDÈNCIES" : lang === "es" ? "INCIDENCIAS" : "DISRUPTIONS"}
          </h1>
          {screen.station_name && <span className="text-sm md:text-lg text-slate-400">{screen.station_name}</span>}
        </div>
        <div className="text-xl md:text-3xl font-bold tabular-nums text-slate-300">{now}</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {disruptedRows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-lg">
            {lang === "ca" ? "No hi ha incidències" : lang === "es" ? "No hay incidencias" : "No disruptions"}
          </div>
        ) : (
          disruptedRows.map((row: any, i: number) => (
            <div key={row.id || i} className={`py-3 md:py-4 border-b border-slate-800 ${row.status === "Cancelled" ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 mb-1">
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                  row.status === "Cancelled" ? "bg-red-900 text-red-200" : "bg-orange-900 text-orange-200"
                }`}>
                  {row.status === "Cancelled"
                    ? (lang === "ca" ? "Cancel·lat" : lang === "es" ? "Cancelado" : "Cancelled")
                    : (lang === "ca" ? "Retard" : lang === "es" ? "Retraso" : "Delayed")}
                </span>
                <span className="font-bold text-slate-200">{row.number}</span>
                <span className="text-slate-400">{row.destination}</span>
              </div>
              <div className="text-sm text-slate-500">
                {lang === "ca" ? "Programat:" : lang === "es" ? "Programado:" : "Scheduled:"} {formatDisplayTime(row.scheduled_time)}
                {row.expected_time && row.expected_time !== row.scheduled_time && (
                  <span className="text-orange-400 ml-2">
                    {lang === "ca" ? "Nova hora:" : lang === "es" ? "Nueva hora:" : "New time:"} {formatDisplayTime(row.expected_time)}
                  </span>
                )}
              </div>
              {row.observations && <div className="text-sm text-yellow-400 mt-1">{row.observations}</div>}
              {row.platform && <div className="text-sm text-slate-500 mt-1">{lang === "ca" ? "VIA" : lang === "es" ? "VÍA" : "Platform"} {row.platform}</div>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BoardDisplay({ screen, rows, lang, type, clock }: { screen: DisplayScreen; rows: any[]; lang: string; type: string; clock: Date }) {
  const now = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
  const title = type === "ARRIVALS"
    ? (lang === "ca" ? "LLEGADES" : lang === "es" ? "LLEGADAS" : "ARRIVALS")
    : type === "CUSTOM"
    ? (screen.name || "INFORMACIÓ")
    : (lang === "ca" ? "SORTIDES" : lang === "es" ? "SALIDAS" : "DEPARTURES");

  return (
    <div className="min-h-screen bg-slate-900 text-white p-3 md:p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 md:mb-6 pb-2 border-b border-slate-700">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-xl md:text-3xl font-bold tracking-wider text-yellow-300">{title}</h1>
          {screen.station_name && (
            <span className="text-sm md:text-lg text-slate-400 hidden sm:inline">{screen.station_name}</span>
          )}
        </div>
        <div className="text-xl md:text-3xl font-bold tabular-nums text-slate-300">{now}</div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[0.7fr_1.2fr_0.8fr_0.5fr] md:grid-cols-[0.5fr_0.8fr_2fr_0.6fr_0.5fr] gap-2 md:gap-4 px-2 py-1.5 text-xs md:text-sm font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-700">
        <span>{lang === "ca" ? "Hora" : lang === "es" ? "Hora" : "Time"}</span>
        <span className="hidden md:inline">{lang === "ca" ? "Tren" : lang === "es" ? "Tren" : "Train"}</span>
        <span>{lang === "ca" ? "Destí" : lang === "es" ? "Destino" : "Destination"}</span>
        <span>{lang === "ca" ? "VIA" : lang === "es" ? "VÍA" : "PLATFORM"}</span>
        <span className="text-right">{lang === "ca" ? "Estat" : lang === "es" ? "Estado" : "Status"}</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-lg">
            {lang === "ca" ? "No hi ha trens" : lang === "es" ? "No hay trenes" : "No trains"}
          </div>
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
              <div className="tabular-nums text-slate-400">{row.platform ? `V${row.platform}` : ""}</div>
              <div className="text-right">
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                  row.status === "Cancelled" ? "bg-red-900 text-red-200" :
                  row.status === "Delayed" ? "bg-orange-900 text-orange-200" :
                  row.status === "Boarding" ? "bg-green-900 text-green-200" :
                  row.status === "Departed" ? "bg-slate-700 text-slate-300" :
                  row.status === "Arrived" ? "bg-blue-900 text-blue-200" :
                  "bg-blue-900/50 text-blue-200"
                }`}>
                  {row.status === "Scheduled" ? "" :
                   row.status === "Delayed" ? (lang === "ca" ? "R" : lang === "es" ? "R" : "DEL") :
                   row.status === "Cancelled" ? (lang === "ca" ? "C" : lang === "es" ? "C" : "CAN") :
                   row.status === "Boarding" ? (lang === "ca" ? "E" : lang === "es" ? "E" : "BRD") :
                   row.status === "Departed" ? (lang === "ca" ? "S" : lang === "es" ? "S" : "DEP") :
                   row.status === "Arrived" ? (lang === "ca" ? "A" : lang === "es" ? "A" : "ARR") :
                   ""}
                </span>
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
