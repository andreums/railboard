import { Router } from "express";
import logger from "./logger.js";
import { listTrains, services, serviceStops, stations, getStationDisplayConfig, trainTypes } from "./db.js";
import {
  getAllRoutes,
  getRouteByCode,
  getRoutesByNetwork,
  getAvailableRegions,
  getStationsByRoute,
  getAllStations,
  searchStation,
  getAvailableNetworks,
  getAvailableOperators,
  reloadRoutesDataset,
} from "./services/routeService.js";

const r = Router();

const toHHMM = (value) => {
  if (!value) return null;
  const s = String(value);
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return null;
};

const classifyMovement = (stopType) => {
  if (stopType === "Origin") return "departure";
  if (stopType === "Destination") return "arrival";
  if (stopType === "Pass") return "pass";
  return "mixed";
};

const modeAllows = (mode, movement) => {
  if (mode === "mixed" || mode === "all") return true;
  if (mode === "departures") return movement === "departure" || movement === "mixed" || movement === "pass";
  if (mode === "arrivals") return movement === "arrival" || movement === "mixed" || movement === "pass";
  return true;
};

const toSortMinutes = (hhmm) => {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return Number.MAX_SAFE_INTEGER;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function validateRow(row, ctx) {
  const hasDirection = Boolean(row.destination || row.origin);
  if (!row.time || !row.number || !hasDirection || !row.platform || !row.status) {
    logger.warn({ ctx, row }, "invalid row");
    return false;
  }
  return true;
}

function buildRowsFromServices(stationId, mode) {
  const svcList = services.list().filter((s) => s.status !== "Cancelled");
  const rows = [];

  for (const svc of svcList) {
    const stops = serviceStops.listByService(svc.id);
    const here = stops.filter((s) => s.station_id === stationId && s.state !== "Cancelled");
    if (!here.length) continue;

    const stopNames = stops.map((s) => s.station_short || s.station_name).filter(Boolean);
    for (const stop of here) {
      const movement = classifyMovement(stop.stop_type);
      if (!modeAllows(mode, movement)) continue;

      const timeBase =
        movement === "arrival" ? stop.arrival_scheduled || stop.departure_scheduled : stop.departure_scheduled || stop.arrival_scheduled;
      const expectedBase =
        movement === "arrival" ? stop.arrival_expected || stop.departure_expected : stop.departure_expected || stop.arrival_expected;

      const trainType = svc.train_type_id ? trainTypes.list().find((t) => t.id === svc.train_type_id) : null;
      const row = {
        movement,
        serviceId: svc.id,
        stopId: stop.id,
        time: toHHMM(timeBase) || "00:00",
        expectedTime: toHHMM(expectedBase) || toHHMM(timeBase) || "00:00",
        delayMinutes: stop.delay_minutes || 0,
        number: svc.number || `SVC-${svc.id}`,
        operatorName: svc.operator_name || "Operador",
        operatorLogo: svc.operator_logo || null,
        trainTypeCode: trainType?.code || svc.train_type_code || "SERV",
        trainTypeName: trainType?.name || svc.train_type_name || "Servicio",
        trainTypeColor: trainType?.color || null,
        trainTypeLogo: svc.train_type_logo || trainType?.logo_url || null,
        trainTypeDestinationIcon: trainType?.destination_icon_url || null,
        customIcon: null,
        iconMode: "destination",
        origin: svc.origin_name || stopNames[0] || "Origen",
        destination: svc.destination_name || stopNames[stopNames.length - 1] || "Destino",
        platform: stop.platform || "?",
        sector: stop.sector || "",
        status: stop.state === "Scheduled" ? "Scheduled" : stop.state,
        stopsText: stopNames.length > 1 ? stopNames.join(" · ") : "",
        observations: stop.notes || svc.notes || "",
      };
      if (validateRow(row, `service:${svc.id}/stop:${stop.id}`)) rows.push(row);
    }
  }
  return rows;
}

function buildRowsFromTrains(stationId, mode) {
  const trains = listTrains(stationId).filter((t) => !["Departed", "Arrived"].includes(t.status));
  const rows = [];
  for (const t of trains) {
    const movement = mode === "arrivals" ? "arrival" : "departure";
    const row = {
      movement,
      serviceId: null,
      stopId: null,
      time: toHHMM(t.scheduled_time) || "00:00",
      expectedTime: toHHMM(t.expected_time) || toHHMM(t.scheduled_time) || "00:00",
      delayMinutes: 0,
      number: t.number || `TR-${t.id}`,
      operatorName: t.operator_name || "Operador",
      operatorLogo: t.operator_logo || null,
      trainTypeCode: t.type_code || "",
      trainTypeName: t.type_name || "Tren",
      trainTypeColor: t.type_color || null,
      trainTypeLogo: t.type_logo || null,
      trainTypeDestinationIcon: t.type_destination_icon || null,
      customIcon: t.custom_icon_url || null,
      iconMode: t.icon_mode || "destination",
      origin: t.origin || "Origen",
      destination: t.destination || "Destino",
      platform: t.platform || "?",
      sector: t.sector || "",
      status: t.status || "Scheduled",
      stopsText: Array.isArray(t.stops) ? t.stops.join(" · ") : "",
      observations: t.observations || "",
    };
    if (modeAllows(mode, row.movement) && validateRow(row, `train:${t.id}`)) rows.push(row);
  }
  return rows;
}

r.get("/routes", (_req, res) => res.json(getAllRoutes()));

r.get("/routes/:code", (req, res) => {
  const route = getRouteByCode(req.params.code);
  if (!route) return res.status(404).json({ error: "Route not found" });
  return res.json(route);
});

r.get("/routes/network/:network", (req, res) => res.json(getRoutesByNetwork(req.params.network)));
r.get("/regions", (_req, res) => res.json(getAvailableRegions()));

r.get("/routes/:code/stations", (req, res) => res.json(getStationsByRoute(req.params.code)));

r.get("/stations", (_req, res) => res.json(getAllStations()));

r.get("/stations/search", (req, res) => {
  const q = String(req.query.q || "");
  return res.json(searchStation(q));
});

r.get("/networks", (_req, res) => res.json(getAvailableNetworks()));

r.get("/operators", (_req, res) => res.json(getAvailableOperators()));

r.get("/stations/:stationId/board", (req, res) => {
  const stationId = Number(req.params.stationId);
  const mode = String(req.query.mode || "departures");
  const station = stations.list().find((s) => s.id === stationId);
  if (!station) return res.status(404).json({ error: "Station not found" });
  const stationConfig = getStationDisplayConfig(stationId);

  // Try trains first (they have correct data), then fall back to services
  const trainRows = buildRowsFromTrains(stationId, mode);
  const serviceRows = trainRows.length === 0 ? buildRowsFromServices(stationId, mode) : [];
  const source = trainRows.length > 0 ? "trains" : "services";
  const rows = (trainRows.length > 0 ? trainRows : serviceRows).sort((a, b) => {
    const tA = toSortMinutes(a.expectedTime || a.time);
    const tB = toSortMinutes(b.expectedTime || b.time);
    if (tA !== tB) return tA - tB;
    return String(a.number).localeCompare(String(b.number), "es");
  });

  return res.json({
    station: {
      id: station.id,
      name: station.name,
      displayName: (stationConfig?.station_name || station.short || station.name || "").toUpperCase(),
    },
    mode: mode === "all" ? "mixed" : mode,
    source,
    rows,
    generatedAt: new Date().toISOString(),
  });
});

r.get("/stations/:stationId/config", (req, res) => {
  const config = getStationDisplayConfig(Number(req.params.stationId));
  if (!config) return res.status(404).json({ error: "Station not found" });
  res.json(config);
});

r.post("/admin/routes/reload", (_req, res) => {
  const stats = reloadRoutesDataset();
  return res.json(stats);
});

export default r;
