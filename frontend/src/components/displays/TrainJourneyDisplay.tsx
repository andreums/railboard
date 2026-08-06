import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

type JourneyProps = { train?: JourneyTrain; lang: Language; clock: Date; orientation?: "LANDSCAPE" | "PORTRAIT" };

const PAGE_DWELL_MS = 9000;
const VISIBLE_ROWS = 4;

const ORANGE = "#f5a623";
const MARQUEE_STYLE_ID = "train-journey-marquee-style";
const MARQUEE_PX_PER_SECOND = 90;

if (typeof document !== "undefined" && !document.getElementById(MARQUEE_STYLE_ID)) {
  const style = document.createElement("style");
  style.id = MARQUEE_STYLE_ID;
  style.textContent = `
    @keyframes train-journey-marquee {
      0%, 8% { transform: translateX(0); }
      50%, 58% { transform: translateX(var(--marquee-distance)); }
      100% { transform: translateX(0); }
    }
    @keyframes train-journey-vscroll {
      0%, 6% { transform: translateY(0); }
      94%, 100% { transform: translateY(var(--vscroll-distance)); }
    }
    @keyframes train-journey-hscroll {
      0%, 6% { transform: translateX(0); }
      94%, 100% { transform: translateX(var(--hscroll-distance)); }
    }
  `;
  document.head.appendChild(style);
}

export { buildStopPages };

/** A single line of text that pauses, scrolls left to reveal its full
 * content when it doesn't fit its container, then scrolls back — instead
 * of clipping with an ellipsis. Falls back to a static ellipsis under
 * `prefers-reduced-motion` (see usePrefersReducedMotion) since the scroll
 * itself is the kind of continuous motion that preference asks to avoid. */
function ScrollingText({ text, style, reducedMotion }: { text: string; style: React.CSSProperties; reducedMotion: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;
    const measure = () => {
      const diff = Math.ceil(textEl.scrollWidth - container.clientWidth);
      setOverflowPx(diff > 0 ? diff : 0);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(textEl);
    return () => observer.disconnect();
  }, [text]);

  const scrolling = overflowPx > 0 && !reducedMotion;
  const duration = Math.max(6, overflowPx / MARQUEE_PX_PER_SECOND + 3);

  return (
    <div ref={containerRef} style={{ ...style, overflow: "hidden", whiteSpace: "nowrap" }}>
      <span
        ref={textRef}
        style={{
          display: "inline-block",
          overflow: overflowPx > 0 && reducedMotion ? "hidden" : "visible",
          textOverflow: overflowPx > 0 && reducedMotion ? "ellipsis" : undefined,
          maxWidth: overflowPx > 0 && reducedMotion ? "100%" : undefined,
          animation: scrolling ? `train-journey-marquee ${duration}s ease-in-out infinite` : undefined,
          ["--marquee-distance" as string]: `-${overflowPx}px`,
        }}
      >
        {text}
      </span>
    </div>
  );
}

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

const OperatorProduct = memo(function OperatorProduct({ train, displayNumber }: { train: JourneyTrain; displayNumber: string }) {
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
        {displayNumber || "--"}
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

const LINE_WIDTH = "clamp(22px, 1.9vw, 34px)";
const NODE_SIZE = "clamp(54px, 4vw, 64px)";

// One continuous line per row connecting its node to the *previous* row's
// node center (skipped for the journey's true first stop) — instead of two
// half-height segments meeting at the row's midpoint. This is the same
// technique real platform-display boards use (a single element spanning
// from the previous center to this one) and, unlike two independently
// rounded halves, it can never leave a hairline subpixel seam at the
// boundary between rows.
function JourneyNode({ connectPrev }: { connectPrev: boolean }) {
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {connectPrev && (
        <span style={{ position: "absolute", left: "50%", top: "-50%", height: "100%", width: LINE_WIDTH, transform: "translateX(-50%)", backgroundColor: ORANGE }} />
      )}
      <span style={{ position: "relative", zIndex: 1, width: NODE_SIZE, height: NODE_SIZE, borderRadius: "50%", backgroundColor: ORANGE, display: "block" }} />
    </div>
  );
}

const JOURNEY_GRID_COLUMNS = "clamp(170px, 15vw, 285px) clamp(70px, 6vw, 110px) minmax(0, 1fr)";

function StopRow({ stop, isFirst, isTrueEnd }: { stop: TrainStop; isFirst: boolean; isTrueEnd: boolean }) {
  return (
    <div style={{ display: "contents" }}>
      <div style={{ textAlign: "right", paddingRight: "clamp(12px, 1vw, 24px)", fontSize: "clamp(42px, 4vw, 80px)", fontWeight: 500, fontVariantNumeric: "tabular-nums", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        {formatStopTime(stop.time)}
      </div>
      <JourneyNode connectPrev={!isFirst} />
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
}

// Used only for the reduced-motion fallback: a static, paginated page of at
// most VISIBLE_ROWS stops (see JourneyScroll for the normal, continuously
// scrolling presentation). Rows keep a fixed 1fr rhythm regardless of how
// many stops this particular page has, so a 2-stop page doesn't stretch to
// fill the available height.
const JourneyRows = memo(function JourneyRows({ stops, finalStop }: { stops: TrainStop[]; finalStop?: TrainStop }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: JOURNEY_GRID_COLUMNS, gridTemplateRows: `repeat(${VISIBLE_ROWS}, minmax(0, 1fr))`, alignItems: "stretch", height: "100%" }}>
      {stops.map((stop, index) => (
        <StopRow key={`${stop.station}-${index}`} stop={stop} isFirst={index === 0} isTrueEnd={finalStop != null && stop === finalStop} />
      ))}
    </div>
  );
});

// Normal (motion-allowed) presentation: renders the *entire* itinerary and
// auto-scrolls it top to bottom inside a fixed-height window when it has
// more than VISIBLE_ROWS stops, instead of paginating — pauses at the top,
// scrolls down to reveal the rest (ending on the final destination), pauses
// at the bottom, then the animation loop restarts (an instant, unanimated
// jump back to the top, same as a physical station scroller board).
const JourneyScroll = memo(function JourneyScroll({ stops, finalStop }: { stops: TrainStop[]; finalStop?: TrainStop }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => setRowHeight(container.clientHeight / VISIBLE_ROWS);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const overflowRows = Math.max(0, stops.length - VISIBLE_ROWS);
  const scrolling = overflowRows > 0 && rowHeight > 0;
  const distance = overflowRows * rowHeight;
  const duration = Math.max(8, overflowRows * 3.5 + 6);

  return (
    <div ref={containerRef} style={{ height: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: JOURNEY_GRID_COLUMNS,
          gridAutoRows: rowHeight > 0 ? `${rowHeight}px` : "minmax(0, 1fr)",
          animation: scrolling ? `train-journey-vscroll ${duration}s ease-in-out infinite` : undefined,
          ["--vscroll-distance" as string]: `-${distance}px`,
        }}
      >
        {stops.map((stop, index) => (
          <StopRow key={`${stop.station}-${index}`} stop={stop} isFirst={index === 0} isTrueEnd={finalStop != null && stop === finalStop} />
        ))}
      </div>
    </div>
  );
});

// LANDSCAPE presentation: a single-line horizontal ticker of station names
// separated by "·" (no per-stop times — matches real wide platform-sign
// boards), auto-scrolling left to reveal the full itinerary when it doesn't
// fit, ending on the final destination. Pauses at both ends, same
// hold-scroll-hold-reset rhythm as JourneyScroll's vertical version.
const JourneyStationsHorizontal = memo(function JourneyStationsHorizontal({ stops, finalStop }: { stops: TrainStop[]; finalStop?: TrainStop }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;
    const measure = () => setDistance(Math.max(0, Math.ceil(content.scrollWidth - container.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, [stops]);

  const scrolling = distance > 0;
  const duration = Math.max(10, distance / MARQUEE_PX_PER_SECOND + 6);

  return (
    <div ref={containerRef} style={{ height: "100%", overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div
        ref={contentRef}
        style={{
          display: "flex",
          alignItems: "baseline",
          whiteSpace: "nowrap",
          animation: scrolling ? `train-journey-hscroll ${duration}s ease-in-out infinite` : undefined,
          ["--hscroll-distance" as string]: `-${distance}px`,
        }}
      >
        {stops.map((stop, index) => {
          const isTrueEnd = finalStop != null && stop === finalStop;
          return (
            <span key={`${stop.station}-${index}`} style={{ display: "inline-flex", alignItems: "baseline" }}>
              {index > 0 && <span style={{ margin: "0 clamp(18px, 1.6vw, 32px)", opacity: 0.5, fontSize: "clamp(36px, 3.4vw, 64px)" }}>·</span>}
              <span style={{ fontSize: "clamp(38px, 3.6vw, 70px)", fontWeight: isTrueEnd ? 600 : 400 }}>{stop.station}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
});

export default function TrainJourneyDisplay({ train, lang, clock, orientation }: JourneyProps) {
  const reducedMotion = usePrefersReducedMotion();

  const stops = useMemo(() => normalizeStops(train?.stops), [train?.stops]);
  const pages = useMemo(() => buildStopPages(stops, VISIBLE_ROWS), [stops]);
  const finalStop = useMemo(() => finalStopOf(stops), [stops]);
  const journeyKey = useMemo(() => journeyKeyFor(train), [train]);
  const pagesKey = useMemo(() => pagesSignature(pages), [pages]);
  const normalizedStatus = useMemo(() => normalizeTrainStatus(train?.status), [train?.status]);

  // Pagination only applies to the reduced-motion fallback — the normal
  // presentation scrolls the full itinerary continuously instead (see
  // JourneyScroll) and needs no page timer at all.
  const [pageIndex, setPageIndex] = useState(0);
  const showSecondary = useAlternating(Boolean(train?.destination2 || train?.number2));

  // Reset pagination whenever the selected journey changes, or when its
  // content changes without the page *count* changing (e.g. an admin edits
  // a stop time) — a plain `pages.length` dependency would miss that case.
  useEffect(() => {
    setPageIndex(0);
  }, [journeyKey, pagesKey]);

  useEffect(() => {
    if (!reducedMotion || pages.length <= 1) return;
    const interval = window.setInterval(() => {
      setPageIndex((current) => (current + 1) % pages.length);
    }, PAGE_DWELL_MS);
    return () => window.clearInterval(interval);
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
  // Default to landscape (matches the admin panel's default for new
  // screens) when a screen predates the orientation field.
  const landscape = orientation !== "PORTRAIT";
  // Render-time clamp: if the journey just changed and effects haven't
  // committed yet, never index into a shorter `pages` array than the
  // previous train had.
  const safePageIndex = pageIndex < pages.length ? pageIndex : 0;
  const observationText = train.observations?.trim();
  const countdown = formatDepartureCountdown(computeDepartureCountdown(train, clock));
  const displayNumber = showSecondary && train.number2 ? train.number2 : train.number || "--";

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
          <OperatorProduct train={train} displayNumber={displayNumber} />
        </div>
        <div style={{ gridColumn: 3, gridRow: "1 / span 2", justifySelf: "end", alignSelf: "stretch" }}>
          <TrackPanel platform={train.platform} />
        </div>
        <div style={{ gridColumn: "1 / 3", gridRow: 2, minWidth: 0, display: "flex", alignItems: "center", gap: "clamp(12px, 1vw, 24px)", alignSelf: "center", overflow: "hidden", opacity: cancelled ? 0.45 : 1 }}>
          <ProductIndicator train={train} />
          <ScrollingText
            text={(showSecondary && train.destination2 ? train.destination2 : train.destination) || "--"}
            reducedMotion={reducedMotion}
            style={{ minWidth: 0, flex: "1 1 auto", fontSize: "clamp(68px, 7vw, 140px)", fontWeight: 400, lineHeight: 1 }}
          />
        </div>
      </header>
      <main style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", padding: "clamp(8px, 1vh, 16px) clamp(24px, 3vw, 58px) 0" }}>
        {stops.length === 0 ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: "clamp(32px, 4vw, 72px)", opacity: 0.7 }}>{train.destination || "--"}</div>
        ) : reducedMotion ? (
          <JourneyRows stops={pages[safePageIndex] || []} finalStop={finalStop} />
        ) : landscape ? (
          <JourneyStationsHorizontal stops={stops} finalStop={finalStop} />
        ) : (
          <JourneyScroll stops={stops} finalStop={finalStop} />
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
