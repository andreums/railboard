import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_JSON_PATH = path.resolve(__dirname, "../data/railboard_routes.json");

const REQUIRED_FIELDS = ["code", "name", "network", "operator", "color", "headwayMin", "platforms", "numbers", "stations"];

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const safeArray = (value) => (Array.isArray(value) ? value : []);

function isValidRoute(route) {
  if (!route || typeof route !== "object") return false;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in route)) return false;
  }
  if (!Array.isArray(route.platforms) || !Array.isArray(route.numbers) || !Array.isArray(route.stations)) return false;
  if (typeof route.code !== "string" || typeof route.name !== "string") return false;
  if (typeof route.network !== "string" || typeof route.operator !== "string") return false;
  if (typeof route.color !== "string" || typeof route.headwayMin !== "number") return false;
  return true;
}

function parseRoutesPayload(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.routes)) return raw.routes;
  return [];
}

function loadRoutesRaw() {
  try {
    const content = fs.readFileSync(ROUTES_JSON_PATH, "utf8");
    const parsed = JSON.parse(content);
    return parseRoutesPayload(parsed).filter(isValidRoute);
  } catch (error) {
    console.error("[routeService] Could not load routes JSON:", error.message);
    return [];
  }
}

function uniqueSorted(values) {
  const byNorm = new Map();
  for (const value of safeArray(values)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const normalized = normalizeText(value);
    if (!normalized || byNorm.has(normalized)) continue;
    byNorm.set(normalized, value.trim());
  }
  return Array.from(byNorm.values()).sort((a, b) => a.localeCompare(b, "es"));
}

function getRouteRegion(route) {
  const haystack = normalizeText(`${route.network} ${route.name}`);
  if (haystack.includes("valencia")) return "Comunitat Valenciana";
  if (haystack.includes("catalunya") || haystack.includes("cataluna")) return "Catalunya";
  if (haystack.includes("madrid")) return "Comunidad de Madrid";
  if (haystack.includes("murcia") || haystack.includes("alicante")) return "Región de Murcia / Alicante";
  if (haystack.includes("sevilla")) return "Andalucía (Sevilla)";
  if (haystack.includes("san sebastian")) return "País Vasco (San Sebastián)";
  if (haystack.includes("zaragoza")) return "Aragón";
  if (haystack.includes("cantabria")) return "Cantabria";
  if (haystack.includes("asturias")) return "Asturias";
  if (haystack.includes("bilbao")) return "País Vasco (Bilbao)";
  if (haystack.includes("galicia") || haystack.includes("ferrol")) return "Galicia";
  return route.network;
}

function mapRoute(route) {
  return {
    code: route.code,
    name: route.name,
    network: route.network,
    operator: route.operator,
    color: route.color,
    headwayMin: route.headwayMin,
    platforms: safeArray(route.platforms),
    numbers: safeArray(route.numbers),
    stations: safeArray(route.stations),
    ...(route.notes ? { notes: route.notes } : {}),
  };
}

let cache = {
  routes: [],
  reloadedAt: null,
};

function buildSnapshot(routes) {
  const mapped = routes.map(mapRoute);
  const stations = uniqueSorted(mapped.flatMap((route) => route.stations));
  const networks = uniqueSorted(mapped.map((route) => route.network));
  const operators = uniqueSorted(mapped.map((route) => route.operator));
  return { routes: mapped, stations, networks, operators };
}

function currentSnapshot() {
  if (!cache.reloadedAt) {
    reloadRoutesDataset();
  }
  return buildSnapshot(cache.routes);
}

export function getAllRoutes() {
  return currentSnapshot().routes;
}

export function getRouteByCode(code) {
  const target = normalizeText(code);
  if (!target) return null;
  return getAllRoutes().find((route) => normalizeText(route.code) === target) || null;
}

export function getRoutesByNetwork(network) {
  const target = normalizeText(network);
  if (!target) return [];
  return getAllRoutes().filter((route) => normalizeText(route.network) === target);
}

export function getRoutesByRegion(region) {
  const target = normalizeText(region);
  if (!target) return [];
  return getAllRoutes().filter((route) => normalizeText(getRouteRegion(route)) === target);
}

export function getStationsByRoute(code) {
  const route = getRouteByCode(code);
  if (!route) return [];
  return uniqueSorted(route.stations);
}

export function getAllStations() {
  return currentSnapshot().stations;
}

export function searchStation(query) {
  const target = normalizeText(query);
  if (!target) return [];
  return getAllStations().filter((station) => normalizeText(station).includes(target));
}

export function getAvailableNetworks() {
  return currentSnapshot().networks;
}

export function getAvailableOperators() {
  return currentSnapshot().operators;
}

export function getAvailableRegions() {
  return uniqueSorted(getAllRoutes().map((route) => getRouteRegion(route)));
}

export function reloadRoutesDataset() {
  cache = {
    routes: loadRoutesRaw(),
    reloadedAt: new Date().toISOString(),
  };
  const snapshot = buildSnapshot(cache.routes);
  return {
    success: true,
    routes: snapshot.routes.length,
    stations: snapshot.stations.length,
    networks: snapshot.networks.length,
    reloadedAt: cache.reloadedAt,
  };
}

export function logRouteStats() {
  const stats = reloadRoutesDataset();

  console.log(`[routeService] total routes loaded: ${stats.routes}`);
  console.log(`[routeService] total unique stations: ${stats.stations}`);
  console.log(`[routeService] total available networks: ${stats.networks}`);
}
