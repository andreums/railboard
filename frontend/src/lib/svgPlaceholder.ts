function hashColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#1A3254",
    "#7C1D2E",
    "#1F6FB2",
    "#2B6E3F",
    "#B25A1F",
    "#5B1FB8",
    "#C2185B",
    "#F79646",
    "#3E8DCA",
    "#6B5B3E",
    "#8B4513",
    "#4A6741",
    "#9B59B6",
    "#2C3E50",
    "#D35400",
  ];
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function svgPlaceholderDataUri(name: string, color?: string): string {
  const bg = color || hashColor(name);
  const text = initials(name);
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="14" fill="${bg}"/>
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
            font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="#fff">
        ${text}
      </text>
    </svg>`,
  )}`;
}

export function handleImgError(e: React.SyntheticEvent<HTMLImageElement>, fallbackName: string, color?: string) {
  const target = e.target as HTMLImageElement;
  target.onerror = null;
  target.src = svgPlaceholderDataUri(fallbackName, color);
}
