// Intermediate stops are stored as an array of { station, time? } objects.
// normalizeStops also accepts legacy shapes (plain string arrays, newline/semicolon
// separated text, JSON text) so older records keep working.
export function normalizeStops(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = trimmed.split(/[\r\n;]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => {
      if (typeof item === "string") {
        const station = item.trim();
        return station ? { station } : null;
      }
      if (item && typeof item === "object" && item.station) {
        const station = String(item.station).trim();
        if (!station) return null;
        const time = item.time ? String(item.time).trim() : "";
        return time ? { station, time } : { station };
      }
      return null;
    })
    .filter(Boolean);
}

export function stopsToNames(raw) {
  return normalizeStops(raw).map((s) => s.station);
}

export function formatStop(stop) {
  return stop.time ? `${stop.station} (${stop.time})` : stop.station;
}

export function stopsToText(raw, separator = " · ") {
  return normalizeStops(raw).map(formatStop).join(separator);
}
