import { useEffect, useMemo, useState } from "react";
import { api, connectWS, fileUrl, type Config, type Train } from "../lib/api";
import Clock from "../components/Clock";
import StatusPill from "../components/StatusPill";
import { t, type Language } from "../lib/i18n";

function minutesUntil(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const t = new Date(now);
  t.setHours(h, m, 0, 0);
  let diff = Math.round((t.getTime() - now.getTime()) / 60000);
  if (diff < -60) diff += 24 * 60; // wrap past midnight
  return diff;
}

export default function Display() {
  const [config, setConfig] = useState<Config | null>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [, setTick] = useState(0);

  const refresh = async () => {
    const [c, t] = await Promise.all([api.getConfig(), api.listTrains()]);
    setConfig(c); setTrains(t);
  };

  useEffect(() => {
    refresh();
    const unsub = connectWS(refresh);
    const poll = setInterval(refresh, 5000);
    const tick = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => { unsub(); clearInterval(poll); clearInterval(tick); };
  }, []);

  const mode = config?.mode ?? "departures";
  const lang = (config?.language as Language) ?? "es";

  const rows = useMemo(() => {
    return trains
      .filter((t) => !["Departed", "Arrived"].includes(t.status))
      .slice(0, 12);
  }, [trains]);

  const bgColor = (config?.bgColor as string) || "#050a14";
  const headerBgColor = (config?.headerBgColor as string) || "#BFEFD5";
  const headerTextColor = (config?.headerTextColor as string) || "#f5f3ec";
  const rowBgColor = (config?.rowBgColor as string) || "#1A3254";
  const altBgColor = (config?.altBgColor as string) || "#102341";
  const destinationFontSize = parseInt((config?.destinationFontSize as string) || "48");

  return (
    <div className="min-h-screen text-board-ink font-body flex flex-col" style={{ backgroundColor: bgColor }}>
      {/* Header */}
      <header className="border-b border-white/10 px-10 py-4" style={{ backgroundColor: headerBgColor, color: headerTextColor }}>
        <div className="flex items-end justify-between mb-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-3">
              {config?.logo_url && <img src={config.logo_url} className="h-12" alt="Logo" />}
              <div>
                <span className="font-bold text-white text-sm tracking-widest block">ADIF</span>
                <span className="font-display text-5xl tracking-widest text-board-amber block">
                  {t(mode === "departures" ? "departures" : "arrivals", lang)}
                </span>
              </div>
            </div>
            <h1 className="text-board-dim text-lg tracking-wide">
              {config?.station_name ?? "—"}
            </h1>
          </div>
          <div className="flex items-end gap-20">
            <Clock />
            <div className="text-board-dim text-xs uppercase tracking-[0.3em]">{t("platform", lang)}</div>
          </div>
        </div>
      </header>

      {/* Rows */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 && (
          <div className="text-center text-board-dim py-20 text-xl">
            {t("no-trains", lang)}
          </div>
        )}
        {rows.map((train, i) => {
          const place = mode === "departures" ? train.destination : train.origin;
          const minutes = minutesUntil(train.expected_time);
          const delayed = train.expected_time !== train.scheduled_time;
          return (
            <div
              key={train.id}
              className="grid grid-cols-[110px_1fr_200px_130px_70px] gap-4 px-10 py-4 items-center border-b border-white/5"
              style={{ backgroundColor: i % 2 === 0 ? rowBgColor : altBgColor }}
            >
              {/* Departure time */}
              <div className="font-mono text-center">
                <div className="text-3xl font-bold mb-1">
                  {train.expected_time}
                </div>
              </div>

              {/* Destination + stops */}
              <div className="overflow-hidden flex flex-col gap-1">
                <div className="font-display tracking-wide leading-tight" style={{ fontSize: `${destinationFontSize}px` }}>{place}</div>
                {train.stops?.length > 0 && (
                  <div className="text-board-dim text-sm overflow-x-auto whitespace-nowrap">
                    {train.stops.join(" · ")}
                  </div>
                )}
              </div>

              {/* Train type + number */}
              <div className="flex flex-row items-center gap-2">
                {train.type_logo ? (
                  <img src={fileUrl(train.type_logo)} className="h-8" alt={train.type_code || ""} />
                ) : train.operator_logo ? (
                  <img src={fileUrl(train.operator_logo)} className="h-8" alt={train.operator_name || ""} />
                ) : train.type_code ? (
                  <span
                    className="inline-block self-start text-xs font-bold px-2 py-1 rounded text-white tracking-widest"
                    style={{ backgroundColor: train.type_color || "#7c1d2e" }}
                  >
                    {train.type_code}
                  </span>
                ) : null}
                <span className="font-mono text-board-dim text-sm">{train.number}</span>
              </div>

              {/* Status */}
              <div className="text-center"><StatusPill status={train.status} large /></div>

              {/* Platform */}
              <div className="text-center">
                <div className="font-display text-5xl text-board-amber leading-none">
                  {train.platform}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer ticker */}
      <footer className="border-t border-white/10 bg-black/30 overflow-hidden py-3">
        <div className="whitespace-nowrap animate-marquee flex gap-16 text-board-dim text-sm tracking-widest uppercase">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>
              {t("welcome", lang)} {config?.station_name} · {t("ticket", lang)} · {t("tracks", lang)} · {t("wifi", lang)} · {t("event", lang)}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
