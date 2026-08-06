import { memo, useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { fileUrl } from "../../lib/api";
import { useAlternating } from "../../lib/useAlternating";
import { usePrefersReducedMotion } from "../../lib/usePrefersReducedMotion";
import { normalizeStops, type TrainStop } from "../../lib/trainStops";
import { normalizeTrainStatus, trainStatusLabel } from "../../lib/trainStatus";
import { t, type Language } from "../../lib/i18n";
import { journeyKeyFor, type TrainInfoRow } from "./trainInfoDisplay.selector";
import { buildStopPages, finalStopOf, pagesSignature } from "./trainJourney.pages";
import { computeDepartureCountdown, formatDepartureCountdown } from "./trainJourney.countdown";
import LineBadge from "../pis/LineBadge";

export type JourneyTrain = TrainInfoRow;

type JourneyProps = { train?: JourneyTrain; lang: Language; clock: Date };

const PAGE_DWELL_MS = 9000;
const FADE_MS = 250;
const VISIBLE_ROWS = 4;

const ORANGE = "#f5a623";

export { buildStopPages };

export function formatStopTime(time?: string) {
  if (!time) return "--:--";
  return time.length >= 5 ? time.slice(0, 5) : time;
}

/** <img> that falls back to arbitrary content (text, badge, …) when the src
 * is missing or fails to load, instead of just hiding itself. Resets its
 * error state when the src changes so a later, valid image isn't stuck
 * showing the previous fallback. */
function ImageWithFallback({
  src,
  alt,
  style,
  fallback,
}: {
  src?: string | null;
  alt: string;
  style: React.CSSProperties;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <>{fallback}</>;
  return <img src={src} alt={alt} style={style} onError={() => setFailed(true)} />;
}

const OperatorProduct = memo(function OperatorProduct({ train }: { train: JourneyTrain }) {
  const operatorLogo = fileUrl(train.operator_logo);
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "clamp(12px, 1vw, 22px)", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <ImageWithFallback
        src={operatorLogo}
        alt={train.operator_name || ""}
        style={{ height: "clamp(42px, 4.2vw, 82px)", maxWidth: "clamp(150px, 14vw, 280px)", objectFit: "contain" }}
        fallback={train.operator_name ? <span style={{ color: "#f7f7f2", fontSize: "clamp(24px, 2.1vw, 42px)", fontWeight: 600 }}>{train.operator_name}</span> : null}
      />
      <div style={{ fontSize: "clamp(32px, 3.2vw, 64px)", fontWeight: 500, lineHeight: 0.95, whiteSpace: "nowrap", color: "#f7f7f2" }}>
        {train.number || "--"}
        {train.number2 && <span style={{ display: "block", fontSize: "0.48em", opacity: 0.7 }}>{train.number2}</span>}
      </div>
    </div>
  );
});

// Product/line indicator: type_logo > type_name > type_code (as LineBadge).
// Never fully hidden just because type_code is missing.
const ProductIndicator = memo(function ProductIndicator({ train }: { train: JourneyTrain }) {
  const typeLogo = fileUrl(train.type_logo);
  const textFallback = train.type_code ? (
    <LineBadge code={train.type_code} color={train.type_color} />
  ) : train.type_name ? (
    <span style={{ color: "#f7f7f2", fontSize: "clamp(28px, 2.6vw, 52px)", fontWeight: 500 }}>{train.type_name}</span>
  ) : null;
  if (!typeLogo) return <>{textFallback}</>;
  return (
    <ImageWithFallback
      src={typeLogo}
      alt={train.type_name || train.type_code || ""}
      style={{ height: "clamp(46px, 4.4vw, 88px)", objectFit: "contain" }}
      fallback={textFallback}
    />
  );
});

const TrackPanel = memo(function TrackPanel({ platform }: { platform?: string | null }) {
  const trimmed = (platform ?? "").trim();
  const value = trimmed && trimmed !== "-" ? trimmed : "--";
  const long = value.length > 3;
  return (
    <div
      style={{
        width: "clamp(260px, 21vw, 420px)",
        height: "100%",
        boxSizing: "border-box",
        borderLeft: "clamp(6px, 0.5vw, 10px) solid #65d8bc",
        borderBottom: "clamp(6px, 0.5vw, 10px) solid #65d8bc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 clamp(12px, 1vw, 24px)",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: long ? "clamp(70px, 7vw, 150px)" : "clamp(140px, 12vw, 250px)",
          fontWeight: 500,
          lineHeight: 0.95,
          letterSpacing: "0.01em",
          textAlign: "center",
          maxWidth: "100%",
          whiteSpace: long ? "normal" : "nowrap",
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}
      >
        {value}
      </span>
    </div>
  );
});

// One node cell owns its own line segments, always anchored to its own
// horizontal center — no global absolutely-positioned line relying on
// approximate offsets that drift when row heights change.
function JourneyNode({ showTop, showBottom }: { showTop: boolean; showBottom: boolean }) {
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {showTop && (
        <span style={{ position: "absolute", left: "50%", top: 0, height: "50%", width: "clamp(8px, 0.5vw, 10px)", transform: "translateX(-50%)", backgroundColor: ORANGE }} />
      )}
      {showBottom && (
        <span style={{ position: "absolute", left: "50%", top: "50%", height: "50%", width: "clamp(8px, 0.5vw, 10px)", transform: "translateX(-50%)", backgroundColor: ORANGE }} />
      )}
      <span style={{ position: "relative", zIndex: 1, width: "clamp(52px, 3.8vw, 60px)", height: "clamp(52px, 3.8vw, 60px)", borderRadius: "50%", backgroundColor: ORANGE, display: "block" }} />
    </div>
  );
}

const JourneyRows = memo(function JourneyRows({ stops, finalStop }: { stops: TrainStop[]; finalStop?: TrainStop }) {
  // Fixed 4 slots regardless of how many stops this page has, so a
  // 2-stop page keeps the same vertical rhythm as a 4-stop one instead of
  // stretching to fill the available height.
  const slots: (TrainStop | undefined)[] = Array.from({ length: VISIBLE_ROWS }, (_, i) => stops[i]);
  const lastVisibleIndex = stops.length - 1;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "clamp(170px, 15vw, 285px) clamp(70px, 6vw, 110px) minmax(0, 1fr)",
        gridTemplateRows: `repeat(${VISIBLE_ROWS}, minmax(0, 1fr))`,
        alignItems: "stretch",
        height: "100%",
      }}
    >
      {slots.map((stop, index) => {
        if (!stop) return <div key={`empty-${index}`} style={{ display: "contents" }} />;
        const isFirstVisible = index === 0;
        const isLastVisible = index === lastVisibleIndex;
        const isTrueEnd = finalStop != null && stop === finalStop;
        return (
          <div key={`${stop.station}-${index}`} style={{ display: "contents" }}>
            <div style={{ textAlign: "right", paddingRight: "clamp(12px, 1vw, 24px)", fontSize: "clamp(42px, 4vw, 80px)", fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
              {formatStopTime(stop.time)}
            </div>
            <JourneyNode showTop={!isFirstVisible} showBottom={!(isLastVisible && isTrueEnd)} />
            <div
              style={{
                minWidth: 0,
                maxWidth: "100%",
                fontSize: "clamp(44px, 4.25vw, 86px)",
                fontWeight: isTrueEnd ? 600 : 400,
                lineHeight: 1.05,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                overflowWrap: "break-word",
                alignSelf: "center",
              }}
            >
              {stop.station}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default function TrainJourneyDisplay({ train, lang, clock }: JourneyProps) {
  const reducedMotion = usePrefersReducedMotion();

  const stops = useMemo(() => normalizeStops(train?.stops), [train?.stops]);
  const pages = useMemo(() => buildStopPages(stops, VISIBLE_ROWS), [stops]);
  const finalStop = useMemo(() => finalStopOf(stops), [stops]);
  const journeyKey = useMemo(() => journeyKeyFor(train), [train]);
  const pagesKey = useMemo(() => pagesSignature(pages), [pages]);
  const normalizedStatus = useMemo(() => normalizeTrainStatus(train?.status), [train?.status]);

  const [pageIndex, setPageIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const showSecondary = useAlternating(Boolean(train?.destination2));

  // Reset pagination/transition whenever the selected journey changes, or
  // when its content changes without the page *count* changing (e.g. an
  // admin edits a stop time) — a plain `pages.length` dependency would miss
  // that case.
  useEffect(() => {
    setPageIndex(0);
    setVisible(true);
  }, [journeyKey, pagesKey]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (pages.length <= 1) return;
    let transitionTimer: number | undefined;
    const interval = window.setInterval(() => {
      if (reducedMotion) {
        // No animated transition: jump straight to the next page, but keep
        // the same dwell time so it's still readable.
        setPageIndex((current) => (current + 1) % pages.length);
        return;
      }
      setVisible(false);
      transitionTimer = window.setTimeout(() => {
        if (!mountedRef.current) return;
        setPageIndex((current) => (current + 1) % pages.length);
        setVisible(true);
      }, FADE_MS);
    }, PAGE_DWELL_MS);
    return () => {
      window.clearInterval(interval);
      if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
    };
    // journeyKey is included so a train swap (even one that coincidentally
    // keeps the same pages.length) restarts the timer from a clean slate.
  }, [journeyKey, pages.length, reducedMotion]);

  if (!train) {
    return (
      <div style={{ width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#001b46", color: "#f7f7f2", display: "grid", placeItems: "center", fontSize: "clamp(32px, 4vw, 72px)" }}>
        {t("no-train-info", lang)}
      </div>
    );
  }

  const cancelled = normalizedStatus === "cancelled";
  // Render-time clamp: if the journey just changed and effects haven't
  // committed yet, never index into a shorter `pages` array than the
  // previous train had.
  const safePageIndex = pageIndex < pages.length ? pageIndex : 0;
  const activeStops = pages[safePageIndex] || [];
  const observationText = train.observations?.trim();
  const countdown = formatDepartureCountdown(computeDepartureCountdown(train, clock));

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#001b46", color: "#f7f7f2", fontFamily: "Inter, Arial, \"Helvetica Neue\", sans-serif", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          height: "27vh",
          flexShrink: 0,
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "clamp(250px, 22vw, 440px) minmax(0, 1fr) clamp(260px, 21vw, 420px)",
          gridTemplateRows: "1fr 1fr",
          columnGap: "clamp(16px, 2vw, 40px)",
          alignItems: "center",
          padding: "clamp(18px, 2.5vh, 36px) clamp(24px, 3vw, 58px) 0",
        }}
      >
        <div style={{ gridColumn: 1, gridRow: 1, alignSelf: "start", fontSize: "clamp(64px, 6.5vw, 128px)", fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 0.95 }}>{countdown}</div>
        <div style={{ gridColumn: 2, gridRow: 1, minWidth: 0, maxWidth: "100%", overflow: "hidden", alignSelf: "start", paddingTop: "clamp(8px, 1vh, 16px)" }}>
          <OperatorProduct train={train} />
        </div>
        <div style={{ gridColumn: 3, gridRow: "1 / span 2", justifySelf: "end", alignSelf: "stretch" }}>
          <TrackPanel platform={train.platform} />
        </div>
        <div style={{ gridColumn: "1 / 3", gridRow: 2, minWidth: 0, display: "flex", alignItems: "center", gap: "clamp(12px, 1vw, 24px)", alignSelf: "center", overflow: "hidden", opacity: cancelled ? 0.45 : 1 }}>
          <ProductIndicator train={train} />
          <div style={{ minWidth: 0, fontSize: "clamp(68px, 7vw, 140px)", fontWeight: 400, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {showSecondary && train.destination2 ? train.destination2 : train.destination || "--"}
          </div>
        </div>
      </header>
      <main
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          overflow: "hidden",
          padding: "clamp(8px, 1vh, 16px) clamp(24px, 3vw, 58px) 0",
          opacity: visible ? 1 : 0,
          transition: reducedMotion ? "none" : `opacity ${FADE_MS}ms ease`,
        }}
      >
        {activeStops.length > 0 ? (
          <JourneyRows stops={activeStops} finalStop={finalStop} />
        ) : (
          <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: "clamp(32px, 4vw, 72px)", opacity: 0.7 }}>{train.destination || "--"}</div>
        )}
      </main>
      {(cancelled || observationText) && (
        <div style={{ flexShrink: 0, padding: "clamp(8px, 1vh, 14px) clamp(24px, 3vw, 58px)", fontSize: "clamp(20px, 1.7vw, 34px)", color: cancelled ? "#ffb4b4" : "#f7f7f2" }}>
          {cancelled ? trainStatusLabel("Cancelled", lang) : observationText}
        </div>
      )}
    </div>
  );
}
