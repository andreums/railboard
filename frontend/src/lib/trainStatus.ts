import { t, type Language } from "./i18n";

// Canonical statuses actually produced by the backend (trains.status column —
// see backend/src/db.js createTrain/updateTrain and
// backend/src/services/trainGeneratorService.js statusForOffset). Kept as a
// single source of truth instead of comparing raw strings ("Cancelled", ...)
// at each call site.
export type NormalizedTrainStatus =
  | "scheduled"
  | "approaching"
  | "arriving"
  | "boarding"
  | "delayed"
  | "cancelled"
  | "departed"
  | "arrived"
  | "unknown";

const STATUS_MAP: Record<string, NormalizedTrainStatus> = {
  scheduled: "scheduled",
  approaching: "approaching",
  arriving: "arriving",
  boarding: "boarding",
  delayed: "delayed",
  cancelled: "cancelled",
  departed: "departed",
  arrived: "arrived",
};

export function normalizeTrainStatus(status?: string | null): NormalizedTrainStatus {
  const key = String(status || "").trim().toLowerCase();
  return STATUS_MAP[key] || "unknown";
}

export function isCancelledStatus(status?: string | null): boolean {
  return normalizeTrainStatus(status) === "cancelled";
}

export function isFinalStatus(status?: string | null): boolean {
  const normalized = normalizeTrainStatus(status);
  return normalized === "departed" || normalized === "arrived";
}

// Only the statuses that already have a translation key in lib/i18n.ts (see
// the "scheduled"/"approaching"/.../"delayed"/"cancelled"/"departed" entries
// shared by every language block). "arrived" and "unknown" have no key today
// — raw passthrough rather than inventing new copy.
const LABEL_KEYS: Partial<Record<NormalizedTrainStatus, string>> = {
  scheduled: "scheduled",
  approaching: "approaching",
  arriving: "arriving",
  boarding: "boarding",
  delayed: "delayed",
  cancelled: "cancelled",
  departed: "departed",
};

export function trainStatusLabel(status: string | null | undefined, lang: Language): string {
  const normalized = normalizeTrainStatus(status);
  const key = LABEL_KEYS[normalized];
  return key ? t(key, lang) : status || "";
}
