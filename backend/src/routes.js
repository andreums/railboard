import { Router } from "express";
import {
  db,
  getConfig,
  setConfig,
  listTrains,
  createTrain,
  updateTrain,
  deleteTrain,
  getTrain,
  addMinutes,
  operators,
  trainTypes,
  places,
  stations,
  trainIcons,
  countStations,
  getStationDisplayConfig,
  setStationDisplayConfig,
  listStationDisplayConfigs,
  services,
  serviceStops,
  serviceEvents,
  announcementConfig,
  audioAssets,
  soundProfiles,
  soundRules,
  placeTtsPronunciations,
} from "./db.js";
import SEED_FIXTURES from "./fixtures/seedTrains.js";
import { broadcast } from "./ws.js";
import { getAllRoutes, getAvailableRegions, reloadRoutesDataset } from "./services/routeService.js";
import { adminAuth } from "./middleware/auth.js";
import { upload, uploadAudio, uploadTrainTypeFields, validateImageContent, validateAudioContent } from "./services/uploadService.js";
import { generateRandomTrain, generateTrainFromRoute } from "./services/trainGeneratorService.js";
import { buildStationBoard } from "./services/boardService.js";
import AnnouncementService from "./services/announcementService.js";
import { composeAnnouncements, testCompose, formatTimeForSpeech, formatLocalizedList, getAvailableLocales } from "./services/announcementComposer.js";

const announcementService = new AnnouncementService(db);
announcementService.initialize();

const r = Router();
const ping = () => broadcast({ type: "update", at: Date.now() });

// ----- config -----
r.get("/config", (_req, res) => res.json(getConfig()));
r.put("/config", adminAuth, (req, res) => {
  setConfig(req.body || {});
  ping();
  res.json(getConfig());
});

// ----- display configs -----
r.get("/displays", adminAuth, (_req, res) => {
  res.json(
    listStationDisplayConfigs().map(({ station, config }) => ({
      station,
      config,
      trains: listTrains(station.id),
    })),
  );
});

r.get("/stations/:id/config", (req, res) => {
  const config = getStationDisplayConfig(Number(req.params.id));
  if (!config) return res.status(404).json({ error: "Station not found" });
  res.json(config);
});

r.put("/stations/:id/config", adminAuth, (req, res) => {
  const config = setStationDisplayConfig(Number(req.params.id), req.body || {});
  if (!config) return res.status(404).json({ error: "Station not found" });
  ping();
  res.json(config);
});

// ----- trains -----
r.get("/trains", (req, res) => {
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  res.json(listTrains(stationId));
});

r.delete("/trains", adminAuth, (req, res) => {
  if (req.headers["x-confirm"] !== "yes") {
    return res.status(400).json({ error: "Requiere header X-Confirm: yes para borrar todos los trenes." });
  }
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  if (stationId != null && Number.isFinite(stationId)) {
    db.prepare("DELETE FROM trains WHERE station_id = ?").run(stationId);
  } else {
    db.exec("DELETE FROM trains");
  }
  ping();
  res.status(204).end();
});

function reorderTrains(ids) {
  const stmt = db.prepare("UPDATE trains SET sort_order = ? WHERE id = ?");
  ids.forEach((id, idx) => stmt.run(idx, id));
}

r.put("/trains/reorder", adminAuth, (req, res) => {
  reorderTrains(req.body.ids);
  ping();
  res.json(listTrains());
});

r.post("/trains", adminAuth, upload.single("custom_icon"), validateImageContent, (req, res) => {
  const body = req.body;
  if (req.file) {
    body.custom_icon_url = `/uploads/${req.file.filename}`;
  }
  const t = createTrain(body);
  ping();
  res.status(201).json(t);
});
r.put("/trains/:id", adminAuth, upload.single("custom_icon"), validateImageContent, (req, res) => {
  const body = req.body;
  if (req.file) {
    body.custom_icon_url = `/uploads/${req.file.filename}`;
  } else if (body.custom_icon_url === "") {
    body.custom_icon_url = null;
  }
  const t = updateTrain(Number(req.params.id), body);
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/status", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), { status: req.body.status });
  if (!t) return res.status(404).end();
  announcementService.onTrainUpdate(t);
  ping();
  res.json(t);
});
r.patch("/trains/:id/delay", adminAuth, (req, res) => {
  const cur = getTrain(Number(req.params.id));
  if (!cur) return res.status(404).end();
  const minutes = Number(req.body.minutes || 0);
  const t = updateTrain(cur.id, {
    expected_time: addMinutes(cur.expected_time, minutes),
    status: minutes > 0 ? "Delayed" : cur.status,
    delay_minutes: minutes,
    delay_reason: req.body.reason || null,
  });
  announcementService.onTrainUpdate(t);
  ping();
  res.json(t);
});
r.patch("/trains/:id/platform", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), {
    platform: req.body.platform,
    sector: req.body.sector,
  });
  if (!t) return res.status(404).end();
  announcementService.onTrainUpdate(t);
  ping();
  res.json(t);
});
r.delete("/trains/:id", adminAuth, (req, res) => {
  deleteTrain(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- operators -----
r.get("/operators", (_req, res) => res.json(operators.list()));
r.post("/operators", adminAuth, upload.single("logo"), validateImageContent, (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(operators.list());
});
r.put("/operators/:id", adminAuth, upload.single("logo"), validateImageContent, (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  operators.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(operators.list());
});
r.delete("/operators/:id", adminAuth, (req, res) => {
  operators.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/operators/:id/pre-announce", adminAuth, uploadAudio.single("file"), validateAudioContent, (req, res) => {
  const id = Number(req.params.id);
  const url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.update(id, { pre_announce_ogg: url });
  ping();
  res.json(operators.list());
});
r.delete("/operators/:id/pre-announce", adminAuth, (req, res) => {
  operators.update(Number(req.params.id), { pre_announce_ogg: null });
  ping();
  res.status(204).end();
});

// ----- routes (Rodalia, etc) -----
r.get("/routes", (_req, res) => res.json(getAllRoutes()));
r.get("/regions", (_req, res) => res.json(getAvailableRegions()));
r.get("/routes/export", adminAuth, (_req, res) => {
  const routes = getAllRoutes();
  res.setHeader("Content-Disposition", 'attachment; filename="railboard_routes.json"');
  res.type("application/json").send(JSON.stringify(routes, null, 2));
});
r.post("/routes/reload", adminAuth, (_req, res) => res.json(reloadRoutesDataset()));

// ----- train icons (library) -----
r.get("/train-icons", (_req, res) => res.json(trainIcons.list()));
r.post("/train-icons", adminAuth, upload.single("icon"), validateImageContent, (req, res) => {
  const icon_url = req.file ? `/uploads/${req.file.filename}` : null;
  if (!icon_url || !req.body.name) return res.status(400).json({ error: "name and icon required" });
  trainIcons.create({ name: req.body.name, icon_url });
  ping();
  res.status(201).json(trainIcons.list());
});
r.put("/train-icons/:id", adminAuth, upload.single("icon"), validateImageContent, (req, res) => {
  const id = Number(req.params.id);
  const icon_url = req.file ? `/uploads/${req.file.filename}` : req.body.icon_url;
  trainIcons.update(id, { name: req.body.name, icon_url });
  ping();
  res.json(trainIcons.list());
});
r.delete("/train-icons/:id", adminAuth, (req, res) => {
  trainIcons.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- train types -----
r.get("/train-types", (_req, res) => res.json(trainTypes.list()));

r.post("/train-types", adminAuth, uploadTrainTypeFields, validateImageContent, (req, res) => {
  const logo_url = req.files?.logo?.[0] ? `/uploads/${req.files.logo[0].filename}` : null;
  const destination_icon_url = req.files?.destination_icon?.[0] ? `/uploads/${req.files.destination_icon[0].filename}` : null;
  const code = String(req.body.code || "").trim();
  const existing = trainTypes.list().find((t) => t.code === code);
  let statusCode = 201;

  if (existing) {
    statusCode = 200;
    trainTypes.update(existing.id, {
      code,
      name: req.body.name,
      color: req.body.color,
      logo_url: logo_url ?? existing.logo_url,
      destination_icon_url: destination_icon_url ?? existing.destination_icon_url,
      announce_template: req.body.announce_template,
    });
  } else {
    trainTypes.create({
      code,
      name: req.body.name,
      color: req.body.color,
      logo_url,
      destination_icon_url,
      announce_template: req.body.announce_template,
    });
  }
  ping();
  res.status(statusCode).json(trainTypes.list());
});
r.put("/train-types/:id", adminAuth, uploadTrainTypeFields, validateImageContent, (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.files?.logo?.[0] ? `/uploads/${req.files.logo[0].filename}` : req.body.logo_url;
  const destination_icon_url = req.files?.destination_icon?.[0]
    ? `/uploads/${req.files.destination_icon[0].filename}`
    : req.body.destination_icon_url;
  trainTypes.update(id, {
    code: req.body.code,
    name: req.body.name,
    color: req.body.color,
    logo_url,
    destination_icon_url,
    announce_template: req.body.announce_template,
  });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id", adminAuth, (req, res) => {
  trainTypes.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/train-types/:id/pre-announce", adminAuth, uploadAudio.single("file"), validateAudioContent, (req, res) => {
  const id = Number(req.params.id);
  const url = req.file ? `/uploads/${req.file.filename}` : null;
  trainTypes.update(id, { pre_announce_ogg: url });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id/pre-announce", adminAuth, (req, res) => {
  trainTypes.update(Number(req.params.id), { pre_announce_ogg: null });
  ping();
  res.status(204).end();
});

// ----- places -----
r.get("/places", (_req, res) => res.json(places.list()));
r.post("/places", adminAuth, upload.single("logo"), validateImageContent, (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  places.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(places.list());
});
r.put("/places/:id", adminAuth, upload.single("logo"), validateImageContent, (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  places.update(id, { name: req.body.name, logo_url });
  ping();
  res.json(places.list());
});
r.delete("/places/:id", adminAuth, (req, res) => {
  places.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ----- stations -----
r.get("/stations", (_req, res) => res.json(stations.list()));
r.post("/stations", adminAuth, (req, res) => {
  stations.create(req.body);
  ping();
  res.status(201).json(stations.list());
});
r.put("/stations/:id", adminAuth, (req, res) => {
  const s = stations.update(Number(req.params.id), req.body);
  if (!s) return res.status(404).end();
  ping();
  res.json(stations.list());
});
r.delete("/stations/:id", adminAuth, (req, res) => {
  if (countStations() <= 1) {
    return res.status(400).json({ error: "Debe existir al menos un display." });
  }
  stations.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/stations/:id/pre-announce", adminAuth, uploadAudio.single("file"), validateAudioContent, (req, res) => {
  const id = Number(req.params.id);
  const url = req.file ? `/uploads/${req.file.filename}` : null;
  stations.update(id, { pre_announce_ogg: url });
  ping();
  res.json(stations.list());
});
r.delete("/stations/:id/pre-announce", adminAuth, (req, res) => {
  stations.update(Number(req.params.id), { pre_announce_ogg: null });
  ping();
  res.status(204).end();
});

// ----- export trains -----
r.get("/trains/export", adminAuth, (req, res) => {
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  const trains = listTrains(Number.isFinite(stationId) ? stationId : undefined);
  const filename = Number.isFinite(stationId) ? `railboard_trains_station_${stationId}.json` : "railboard_trains.json";
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.type("application/json").send(JSON.stringify(trains, null, 2));
});

// ----- seed (load demo trains) -----
r.post("/seed-trains", adminAuth, (_req, res) => {
  db.exec("DELETE FROM trains");

  const opList = operators.list().map((o) => o.name);
  if (!opList.includes("Renfe")) operators.create({ name: "Renfe" });
  if (!opList.includes("Avlo")) operators.create({ name: "Avlo" });
  if (!opList.includes("Iryo")) operators.create({ name: "Iryo" });
  if (!opList.includes("Ouigo")) operators.create({ name: "Ouigo" });

  const typeList = trainTypes.list().map((t) => t.code);
  if (!typeList.includes("AVE")) trainTypes.create({ code: "AVE", name: "Alta Velocidad", color: "#7c1d2e" });
  if (!typeList.includes("AVLO")) trainTypes.create({ code: "AVLO", name: "Avlo", color: "#5b1fb8" });
  if (!typeList.includes("ALVIA")) trainTypes.create({ code: "ALVIA", name: "Alvia", color: "#1f6fb2" });
  if (!typeList.includes("IC")) trainTypes.create({ code: "IC", name: "Intercity", color: "#2b6e3f" });
  if (!typeList.includes("MD")) trainTypes.create({ code: "MD", name: "Media Distancia", color: "#b25a1f" });
  if (!typeList.includes("C")) trainTypes.create({ code: "C", name: "Cercanías", color: "#c2185b" });

  const opId = (name) => operators.list().find((o) => o.name === name)?.id;
  const typeId = (code) => trainTypes.list().find((t) => t.code === code)?.id;

  const now = new Date();
  const hhmm = (offsetMin) => {
    const d = new Date(now.getTime() + offsetMin * 60_000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  for (const f of SEED_FIXTURES) {
    const sched = hhmm(f.min);
    const expected = f.delay ? hhmm(f.min + f.delay) : sched;
    createTrain({
      number: f.number,
      operator_id: opId(f.op),
      train_type_id: typeId(f.type),
      origin: "Madrid Puerta de Atocha",
      destination: f.destination,
      stops: f.stops,
      scheduled_time: sched,
      expected_time: expected,
      platform: f.platform,
      sector: f.sector,
      status: f.status,
    });
  }

  ping();
  res.json(listTrains());
});

// ----- generate random train -----
r.post("/generate-random-train", adminAuth, (req, res) => {
  try {
    const train = generateRandomTrain(req.body);
    ping();
    res.status(201).json(train);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ----- generate train from specific route -----
r.post("/trains/from-route/:code", adminAuth, (req, res) => {
  try {
    const train = generateTrainFromRoute(req.params.code, req.body);
    ping();
    res.status(201).json(train);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ============ MULTISTATION SERVICES ENDPOINTS ============

// GET /admin/services - List all services with filters
r.get("/services", adminAuth, (req, res) => {
  const { status, operator_id } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (operator_id) filters.operator_id = Number(operator_id);

  const data = services.list(filters);
  res.json({ status: "ok", data });
});

// POST /admin/services - Create new service
r.post("/services", adminAuth, (req, res) => {
  const { number, operator_id, train_type_id, origin_place_id, destination_place_id, notes } = req.body;

  if (!number) return res.status(400).json({ status: "error", error: "number is required" });

  try {
    const service = services.create({
      number,
      operator_id: operator_id ? Number(operator_id) : null,
      train_type_id: train_type_id ? Number(train_type_id) : null,
      origin_place_id: origin_place_id ? Number(origin_place_id) : null,
      destination_place_id: destination_place_id ? Number(destination_place_id) : null,
      notes,
    });

    serviceEvents.log(service.id, null, "service_created", { number });
    broadcast({ type: "service_created", service_id: service.id, timestamp: Date.now() });

    res.status(201).json({ status: "ok", data: service });
  } catch (error) {
    res.status(400).json({ status: "error", error: error.message });
  }
});

// GET /admin/services/:id - Get service detail with all stops
r.get("/services/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const service = services.get(Number(id));

  if (!service) return res.status(404).json({ status: "error", error: "Service not found" });

  const stops = serviceStops.listByService(service.id);
  const events = serviceEvents.listByService(service.id, 50);

  res.json({ status: "ok", data: { service, stops, events } });
});

// PATCH /admin/services/:id - Update service
r.patch("/services/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const updated = services.update(Number(id), { status, notes });
  if (!updated) return res.status(404).json({ status: "error", error: "Service not found" });

  broadcast({ type: "service_updated", service_id: updated.id, timestamp: Date.now() });
  res.json({ status: "ok", data: updated });
});

// DELETE /admin/services/:id - Delete service
r.delete("/services/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  services.remove(Number(id));
  broadcast({ type: "service_deleted", service_id: Number(id), timestamp: Date.now() });
  res.status(204).send();
});

// POST /admin/services/:id/cancel - Cancel service
r.post("/services/:id/cancel", adminAuth, (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const cancelled = services.cancel(Number(id), reason || "Cancelled by operator");
  if (!cancelled) return res.status(404).json({ status: "error", error: "Service not found" });

  broadcast({ type: "service_cancelled", service_id: cancelled.id, reason, timestamp: Date.now() });
  res.json({ status: "ok", data: cancelled });
});

// ============ SERVICE STOPS ENDPOINTS ============

// GET /admin/services/:serviceId/stops - List stops for a service
r.get("/services/:serviceId/stops", adminAuth, (req, res) => {
  const { serviceId } = req.params;
  const stops = serviceStops.listByService(Number(serviceId));
  res.json({ status: "ok", data: stops });
});

// POST /admin/services/:serviceId/stops - Create a stop
r.post("/services/:serviceId/stops", adminAuth, (req, res) => {
  const { serviceId } = req.params;
  const { station_id, stop_number, stop_type, arrival_scheduled, departure_scheduled, platform, sector, notes } = req.body;

  if (!station_id || !stop_number || !stop_type) {
    return res.status(400).json({ status: "error", error: "station_id, stop_number, stop_type are required" });
  }

  try {
    const stop = serviceStops.create({
      service_id: Number(serviceId),
      station_id: Number(station_id),
      stop_number: Number(stop_number),
      stop_type,
      arrival_scheduled,
      departure_scheduled,
      platform,
      sector,
      notes,
    });

    serviceEvents.log(Number(serviceId), stop.id, "stop_created", { stop_number });
    broadcast({ type: "service_stop_created", service_id: Number(serviceId), stop_id: stop.id, timestamp: Date.now() });

    res.status(201).json({ status: "ok", data: stop });
  } catch (error) {
    res.status(400).json({ status: "error", error: error.message });
  }
});

// PATCH /admin/services/:serviceId/stops/:stopId - Update a stop
r.patch("/services/:serviceId/stops/:stopId", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { platform, sector, notes, delay_locked } = req.body;

  const updated = serviceStops.update(Number(stopId), { platform, sector, notes, delay_locked });
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({ type: "service_stop_updated", stop_id: updated.id, timestamp: Date.now() });
  res.json({ status: "ok", data: updated });
});

// DELETE /admin/services/:serviceId/stops/:stopId - Delete a stop
r.delete("/services/:serviceId/stops/:stopId", adminAuth, (req, res) => {
  const { stopId } = req.params;
  serviceStops.remove(Number(stopId));
  broadcast({ type: "service_stop_deleted", stop_id: Number(stopId), timestamp: Date.now() });
  res.status(204).send();
});

// POST /admin/services/:serviceId/stops/reorder - Reorder stops
r.post("/services/:serviceId/stops/reorder", adminAuth, (req, res) => {
  const { serviceId } = req.params;
  const { order } = req.body; // array of stop IDs in new order

  if (!Array.isArray(order)) {
    return res.status(400).json({ status: "error", error: "order must be an array" });
  }

  const reordered = serviceStops.reorder(Number(serviceId), order);
  broadcast({ type: "service_stops_reordered", service_id: Number(serviceId), timestamp: Date.now() });
  res.json({ status: "ok", data: reordered });
});

// ============ SERVICE STOP OPERATIONS ============

// POST /admin/stops/:stopId/arrival - Mark arrival
r.post("/stops/:stopId/arrival", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { actual_time, platform } = req.body;

  if (!actual_time) {
    return res.status(400).json({ status: "error", error: "actual_time is required" });
  }

  const updated = serviceStops.markArrival(Number(stopId), actual_time, platform);
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });
  announcementService.onStopUpdate(updated, null);

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Arrived",
    delay_minutes: updated.delay_minutes,
    timestamp: Date.now(),
  });

  res.json({ status: "ok", data: updated });
});

// POST /admin/stops/:stopId/departure - Mark departure
r.post("/stops/:stopId/departure", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { actual_time } = req.body;

  if (!actual_time) {
    return res.status(400).json({ status: "error", error: "actual_time is required" });
  }

  const updated = serviceStops.markDeparture(Number(stopId), actual_time);
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });
  announcementService.onStopUpdate(updated, null);

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Departed",
    timestamp: Date.now(),
  });

  res.json({ status: "ok", data: updated });
});

// POST /admin/stops/:stopId/pass - Mark as passed (no stop)
r.post("/stops/:stopId/pass", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { actual_time } = req.body;

  if (!actual_time) {
    return res.status(400).json({ status: "error", error: "actual_time is required" });
  }

  const updated = serviceStops.markPass(Number(stopId), actual_time);
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Passed",
    timestamp: Date.now(),
  });

  res.json({ status: "ok", data: updated });
});

// POST /admin/stops/:stopId/delay - Add delay
r.post("/stops/:stopId/delay", adminAuth, (req, res) => {
  const { stopId } = req.params;
  const { minutes, reason } = req.body;

  if (!minutes || isNaN(minutes)) {
    return res.status(400).json({ status: "error", error: "minutes is required and must be a number" });
  }

  const updated = serviceStops.addDelay(Number(stopId), Number(minutes), reason || "Manual adjustment");
  if (!updated) return res.status(404).json({ status: "error", error: "Stop not found" });

  broadcast({
    type: "service_stop_delayed",
    stop_id: updated.id,
    service_id: updated.service_id,
    delay_minutes: updated.delay_minutes,
    reason: reason || "Manual adjustment",
    timestamp: Date.now(),
  });

  res.json({ status: "ok", data: updated });
});

// ============ CRITICAL: BOARD DISPLAY ENDPOINT ============

// GET /stations/:stationId/board?mode=departures|arrivals|all
// Returns all service information needed for departure/arrival boards
r.get("/stations/:stationId/board", (req, res) => {
  const { stationId } = req.params;
  const { mode = "departures" } = req.query;
  const board = buildStationBoard(stationId, mode);
  if (!board) return res.status(404).json({ status: "error", error: "Station not found" });
  res.json(board);
});

// ============ ANNOUNCEMENT SYSTEM ENDPOINTS ============

// GET /admin/announcements/config - Get announcement system config
r.get("/announcements/config", adminAuth, (_req, res) => {
  res.json({
    availableLocales: announcementService.getAvailableLocales(),
    availableEventTypes: announcementService.getAvailableEventTypes(),
    stats: announcementService.getStats(),
  });
});

// PUT /admin/announcements/config - Update station announcement config
r.put("/announcements/config", adminAuth, (req, res) => {
  const { station_id, ...patch } = req.body;
  if (station_id) {
    announcementConfig.setStationConfig(Number(station_id), patch);
    res.json(announcementConfig.getStationConfig(Number(station_id)));
  } else {
    res.status(400).json({ status: "error", error: "station_id is required" });
  }
});

// GET /admin/announcements/config/:stationId - Get station announcement config
r.get("/announcements/config/:stationId", (req, res) => {
  const config = announcementConfig.getStationConfig(Number(req.params.stationId));
  res.json(config || { languages: ["ca", "es", "en"], sound_mode: "SINGLE" });
});

// GET /admin/announcements/queue - Get announcement queue
r.get("/announcements/queue", adminAuth, (_req, res) => {
  const queue = announcementService.getQueue();
  res.json({ status: "ok", data: queue });
});

// GET /admin/announcements/history - Get announcement history
r.get("/announcements/history", adminAuth, (_req, res) => {
  const history = announcementService.getHistory();
  res.json({ status: "ok", data: history });
});

// POST /admin/announcements/test - Test compose an announcement
r.post("/announcements/test", adminAuth, (req, res) => {
  const { train, eventType, languages } = req.body;
  const data = train || req.body;
  const result = testCompose({ ...data, eventType, languages });
  res.json({ status: "ok", data: result });
});

// POST /admin/announcements/event - Trigger an announcement event manually
r.post("/announcements/event", adminAuth, (req, res) => {
  const { train, eventType, stationId, languages } = req.body;
  if (!train || !eventType) return res.status(400).json({ status: "error", error: "train and eventType are required" });

  const result = announcementService.testAnnouncement(train, eventType, languages || ["ca", "es", "en"]);

  const queueId = announcementService.enqueueManual(train, eventType, stationId || train.station_id, languages || ["ca", "es", "en"]);

  res.json({ status: "ok", data: { ...result, queueId } });
});

// GET /admin/announcements/events - Get event log
r.get("/announcements/events", adminAuth, (_req, res) => {
  const log = announcementService.getEventLog();
  res.json({ status: "ok", data: log });
});

// GET /admin/announcements/locales - Get available locales
r.get("/announcements/locales", (_req, res) => {
  const locales = announcementService.getAvailableLocales();
  res.json({ status: "ok", data: locales });
});

// ============ AUDIO ASSETS ENDPOINTS ============

r.get("/announcement-audio", adminAuth, (_req, res) => {
  res.json(audioAssets.list(req.query));
});

r.get("/announcement-audio/:id", adminAuth, (req, res) => {
  const asset = audioAssets.get(Number(req.params.id));
  if (!asset) return res.status(404).json({ status: "error", error: "Audio asset not found" });
  res.json(asset);
});

r.post("/announcement-audio/upload", adminAuth, uploadAudio.single("file"), validateAudioContent, (req, res) => {
  if (!req.file) return res.status(400).json({ status: "error", error: "No file uploaded" });
  const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "").toUpperCase();
  const format = ext === "OPUS" ? "OGG" : ext;
  const asset = audioAssets.create({
    name: req.body.name || req.file.originalname,
    asset_type: req.body.asset_type || "CUSTOM",
    format,
    file_path: `/uploads/${req.file.filename}`,
    original_filename: req.file.originalname,
  });
  ping();
  res.status(201).json({ status: "ok", data: asset });
});

r.put("/announcement-audio/:id", adminAuth, (req, res) => {
  const asset = audioAssets.update(Number(req.params.id), req.body);
  if (!asset) return res.status(404).json({ status: "error", error: "Audio asset not found" });
  ping();
  res.json({ status: "ok", data: asset });
});

r.delete("/announcement-audio/:id", adminAuth, (req, res) => {
  audioAssets.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ============ SOUND PROFILES ENDPOINTS ============

r.get("/announcement-sound-profiles", adminAuth, (_req, res) => {
  res.json(soundProfiles.list());
});

r.post("/announcement-sound-profiles", adminAuth, (req, res) => {
  const profile = soundProfiles.create(req.body);
  ping();
  res.status(201).json({ status: "ok", data: profile });
});

r.put("/announcement-sound-profiles/:id", adminAuth, (req, res) => {
  const profile = soundProfiles.update(Number(req.params.id), req.body);
  if (!profile) return res.status(404).json({ status: "error", error: "Profile not found" });
  ping();
  res.json({ status: "ok", data: profile });
});

r.delete("/announcement-sound-profiles/:id", adminAuth, (req, res) => {
  soundProfiles.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ============ SOUND RULES ENDPOINTS ============

r.get("/announcement-sound-rules", adminAuth, (_req, res) => {
  res.json(soundRules.list());
});

r.post("/announcement-sound-rules", adminAuth, (req, res) => {
  const rule = soundRules.create(req.body);
  ping();
  res.status(201).json({ status: "ok", data: rule });
});

r.put("/announcement-sound-rules/:id", adminAuth, (req, res) => {
  const rule = soundRules.update(Number(req.params.id), req.body);
  if (!rule) return res.status(404).json({ status: "error", error: "Rule not found" });
  ping();
  res.json({ status: "ok", data: rule });
});

r.delete("/announcement-sound-rules/:id", adminAuth, (req, res) => {
  soundRules.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});

// ============ PLACE TTS PRONUNCIATIONS ENDPOINTS ============

r.get("/place-tts-pronunciations", adminAuth, (_req, res) => {
  res.json(placeTtsPronunciations.list());
});

r.post("/place-tts-pronunciations", adminAuth, (req, res) => {
  const { display_name, language, pronunciation } = req.body;
  if (!display_name || !language || !pronunciation) {
    return res.status(400).json({ status: "error", error: "display_name, language, pronunciation are required" });
  }
  const result = placeTtsPronunciations.set(display_name, language, pronunciation);
  res.json({ status: "ok", data: result });
});

r.delete("/place-tts-pronunciations/:id", adminAuth, (req, res) => {
  placeTtsPronunciations.remove(Number(req.params.id));
  res.status(204).end();
});

// ============ ANNOUNCEMENT HELPER ENDPOINTS ============

r.post("/announcements/format-time", (req, res) => {
  const { time, language } = req.body;
  if (!time) return res.status(400).json({ status: "error", error: "time is required" });
  const speech = formatTimeForSpeech(time, language || "ca");
  res.json({ display: time, speech });
});

r.post("/announcements/format-list", (req, res) => {
  const { items, language } = req.body;
  if (!items) return res.status(400).json({ status: "error", error: "items is required" });
  const formatted = formatLocalizedList(items, language || "ca");
  res.json({ formatted });
});

// ============ ANNOUNCEMENT TRIGGER FROM DATA CHANGES ============

// When a train is created, updated, status changed, etc. - trigger announcement
const originalPatchStatus = r.patch;
const originalPostTrain = r.post;

// Hook into train updates for auto-announcements
// We listen for updates and process them through the announcement service

export default r;
