import { fetchRoutes } from "../services/routeApi";

export const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:4000";

let _auth: string | null = null;
function authHeaders(): Record<string, string> {
  if (!_auth) {
    _auth = btoa("admin:railboard");
  }
  return { Authorization: `Basic ${_auth}` };
}

export type Train = {
  id: number;
  number: string;
  operator_id: number | null;
  operator_name?: string | null;
  operator_logo?: string | null;
  train_type_id: number | null;
  type_code?: string | null;
  type_name?: string | null;
  type_color?: string | null;
  type_logo?: string | null;
  origin: string;
  destination: string;
  stops: string[];
  scheduled_time: string;
  expected_time: string;
  platform: string;
  sector: string;
  observations?: string;
  station_id?: number | null;
  created_at?: string;
  sort_order?: number;
  status:
  | "Scheduled" | "Boarding" | "Delayed"
  | "Departed" | "Arrived" | "Cancelled";
};

export type Operator = { id: number; name: string; logo_url: string | null; pre_announce_ogg?: string | null };
export type TrainType = { id: number; code: string; name: string; color: string; logo_url: string | null; pre_announce_ogg?: string | null };
export type Route = {
  code: string;
  name: string;
  network: string;
  operator: string;
  color: string;
  headwayMin: number;
  platforms: string[];
  numbers: string[];
  stations: string[];
  notes?: string;
};
export type Place = { id: number; name: string; logo_url?: string | null };
export type Station = { id: number; name: string; short: string; logo_url?: string | null; pre_announce_ogg?: string | null; color: string; sort_order: number };
export type DisplaySummary = { station: Station; config: Config; trains: Train[] };

export type Service = {
  id: number;
  number: string;
  operator_id: number | null;
  operator_name?: string | null;
  operator_logo?: string | null;
  train_type_id: number | null;
  train_type_code?: string | null;
  train_type_name?: string | null;
  train_type_color?: string | null;
  train_type_logo?: string | null;
  origin_place_id: number | null;
  origin_name?: string | null;
  destination_place_id: number | null;
  destination_name?: string | null;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
  notes?: string | null;
  stops_count?: number;
  delay_minutes?: number;
  next_stop_id?: number | null;
  next_stop_name?: string | null;
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  cancelled_at?: string | null;
};

export type ServiceStop = {
  id: number;
  service_id: number;
  station_id: number;
  station_name?: string;
  station_short?: string;
  station_color?: string;
  service_number?: string;
  stop_number: number;
  stop_type: "Origin" | "Stop" | "Pass" | "Destination";
  arrival_scheduled: string | null;
  arrival_expected: string | null;
  arrival_actual: string | null;
  departure_scheduled: string | null;
  departure_expected: string | null;
  departure_actual: string | null;
  state: "Scheduled" | "Arrived" | "Departed" | "Passed" | "Cancelled" | "Completed";
  platform: string | null;
  sector: string | null;
  delay_minutes: number;
  delay_locked: boolean;
  notes?: string | null;
};
export type Config = {
  station_name: string;
  mode: "departures" | "arrivals";
  logo_url?: string;
  language?: string;
  footerText?: string;
  // Styling
  bgColor?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  rowBgColor?: string;
  altBgColor?: string;
  destinationFontSize?: string;
  countdownFontSize?: string;
  timeFormat?: "24h" | "12h";
  clockMode?: "real" | "fake";
  clockFakeTime?: string;
  clockFakeStepSeconds?: string;
  announce_departure?: string;
  announce_arrival?: string;
  announce_presets?: string;
  tts_rate?: string;
  tts_pitch?: string;
  tts_volume?: string;
  tts_voice?: string;
};

const json = (path: string, init?: RequestInit) =>
  fetch(`${API_URL}/admin${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers as Record<string, string> || {}) },
  }).then(async (r) => {
    if (r.ok) return r.status === 204 ? null : r.json();
    // try to parse JSON error body, fall back to text
    let body: any;
    try {
      body = await r.json();
    } catch (e) {
      body = await r.text();
    }
    const message = body && (body.error || body.message) ? (body.error || body.message) : String(body);
    const err: any = new Error(message);
    err.status = r.status;
    throw err;
  });

const authFetch = (path: string, init?: RequestInit) =>
  fetch(`${API_URL}/admin${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers as Record<string, string> || {}) },
  });

export const api = {
  getConfig: (): Promise<Config> => json("/config"),
  setConfig: (c: Partial<Config>) =>
    json("/config", { method: "PUT", body: JSON.stringify(c) }),

  listTrains: (stationId?: number): Promise<Train[]> =>
    json(stationId != null ? `/trains?station_id=${stationId}` : "/trains"),
  reorderTrains: (ids: number[]) =>
    json("/trains/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
  createTrain: (t: Partial<Train>) =>
    json("/trains", { method: "POST", body: JSON.stringify(t) }),
  updateTrain: (id: number, t: Partial<Train>) =>
    json(`/trains/${id}`, { method: "PUT", body: JSON.stringify(t) }),
  setStatus: (id: number, status: Train["status"]) =>
    json(`/trains/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  addDelay: (id: number, minutes: number) =>
    json(`/trains/${id}/delay`, { method: "PATCH", body: JSON.stringify({ minutes }) }),
  setPlatform: (id: number, platform: string, sector: string) =>
    json(`/trains/${id}/platform`, { method: "PATCH", body: JSON.stringify({ platform, sector }) }),
  deleteTrain: (id: number) => json(`/trains/${id}`, { method: "DELETE" }),
  clearTrains: (stationId?: number) =>
    json(stationId != null ? `/trains?station_id=${stationId}` : "/trains", { method: "DELETE", headers: { "X-Confirm": "yes" } }),
  generateRandomTrain: (stationId?: number): Promise<Train> =>
    json("/generate-random-train", { method: "POST", body: JSON.stringify(stationId != null ? { station_id: stationId } : {}) }),
  generateTrainFromRoute: (code: string, options?: { operator_id?: number; observations?: string }): Promise<Train> =>
    json(`/trains/from-route/${encodeURIComponent(code)}`, { method: "POST", body: JSON.stringify(options || {}) }),

  listRoutes: (): Promise<Route[]> => fetchRoutes(),

  listOperators: (): Promise<Operator[]> => json("/operators"),
  createOperator: (name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return authFetch("/operators", { method: "POST", body: fd }).then((r) => r.json());
  },
  updateOperator: (id: number, name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return authFetch(`/operators/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
  },
  deleteOperator: (id: number) => json(`/operators/${id}`, { method: "DELETE" }),
  uploadOperatorPre: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return authFetch(`/operators/${id}/pre-announce`, { method: "POST", body: fd }).then((r) => r.json());
  },
  deleteOperatorPre: (id: number) => authFetch(`/operators/${id}/pre-announce`, { method: "DELETE" }),

  listTrainTypes: (): Promise<TrainType[]> => json("/train-types"),
  createTrainType: (code: string, name: string, color: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("code", code); fd.append("name", name); fd.append("color", color);
    if (logo) fd.append("logo", logo);
    return authFetch("/train-types", { method: "POST", body: fd }).then((r) => r.json());
  },
  updateTrainType: (id: number, code: string, name: string, color: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("code", code); fd.append("name", name); fd.append("color", color);
    if (logo) fd.append("logo", logo);
    return authFetch(`/train-types/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
  },
  deleteTrainType: (id: number) => json(`/train-types/${id}`, { method: "DELETE" }),
  uploadTrainTypePre: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return authFetch(`/train-types/${id}/pre-announce`, { method: "POST", body: fd }).then((r) => r.json());
  },
  deleteTrainTypePre: (id: number) => authFetch(`/train-types/${id}/pre-announce`, { method: "DELETE" }),

  listStations: (): Promise<Station[]> => json("/stations"),
  listDisplays: (): Promise<DisplaySummary[]> => json("/displays"),
  getStationDisplayConfig: (stationId: number): Promise<Config> =>
    fetch(`${API_URL}/api/stations/${stationId}/config`).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
  saveStationDisplayConfig: (stationId: number, config: Partial<Config>): Promise<Config> =>
    json(`/stations/${stationId}/config`, { method: "PUT", body: JSON.stringify(config) }),

  listPlaces: (): Promise<Place[]> => json("/places"),
  createPlace: (name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return authFetch("/places", { method: "POST", body: fd }).then((r) => r.json());
  },
  updatePlace: (id: number, name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return authFetch(`/places/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
  },
  deletePlace: (id: number) => json(`/places/${id}`, { method: "DELETE" }),
  uploadStationPre: (id: number, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return authFetch(`/stations/${id}/pre-announce`, { method: "POST", body: fd }).then((r) => r.json());
  },
  deleteStationPre: (id: number) => authFetch(`/stations/${id}/pre-announce`, { method: "DELETE" }),

  seedTrains: (): Promise<Train[]> => json("/seed-trains", { method: "POST" }),

  // ---- MULTISTATION SERVICES ----
  listServices: (filters?: { status?: string; operator_id?: number }): Promise<Service[]> =>
    json("/services" + (filters ? `?${new URLSearchParams(filters as any).toString()}` : ""))
      .then(r => r?.data || r || []),
  createService: (svc: Partial<Service>) =>
    json("/services", { method: "POST", body: JSON.stringify(svc) })
      .then(r => r?.data || r),
  getService: (id: number): Promise<{ service: Service; stops: ServiceStop[]; events: any[] }> =>
    json(`/services/${id}`)
      .then(r => r?.data || r),
  updateService: (id: number, svc: Partial<Service>) =>
    json(`/services/${id}`, { method: "PATCH", body: JSON.stringify(svc) })
      .then(r => r?.data || r),
  deleteService: (id: number) => json(`/services/${id}`, { method: "DELETE" })
    .then(r => r?.data || r),
  cancelService: (id: number, reason?: string) =>
    json(`/services/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) })
      .then(r => r?.data || r),

  // Service stops
  getServiceStops: (serviceId: number): Promise<ServiceStop[]> =>
    json(`/services/${serviceId}/stops`)
      .then(r => r?.data || r || []),
  createServiceStop: (serviceId: number, stop: Partial<ServiceStop>) =>
    json(`/services/${serviceId}/stops`, { method: "POST", body: JSON.stringify(stop) })
      .then(r => r?.data || r),
  updateServiceStop: (serviceId: number, stopId: number, stop: Partial<ServiceStop>) =>
    json(`/services/${serviceId}/stops/${stopId}`, { method: "PATCH", body: JSON.stringify(stop) })
      .then(r => r?.data || r),
  deleteServiceStop: (serviceId: number, stopId: number) =>
    json(`/services/${serviceId}/stops/${stopId}`, { method: "DELETE" })
      .then(r => r?.data || r),
  reorderServiceStops: (serviceId: number, order: number[]) =>
    json(`/services/${serviceId}/stops/reorder`, { method: "POST", body: JSON.stringify({ order }) })
      .then(r => r?.data || r),

  // Stop operations
  markArrival: (stopId: number, actual_time: string, platform?: string) =>
    json(`/stops/${stopId}/arrival`, { method: "POST", body: JSON.stringify({ actual_time, platform }) })
      .then(r => r?.data || r),
  markDeparture: (stopId: number, actual_time: string) =>
    json(`/stops/${stopId}/departure`, { method: "POST", body: JSON.stringify({ actual_time }) })
      .then(r => r?.data || r),
  markPass: (stopId: number, actual_time: string) =>
    json(`/stops/${stopId}/pass`, { method: "POST", body: JSON.stringify({ actual_time }) })
      .then(r => r?.data || r),
  addStopDelay: (stopId: number, minutes: number, reason?: string) =>
    json(`/stops/${stopId}/delay`, { method: "POST", body: JSON.stringify({ minutes, reason }) })
      .then(r => r?.data || r),

  // Board display
  getStationBoard: (stationId: number, mode?: "departures" | "arrivals" | "all"): Promise<any> =>
    fetch(`${API_URL}/api/stations/${stationId}/board${mode ? `?mode=${mode}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }),
};

export function connectWS(onUpdate: () => void) {
  const url = API_URL.replace(/^http/, "ws") + "/ws";
  let ws: WebSocket | null = null;
  let stop = false;
  const listeners: Map<string, Set<(msg: any) => void>> = new Map();

  const open = () => {
    ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        // Call generic update handler
        if (m.type === "update") onUpdate();
        // Call specific event listeners
        if (m.type && listeners.has(m.type)) {
          listeners.get(m.type)?.forEach(cb => cb(m));
        }
      } catch { /* noop */ }
    };
    ws.onclose = () => { if (!stop) setTimeout(open, 1500); };
    ws.onerror = () => ws?.close();
  };
  open();

  return {
    close: () => { stop = true; ws?.close(); },
    on: (eventType: string, callback: (msg: any) => void) => {
      if (!listeners.has(eventType)) listeners.set(eventType, new Set());
      listeners.get(eventType)!.add(callback);
      return () => listeners.get(eventType)?.delete(callback);
    },
  };
}

export function fileUrl(p: string | null | undefined) {
  if (!p) return null;
  return p.startsWith("http") ? p : `${API_URL}${p}`;
}
