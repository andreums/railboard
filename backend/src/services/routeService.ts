import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { RailRoute } from "../types/railRoute";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_JSON_PATH = path.resolve(__dirname, "../data/railboard_routes.json");

const REQUIRED_FIELDS: Array<keyof RailRoute> = [
  "code",
  "name",
  "network",
  "operator",
  "color",
  "headwayMin",
  "platforms",
  "numbers",
  "stations",
];

const normalizeText = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function isRailRoute(route: unknown): route is RailRoute {
  if (!route || typeof route !== "object") return false;
  const candidate = route as Record<string, unknown>;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in candidate)) return false;
  }
  return (
    typeof candidate.code === "string"
    && typeof candidate.name === "string"
    && typeof candidate.network === "string"
    && typeof candidate.operator === "string"
    && typeof candidate.color === "string"
    && typeof candidate.headwayMin === "number"
    && Array.isArray(candidate.platforms)
    && Array.isArray(candidate.numbers)
    && Array.isArray(candidate.stations)
  );
}

function uniqueSorted(values: string[]): string[] {
  const byNorm = new Map<string, string>();
  for (const value of values) {
    if (!value || !value.trim()) continue;
    const normalized = normalizeText(value);
    if (!normalized || byNorm.has(normalized)) continue;
    byNorm.set(normalized, value.trim());
  }
  return Array.from(byNorm.values()).sort((a, b) => a.localeCompare(b, "es"));
}

function parseRoutesPayload(raw: unknown): RailRoute[] {
  const fromArray = Array.isArray(raw) ? raw : [];
  const fromObject = !Array.isArray(raw) && raw && typeof raw === "object" && Array.isArray((raw as any).routes)
    ? (raw as any).routes
    : [];
  return [...fromArray, ...fromObject].filter(isRailRoute);
}

function loadRoutesRaw(): RailRoute[] {
  try {
    const content = fs.readFileSync(ROUTES_JSON_PATH, "utf8");
    return parseRoutesPayload(JSON.parse(content));
  } catch {
    return [];
  }
}

export function getAllRoutes(): RailRoute[] {
  return loadRoutesRaw();
}

export function getRouteByCode(code: string): RailRoute | null {
  const target = normalizeText(code);
  if (!target) return null;
  return getAllRoutes().find((route) => normalizeText(route.code) === target) ?? null;
}

export function getRoutesByNetwork(network: string): RailRoute[] {
  const target = normalizeText(network);
  if (!target) return [];
  return getAllRoutes().filter((route) => normalizeText(route.network) === target);
}

export function getStationsByRoute(code: string): string[] {
  const route = getRouteByCode(code);
  if (!route) return [];
  return uniqueSorted(route.stations);
}

export function getAllStations(): string[] {
  return uniqueSorted(getAllRoutes().flatMap((route) => route.stations));
}

export function searchStation(query: string): string[] {
  const target = normalizeText(query);
  if (!target) return [];
  return getAllStations().filter((station) => normalizeText(station).includes(target));
}

export function getAvailableNetworks(): string[] {
  return uniqueSorted(getAllRoutes().map((route) => route.network));
}

export function getAvailableOperators(): string[] {
  return uniqueSorted(getAllRoutes().map((route) => route.operator));
}
