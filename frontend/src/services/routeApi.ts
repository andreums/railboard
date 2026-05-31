import { API_URL } from "../lib/api";
import type { RailRoute } from "../types/railRoute";

export type RailwayReloadStats = {
  success: boolean;
  routes: number;
  stations: number;
  networks: number;
  reloadedAt: string;
};

async function toJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function fetchRoutes(): Promise<RailRoute[]> {
  return toJson<RailRoute[]>(`${API_URL}/api/routes`);
}

export function fetchRouteByCode(code: string): Promise<RailRoute> {
  return toJson<RailRoute>(`${API_URL}/api/routes/${encodeURIComponent(code)}`);
}

export function fetchRoutesByNetwork(network: string): Promise<RailRoute[]> {
  return toJson<RailRoute[]>(`${API_URL}/api/routes/network/${encodeURIComponent(network)}`);
}

export function fetchRegions(): Promise<string[]> {
  return toJson<string[]>(`${API_URL}/api/regions`);
}

export function fetchStations(): Promise<string[]> {
  return toJson<string[]>(`${API_URL}/api/stations`);
}

export function searchStations(query: string): Promise<string[]> {
  return toJson<string[]>(`${API_URL}/api/stations/search?q=${encodeURIComponent(query)}`);
}

export function fetchNetworks(): Promise<string[]> {
  return toJson<string[]>(`${API_URL}/api/networks`);
}

export function fetchOperators(): Promise<string[]> {
  return toJson<string[]>(`${API_URL}/api/operators`);
}

export async function reloadRailwayRoutes(): Promise<RailwayReloadStats> {
  let response = await fetch(`${API_URL}/api/admin/routes/reload`, {
    method: "POST",
  });
  if (response.status === 404) {
    const auth = btoa("admin:railboard");
    response = await fetch(`${API_URL}/admin/routes/reload`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
    });
  }
  if (!response.ok) {
    throw new Error("No se pudo recargar el dataset ferroviario");
  }
  return response.json();
}
