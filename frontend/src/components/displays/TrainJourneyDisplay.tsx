import { useEffect, useState, type SyntheticEvent } from "react";
import { fileUrl } from "../../lib/api";
import { useAlternating } from "../../lib/useAlternating";
import { normalizeStops, type TrainStop } from "../../lib/trainStops";
import { t, type Language } from "../../lib/i18n";
import LineBadge from "../pis/LineBadge";

type JourneyTrain = {
  operator_name?: string | null;
  operator_logo?: string | null;
  type_code?: string | null;
  type_name?: string | null;
  type_color?: string | null;
  type_logo?: string | null;
  number?: string | null;
  number2?: string | null;
  destination?: string | null;
  destination2?: string | null;
  expected_time?: string | null;
  scheduled_time?: string | null;
  stops?: unknown;
  platform?: string | null;
  observations?: string | null;
  status?: string | null;
};

type JourneyScreen = { language: string };
type JourneyProps = { screen: JourneyScreen; rows: JourneyTrain[]; lang: Language; clock: Date };

export function buildStopPages(stops: TrainStop[], visibleRows = 4): TrainStop[][] {
  if (stops.length === 0) return [];
  const pageSize = Math.max(1, visibleRows);
  if (stops.length <= pageSize) return [stops];

  const pages: TrainStop[][] = [];
  const finalStop = stops[stops.length - 1];
  const nextStopCount = Math.max(1, pageSize - 1);
  for (let start = 0; start < stops.length; start += nextStopCount) {
    const page = stops.slice(start, start + nextStopCount);
    if (page[page.length - 1] !== finalStop) page.push(finalStop);
    pages.push(page);
    if (start + nextStopCount >= stops.length - 1) break;
  }
  return pages;
}

export function formatClock(clock: Date) {
  return `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
}

function minutesUntil(time: string | null | undefined, clock: Date) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const current = clock.getHours() * 60 + clock.getMinutes();
  let difference = hours * 60 + minutes - current;
  if (difference < 0) difference += 24 * 60;
  return difference;
}

export function formatStopTime(time?: string) {
  if (!time) return "--:--";
  return time.length >= 5 ? time.slice(0, 5) : time;
}

function imageError(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.display = "none";
}

function OperatorProduct({ train }: { train: JourneyTrain }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "clamp(12px, 1vw, 22px)", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      {train.operator_logo ? (
        <img src={fileUrl(train.operator_logo) || ""} alt={train.operator_name || ""} onError={imageError} style={{ height: "clamp(42px, 4.2vw, 82px)", maxWidth: "clamp(150px, 14vw, 280px)", objectFit: "contain" }} />
      ) : (
        <span style={{ color: "#f7f7f2", fontSize: "clamp(24px, 2.1vw, 42px)", fontWeight: 600 }}>{train.operator_name || ""}</span>
      )}
      <div style={{ fontSize: "clamp(32px, 3.2vw, 64px)", fontWeight: 500, lineHeight: 0.95, whiteSpace: "nowrap", color: "#f7f7f2" }}>
        {train.number || "--"}
        {train.number2 && <span style={{ display: "block", fontSize: "0.48em", opacity: 0.7 }}>{train.number2}</span>}
      </div>
    </div>
  );
}

function TrackPanel({ platform }: { platform?: string | null }) {
  const value = platform && platform !== "-" ? platform : "--";
  return (
    <div style={{ width: "clamp(260px, 21vw, 420px)", height: "27vh", borderLeft: "clamp(6px, 0.5vw, 10px) solid #65d8bc", borderBottom: "clamp(6px, 0.5vw, 10px) solid #65d8bc", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 clamp(12px, 1vw, 24px)", boxSizing: "border-box", overflow: "hidden" }}>
      <span style={{ fontSize: "clamp(140px, 12vw, 250px)", fontWeight: 500, lineHeight: 0.9, letterSpacing: "0.01em", textAlign: "center", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}

function JourneyRows({ stops }: { stops: TrainStop[] }) {
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "clamp(170px, 15vw, 285px) clamp(70px, 6vw, 110px) minmax(0, 1fr)", gridAutoRows: "minmax(clamp(76px, 9.5vh, 150px), 1fr)", alignItems: "center", alignContent: "stretch", minHeight: "100%" }}>
      <div style={{ position: "absolute", left: "calc(clamp(170px, 15vw, 285px) + clamp(35px, 3vw, 55px))", top: "calc(clamp(48px, 4.75vh, 75px) - 4px)", bottom: "calc(clamp(48px, 4.75vh, 75px) - 4px)", width: "clamp(8px, 0.5vw, 10px)", transform: "translateX(-50%)", backgroundColor: "#f5a623" }} />
      {stops.map((stop, index) => (
        <div key={`${stop.station}-${index}`} style={{ display: "contents" }}>
          <div style={{ textAlign: "right", paddingRight: "clamp(12px, 1vw, 24px)", fontSize: "clamp(42px, 4vw, 80px)", fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{formatStopTime(stop.time)}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}><span style={{ width: "clamp(52px, 3.8vw, 60px)", height: "clamp(52px, 3.8vw, 60px)", borderRadius: "50%", backgroundColor: "#f5a623", display: "block" }} /></div>
          <div style={{ minWidth: 0, maxWidth: "100%", fontSize: "clamp(44px, 4.25vw, 86px)", fontWeight: index === stops.length - 1 ? 600 : 400, lineHeight: 1.05, display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", overflowWrap: "break-word" }}>{stop.station}</div>
        </div>
      ))}
    </div>
  );
}

export default function TrainJourneyDisplay({ rows, lang, clock }: JourneyProps) {
  const train = rows[0];
  const stops = normalizeStops(train?.stops);
  const pages = buildStopPages(stops, 4);
  const [pageIndex, setPageIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const showSecondary = useAlternating(Boolean(train?.destination2));

  useEffect(() => {
    setPageIndex(0);
    setVisible(true);
  }, [train?.number, train?.destination, train?.stops]);

  useEffect(() => {
    if (pages.length <= 1) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let transitionTimer: number | undefined;
    const interval = window.setInterval(() => {
      setVisible(false);
      transitionTimer = window.setTimeout(() => {
        setPageIndex((current) => (current + 1) % pages.length);
        setVisible(true);
      }, reduceMotion ? 0 : 250);
    }, 9000);
    return () => {
      window.clearInterval(interval);
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
    };
  }, [pages.length]);

  if (!train) {
    return <div style={{ width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#001b46", color: "#f7f7f2", display: "grid", placeItems: "center", fontSize: "clamp(32px, 4vw, 72px)" }}>{t("no-train-info", lang)}</div>;
  }

  const cancelled = train.status === "Cancelled";
  const activeStops = pages[pageIndex] || [];
  const departureTime = train.expected_time || train.scheduled_time;
  const departureMinutes = minutesUntil(departureTime, clock);
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#001b46", color: "#f7f7f2", fontFamily: "Inter, Arial, \"Helvetica Neue\", sans-serif", display: "flex", flexDirection: "column" }}>
      <header style={{ height: "27vh", flexShrink: 0, display: "grid", gridTemplateColumns: "clamp(250px, 22vw, 440px) minmax(0, 1fr) clamp(260px, 21vw, 420px)", gridTemplateRows: "1fr 1fr", columnGap: "clamp(16px, 2vw, 40px)", alignItems: "center", padding: "clamp(18px, 2.5vh, 36px) clamp(24px, 3vw, 58px) 0", boxSizing: "border-box" }}>
        <div style={{ gridColumn: 1, gridRow: 1, alignSelf: "start", fontSize: "clamp(64px, 6.5vw, 128px)", fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 0.95 }}>{departureMinutes == null ? "-- min" : `${departureMinutes} min`}</div>
        <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden", alignSelf: "start", paddingTop: "clamp(8px, 1vh, 16px)" }}><OperatorProduct train={train} /></div>
        <div style={{ gridColumn: 3, gridRow: "1 / span 2", justifySelf: "end", alignSelf: "start" }}><TrackPanel platform={train.platform} /></div>
        <div style={{ gridColumn: "1 / 3", gridRow: 2, minWidth: 0, display: "flex", alignItems: "center", gap: "clamp(12px, 1vw, 24px)", alignSelf: "center", overflow: "hidden", opacity: cancelled ? 0.45 : 1 }}>
          {train.type_code && <LineBadge code={train.type_code} color={train.type_color} />}
          <div style={{ minWidth: 0, fontSize: "clamp(68px, 7vw, 140px)", fontWeight: 400, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{showSecondary && train.destination2 ? train.destination2 : train.destination || "--"}</div>
        </div>
      </header>
      <main style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", padding: "clamp(8px, 1vh, 16px) clamp(24px, 3vw, 58px) 0", opacity: visible ? 1 : 0, transition: "opacity 250ms ease", ...(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? { transition: "none" } : {}) }}>
        {activeStops.length > 0 ? <JourneyRows stops={activeStops} /> : <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: "clamp(32px, 4vw, 72px)", opacity: 0.7 }}>{train.destination || "--"}</div>}
      </main>
      {(cancelled || train.observations) && <div style={{ flexShrink: 0, padding: "clamp(8px, 1vh, 14px) clamp(24px, 3vw, 58px)", fontSize: "clamp(20px, 1.7vw, 34px)", color: cancelled ? "#ffb4b4" : "#f7f7f2" }}>{cancelled ? t("cancelled", lang) : train.observations}</div>}
    </div>
  );
}