import { fileUrl } from "../../lib/api";
import { handleImgError } from "../../lib/svgPlaceholder";

const OPERATOR_LABELS: Record<string, string> = {
  "renfe-cercanias": "Cercanías",
  "renfe-ave": "AVE",
  "renfe-avlo": "AVLO",
  "renfe-md": "Media Distancia",
  "renfe-regional": "Regional",
  "renfe-euromed": "Euromed",
  ouigo: "OUIGO",
  iryo: "iryo",
};

const OPERATOR_COLORS: Record<string, string> = {
  "renfe-cercanias": "#FFFFFF",
  "renfe-ave": "#9B1B7A",
  "renfe-avlo": "#E30613",
  "renfe-md": "#00529B",
  "renfe-regional": "#00529B",
  "renfe-euromed": "#00954B",
  ouigo: "#5B2D8E",
  iryo: "#FF5B00",
};

export default function OperatorLogo({
  operatorName,
  operatorLogo,
  typeCode,
  typeLogo,
}: {
  operatorName?: string | null;
  operatorLogo?: string | null;
  typeCode?: string | null;
  typeLogo?: string | null;
}) {
  const normalizedName = (operatorName || "").toLowerCase().trim();
  const isCercanias = normalizedName.includes("cercanías") || normalizedName.includes("cercanias") || /^C\d|MA-C\d/i.test(typeCode || "");
  const isRegional = /^R\d/i.test(typeCode || "");
  const isAVE = normalizedName.includes("ave") || typeCode === "AVE";

  const showTypeLogo = (isCercanias || isRegional) && typeLogo;
  const logoSrc = showTypeLogo ? fileUrl(typeLogo) : operatorLogo ? fileUrl(operatorLogo) : null;

  if (isCercanias || isAVE) {
    const bgColor = isAVE ? "#9B1B7A" : "#FFFFFF";
    const labelColor = isAVE ? "#FFFFFF" : "#071E43";

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderRadius: "clamp(12px, 1vw, 22px)",
          width: "clamp(140px, 11vw, 235px)",
          height: "clamp(40px, 3.2vw, 68px)",
          flexShrink: 0,
          overflow: "hidden",
          padding: "clamp(2px, 0.2vw, 6px)",
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={operatorName || ""}
            style={{
              height: "100%",
              width: "auto",
              maxWidth: "100%",
              objectFit: "contain",
            }}
            onError={(e) => handleImgError(e, operatorName || "Logo")}
          />
        ) : (
          <span
            style={{
              color: labelColor,
              fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
              fontWeight: 700,
              fontSize: "clamp(16px, 1.4vw, 26px)",
              lineHeight: 1,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            renfe{" "}
            <span style={{ fontWeight: 400 }}>{isAVE ? "AVE" : "Cercanías"}</span>
          </span>
        )}
      </div>
    );
  }

  if (logoSrc) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#FFFFFF",
          borderRadius: "clamp(12px, 1vw, 22px)",
          width: "clamp(140px, 11vw, 235px)",
          height: "clamp(40px, 3.2vw, 68px)",
          flexShrink: 0,
          overflow: "hidden",
          padding: "clamp(2px, 0.2vw, 6px)",
        }}
      >
        <img
          src={logoSrc}
          alt={operatorName || ""}
          style={{
            height: "100%",
            width: "auto",
            maxWidth: "100%",
            objectFit: "contain",
          }}
          onError={(e) => handleImgError(e, operatorName || "Logo")}
        />
      </div>
    );
  }

  const label = OPERATOR_LABELS[normalizedName] || operatorName || "";
  const bgColor = OPERATOR_COLORS[normalizedName] || "#FFFFFF";
  const isLight = bgColor === "#FFFFFF" || bgColor === "#FF5B00";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bgColor,
        borderRadius: "clamp(12px, 1vw, 22px)",
        width: "clamp(140px, 11vw, 235px)",
        height: "clamp(40px, 3.2vw, 68px)",
        flexShrink: 0,
        overflow: "hidden",
        padding: "clamp(2px, 0.2vw, 6px)",
      }}
    >
      <span
        style={{
          color: isLight ? "#071E43" : "#FFFFFF",
          fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
          fontWeight: 700,
          fontSize: "clamp(14px, 1.2vw, 22px)",
          lineHeight: 1,
          textAlign: "center",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}
