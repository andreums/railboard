import type { Config } from "./api";

const isEnabled = (value: boolean | string | number | undefined) => value === true || value === 1 || value === "1" || value === "true";

const isNumeric = (value: string) => /^\d+$/.test(value);

function buildNumericRange(min: string, max: string) {
  const start = Number(min);
  const end = Number(max);
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  const width = Math.max(min.length, max.length);
  return Array.from({ length: hi - lo + 1 }, (_, index) => String(lo + index).padStart(width, "0"));
}

function buildAlphaRange(min: string, max: string) {
  const start = min.trim().toUpperCase().charCodeAt(0);
  const end = max.trim().toUpperCase().charCodeAt(0);
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  return Array.from({ length: hi - lo + 1 }, (_, index) => String.fromCharCode(lo + index));
}

function buildRange(min?: string, max?: string) {
  const minValue = String(min || "").trim();
  const maxValue = String(max || "").trim();
  if (!minValue && !maxValue) return [];
  if (minValue && maxValue && isNumeric(minValue) && isNumeric(maxValue)) {
    return buildNumericRange(minValue, maxValue);
  }
  if (minValue && maxValue && minValue.length === 1 && maxValue.length === 1) {
    return buildAlphaRange(minValue, maxValue);
  }
  return [minValue || maxValue].filter(Boolean);
}

export function buildPlatformOptions(config?: Config | null, fallback: string[] = []) {
  const options = buildRange(config?.platformMin, config?.platformMax);
  if (options.length > 0) {
    return isEnabled(config?.platformAllowEmpty) ? ["", ...options] : options;
  }
  return fallback.length > 0
    ? isEnabled(config?.platformAllowEmpty)
      ? ["", ...fallback]
      : fallback
    : isEnabled(config?.platformAllowEmpty)
      ? [""]
      : [];
}

export function buildSectorOptions(config?: Config | null, fallback: string[] = []) {
  const options = buildRange(config?.sectorMin, config?.sectorMax);
  if (options.length > 0) {
    return isEnabled(config?.sectorAllowEmpty) ? ["", ...options] : options;
  }
  return fallback.length > 0
    ? isEnabled(config?.sectorAllowEmpty)
      ? ["", ...fallback]
      : fallback
    : isEnabled(config?.sectorAllowEmpty)
      ? [""]
      : [];
}
