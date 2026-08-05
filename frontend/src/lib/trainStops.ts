export type TrainStop = { station: string; time?: string };

// Intermediate stops are stored as { station, time? } objects. This also
// accepts legacy shapes (plain string arrays, newline/semicolon separated
// text, JSON text) so older records keep rendering correctly.
export function normalizeStops(raw: unknown): TrainStop[] {
  if (!raw) return [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = trimmed.split(/[\r\n;]+/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return arr
    .map((item): TrainStop | null => {
      if (typeof item === "string") {
        const station = item.trim();
        return station ? { station } : null;
      }
      if (item && typeof item === "object" && "station" in (item as any)) {
        const station = String((item as any).station || "").trim();
        if (!station) return null;
        const time = (item as any).time ? String((item as any).time).trim() : "";
        return time ? { station, time } : { station };
      }
      return null;
    })
    .filter((v): v is TrainStop => v !== null);
}

export function stopsToNames(raw: unknown): string[] {
  return normalizeStops(raw).map((s) => s.station);
}

export function formatStop(stop: TrainStop): string {
  return stop.time ? `${stop.station} (${stop.time})` : stop.station;
}

export function stopsToDisplayText(raw: unknown, separator = " · "): string {
  return normalizeStops(raw).map(formatStop).join(separator);
}
