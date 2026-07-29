export default function LineBadge({ code, color }: { code: string; color?: string | null }) {
  const label = code.toUpperCase().trim();
  const bg = color && color.trim() ? color : "#2E4DA7";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        color: "#FFFFFF",
        fontFamily: "'Oswald', 'Roboto Condensed', Arial, sans-serif",
        fontWeight: 700,
        fontSize: "clamp(21px, 2vw, 39px)",
        lineHeight: 1,
        padding: "clamp(4px, 0.45vw, 10px) clamp(10px, 0.9vw, 21px)",
        borderRadius: "clamp(16px, 1.5vw, 32px)",
        whiteSpace: "nowrap",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}
