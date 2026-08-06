import { forwardRef, useEffect, useRef, useState } from "react";
import LineBadge from "./LineBadge";
import OperatorLogo from "./OperatorLogo";
import type { Train } from "../../lib/api";
import { fileUrl } from "../../lib/api";
import { handleImgError } from "../../lib/svgPlaceholder";
import { useAlternating } from "../../lib/useAlternating";
import { t, type Language } from "../../lib/i18n";

export function ScrollText({
  text,
  color,
  fontSize,
  fontWeight,
  fontFamily,
}: {
  text: string;
  color: string;
  fontSize?: string;
  fontWeight?: number;
  fontFamily?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    const check = () => {
      if (wrapRef.current && spanRef.current) {
        setScrolling(spanRef.current.scrollWidth > wrapRef.current.clientWidth + 1);
      }
    };
    const timer = setTimeout(check, 120);
    window.addEventListener("resize", check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", check);
    };
  }, [text]);

  return (
    <div
      ref={wrapRef}
      style={{
        overflow: "hidden",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        ref={spanRef}
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          color,
          fontFamily: fontFamily ?? "inherit",
          fontWeight: fontWeight ?? 400,
          fontSize: fontSize ?? "inherit",
          animation: scrolling ? "marquee-pause 18s linear infinite" : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

type DepartureRowProps = {
  train: Train;
  index: number;
  mode: "departures" | "arrivals";
  showDestinationIcon?: boolean;
  lang?: Language;
};

const DepartureRow = forwardRef<HTMLDivElement, DepartureRowProps>(function DepartureRow(
  { train, index, mode, showDestinationIcon, lang = "ca" },
  ref,
) {
  const isCancelled = train.status === "Cancelled";
  const place = mode === "departures" ? train.destination : train.origin;
  const place2 = mode === "departures" ? train.destination2 : null;
  const num2 = train.number2 || null;
  const hasAlt = !!(place2 || num2);
  const showAlt = useAlternating(hasAlt);
  const displayPlace = showAlt && place2 ? place2 : place;

  const platform = train.platform && train.platform !== "-" && train.platform !== "?" ? train.platform : "";
  const sector = train.sector && train.sector !== "-" ? train.sector : "";
  const platText = platform
    ? sector
      ? /^\d+$/.test(platform) && /^\d+$/.test(sector)
        ? `${platform} · ${sector}`
        : `${platform}${sector}`
      : platform
    : "";

  const padNum = train.number ? String(train.number).padStart(5, "0") : "00000";
  const displayNum = showAlt && num2 ? String(num2).padStart(5, "0") : padNum;
  const hasStops = train.stops && train.stops.length > 0;
  const hasObservations = Boolean(train.observations?.trim());
  const isCommuter = train.type_code && /^([A-Z]{2,3}-)?C(-\d+[A-Z]?|\d+[A-Z]?)?$|^R\d*[A-Z]?$/i.test(train.type_code);

  const iconMode = train.icon_mode || (showDestinationIcon !== false ? "destination" : "none");
  let iconUrl: string | undefined | null = null;
  if (iconMode === "custom") iconUrl = train.custom_icon_url;
  else if (iconMode === "destination") iconUrl = train.type_destination_icon || (isCommuter ? null : train.operator_logo);
  else if (iconMode === "type") iconUrl = train.type_logo;
  else if (iconMode === "operator") iconUrl = train.operator_logo;

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "clamp(100px, 12.4vh, 150px)",
        backgroundColor: index % 2 === 0 ? "#1A3355" : "#0F2441",
        display: "grid",
        gridTemplateColumns: "12% 59% 12% 9% 8%",
        gridTemplateRows: "55% 45%",
        boxSizing: "border-box",
        paddingTop: "clamp(4px, 0.5vh, 10px)",
        paddingBottom: "clamp(4px, 0.5vh, 10px)",
        overflow: "hidden",
        color: "#FFFFFF",
      }}
    >
      {/* ═══ ROW 1 ═══ */}

      {/* ── R1-C1: TIME ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingLeft: "clamp(12px, 1.5vw, 30px)",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(28px, 3vw, 65px)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            whiteSpace: "nowrap",
            textDecoration: isCancelled ? "line-through" : "none",
            textDecorationColor: isCancelled ? "#888" : "transparent",
            color: isCancelled ? "rgba(255,255,255,0.45)" : "#FFFFFF",
          }}
        >
          {train.scheduled_time}
        </span>
      </div>

      {/* ── R1-C2: BADGE + DESTINATION ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(8px, 0.8vw, 16px)",
          paddingLeft: "clamp(4px, 0.4vw, 10px)",
          boxSizing: "border-box",
          overflow: "hidden",
          opacity: isCancelled ? 0.45 : 1,
        }}
      >
        {isCommuter && train.type_code && (
          <LineBadge code={train.type_code} color={train.type_color} />
        )}
        
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          <ScrollText
            text={displayPlace}
            color="#FFFFFF"
            fontSize="clamp(28px, 3vw, 65px)"
            fontWeight={700}
            fontFamily="'Roboto Condensed', 'Oswald', Arial, sans-serif"
          />
        </div>
      </div>

      {/* ── R1-C3-5: OPERATOR + NUMBER + PLATFORM ── */}
      <div
        style={{
          gridColumn: "3 / 6",
          display: "flex",
          alignItems: "center",
          gap: "clamp(4px, 0.4vw, 8px)",
          overflow: "hidden",
          opacity: isCancelled ? 0.45 : 1,
        }}
      >
        <OperatorLogo
          operatorName={train.operator_name}
          operatorLogo={train.operator_logo}
          typeCode={train.type_code}
          typeLogo={train.type_logo}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            lineHeight: 1.1,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Roboto Mono', 'JetBrains Mono', monospace",
              fontWeight: 600,
              fontSize: "clamp(20px, 2.1vw, 44px)",
              fontVariantNumeric: "tabular-nums",
              color: "#FFFFFF",
              lineHeight: 1,
              whiteSpace: "nowrap",
            }}
          >
            {displayNum}
          </span>
        </div>
        <span
          style={{
            fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(30px, 3.2vw, 65px)",
            color: "#FFFFFF",
            lineHeight: 1,
            whiteSpace: "nowrap",
            flexShrink: 0,
            marginLeft: "auto",
            marginRight: "clamp(12px, 1.5vw, 30px)",
          }}
        >
          {platText}
        </span>
      </div>

      {/* ═══ ROW 2 ═══ */}

      {/* ── R2-C1: CANCELADO ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          paddingLeft: "clamp(12px, 1.5vw, 30px)",
          paddingTop: "clamp(4px, 0.5vh, 10px)",
          boxSizing: "border-box",
        }}
      >
        {isCancelled && (
          <span
            style={{
              fontFamily: "'Roboto Condensed', 'Oswald', Arial, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(18px, 1.7vw, 35px)",
              color: "#FF8752",
              lineHeight: 1,
            }}
          >
            {t("cancelled", lang)}
          </span>
        )}
      </div>

      {/* ── R2-C2: STOPS ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          paddingLeft: "clamp(4px, 0.4vw, 10px)",
          paddingTop: "clamp(4px, 0.5vh, 10px)",
          boxSizing: "border-box",
          overflow: "hidden",
          opacity: isCancelled ? 0.45 : 1,
        }}
      >
        {hasStops && (
          <div style={{ width: "100%", height: "clamp(18px, 1.8vw, 36px)", overflow: "hidden" }}>
            <ScrollText
              text={train.stops.join(" \u00B7 ")}
              color="rgba(255,255,255,0.92)"
              fontSize="clamp(16px, 1.6vw, 32px)"
              fontWeight={700}
              fontFamily="'Roboto Condensed', Arial, sans-serif"
            />
          </div>
        )}
      </div>

      {/* ── R2-C3-5: OBSERVATIONS ── */}
      <div
        style={{
          gridColumn: "3 / 6",
          display: "flex",
          alignItems: "flex-start",
          paddingTop: "clamp(4px, 0.5vh, 10px)",
          overflow: "hidden",
          opacity: isCancelled ? 0.45 : 1,
        }}
      >
        {hasObservations && (
          <div style={{ width: "100%", height: "clamp(18px, 1.8vw, 36px)", overflow: "hidden" }}>
            <ScrollText
              text={train.observations!}
              color="#5FE0AF"
              fontSize="clamp(16px, 1.6vw, 32px)"
              fontWeight={700}
              fontFamily="'Roboto Condensed', Arial, sans-serif"
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default DepartureRow;
