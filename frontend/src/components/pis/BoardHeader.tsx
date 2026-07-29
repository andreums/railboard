import PisClock from "./PisClock";
import { t, type Language } from "../../lib/i18n";

export default function BoardHeader({
  stationName,
  mode,
  lang,
  clockMode,
  fakeTime,
  fakeStepSeconds,
  headerBg,
  headerTextColor,
}: {
  stationName: string;
  mode: "departures" | "arrivals";
  lang: Language;
  clockMode?: "real" | "fake";
  fakeTime?: string;
  fakeStepSeconds?: number;
  headerBg?: string;
  headerTextColor?: string;
}) {
  const bg = headerBg || "#BFEFD5";
  const color = headerTextColor || "#071E43";

  return (
    <header
      style={{
        backgroundColor: bg,
        color,
        width: "100%",
        height: "clamp(90px, 13.2vh, 150px)",
        display: "flex",
        alignItems: "center",
        padding: "0 clamp(12px, 1.5vw, 30px)",
        boxSizing: "border-box",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Left section: ADIF logo + Salidas + Station */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "clamp(12px, 1.2vw, 28px)",
          minWidth: 0,
          flex: "1 1 auto",
          height: "100%",
        }}
      >
        {/* ADIF Logo */}
        <img
          src="/adif.svg"
          alt="ADIF"
          style={{
            height: "clamp(36px, 4.5vh, 60px)",
            width: "auto",
            flexShrink: 0,
          }}
        />

        {/* Title: Salidas / Llegadas */}
        <span
          style={{
            fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
            fontWeight: 800,
            fontSize: "clamp(36px, 3.8vw, 78px)",
            lineHeight: 1,
            flexShrink: 0,
            color,
          }}
        >
          {t(mode === "departures" ? "departures" : "arrivals", lang)}
        </span>

        {/* Station info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: "clamp(8px, 0.8vw, 18px)",
            minWidth: 0,
            gap: "clamp(1px, 0.15vh, 4px)",
          }}
        >
          <span
            style={{
              fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
              fontWeight: 400,
              fontSize: "clamp(16px, 1.6vw, 32px)",
              lineHeight: 1.1,
              color,
              opacity: 0.85,
            }}
          >
            {t("station-of", lang)}
          </span>
          <span
            style={{
              fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(22px, 2.4vw, 48px)",
              lineHeight: 1.1,
              color,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {stationName}
          </span>
        </div>
      </div>

      {/* Right section: Clock + Vía */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          flexShrink: 0,
          marginLeft: "clamp(12px, 1.5vw, 30px)",
          gap: "clamp(2px, 0.3vh, 6px)",
        }}
      >
        <PisClock
          mode={clockMode === "fake" ? "fake" : "real"}
          fakeTime={fakeTime || "12:00:00"}
          fakeStepSeconds={Number(fakeStepSeconds || 1)}
        />
        <span
          style={{
            fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(14px, 1.4vw, 28px)",
            color,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            lineHeight: 1,
          }}
        >
          {t("platform", lang)}
        </span>
      </div>
    </header>
  );
}
