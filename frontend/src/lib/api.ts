export const API_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:4000";

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
  created_at?: string;
  sort_order?: number;
  status:
  | "Scheduled" | "Boarding" | "Delayed"
  | "Departed" | "Arrived" | "Cancelled";
};

export type Operator = { id: number; name: string; logo_url: string | null };
export type TrainType = { id: number; code: string; name: string; color: string; logo_url: string | null };
export type Place = { id: number; name: string; logo_url?: string | null };
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
};

const json = (path: string, init?: RequestInit) =>
  fetch(`${API_URL}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.status === 204 ? null : r.json();
  });

export const api = {
  getConfig: (): Promise<Config> => json("/config"),
  setConfig: (c: Partial<Config>) =>
    json("/config", { method: "PUT", body: JSON.stringify(c) }),

  listTrains: (): Promise<Train[]> => json("/trains"),
  reorderTrains: (ids: number[]) =>
    json("/trains/reorder", { method: "PUT", body: JSON.stringify({ ids }) }),
  createTrain: (t: Partial<Train>) =>
    json("/trains", { method: "POST", body: JSON.stringify(t) }),
  updateTrain: (id: number, t: Partial<Train>) =>
    json(`/trains/${id}`, { method: "PUT", body: JSON.stringify(t) }),
  setStatus: (id: number, status: Train["status"]) =>
    json(`/trains/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  addDelay: (id: number, minutes: number) =>
    json(`/trains/${id} / delay`, { method: "PATCH", body: JSON.stringify({ minutes }) }),
  setPlatform: (id: number, platform: string, sector: string) =>
    json(`/ trains / ${id}/platform`, { method: "PATCH", body: JSON.stringify({ platform, sector }) }),
  deleteTrain: (id: number) => json(`/trains/${id}`, { method: "DELETE" }),
  clearTrains: () => json("/trains", { method: "DELETE" }),
  generateRandomTrain: (): Promise<Train> =>
    json("/generate-random-train", { method: "POST", body: JSON.stringify({}) }),

  listOperators: (): Promise<Operator[]> => json("/operators"),
  createOperator: (name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return fetch(`${API_URL}/api/operators`, { method: "POST", body: fd }).then((r) => r.json());
  },
  updateOperator: (id: number, name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return fetch(`${API_URL}/api/operators/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
  },
  deleteOperator: (id: number) => json(`/operators/${id}`, { method: "DELETE" }),

  listTrainTypes: (): Promise<TrainType[]> => json("/train-types"),
  createTrainType: (code: string, name: string, color: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("code", code); fd.append("name", name); fd.append("color", color);
    if (logo) fd.append("logo", logo);
    return fetch(`${API_URL}/api/train-types`, { method: "POST", body: fd }).then((r) => r.json());
  },
  updateTrainType: (id: number, code: string, name: string, color: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("code", code); fd.append("name", name); fd.append("color", color);
    if (logo) fd.append("logo", logo);
    return fetch(`${API_URL}/api/train-types/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
  },
  deleteTrainType: (id: number) => json(`/train-types/${id}`, { method: "DELETE" }),

  listPlaces: (): Promise<Place[]> => json("/places"),
  createPlace: (name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return fetch(`${API_URL}/api/places`, { method: "POST", body: fd }).then((r) => r.json());
  },
  updatePlace: (id: number, name: string, logo?: File | null) => {
    const fd = new FormData();
    fd.append("name", name);
    if (logo) fd.append("logo", logo);
    return fetch(`${API_URL}/api/places/${id}`, { method: "PUT", body: fd }).then((r) => r.json());
  },
  deletePlace: (id: number) => json(`/places/${id}`, { method: "DELETE" }),

  seedTrains: (): Promise<Train[]> => json("/seed-trains", { method: "POST" }),
};

export function connectWS(onUpdate: () => void) {
  const url = API_URL.replace(/^http/, "ws") + "/ws";
  let ws: WebSocket | null = null;
  let stop = false;
  const open = () => {
    ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "update") onUpdate();
      } catch { /* noop */ }
    };
    ws.onclose = () => { if (!stop) setTimeout(open, 1500); };
    ws.onerror = () => ws?.close();
  };
  open();
  return () => { stop = true; ws?.close(); };
}

export function fileUrl(p: string | null | undefined) {
  if (!p) return null;
  return p.startsWith("http") ? p : `${API_URL}${p}`;
}
