import { Router } from "express";
import basicAuth from "express-basic-auth";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import {
  db,
  getConfig, setConfig,
  listTrains, createTrain, updateTrain, deleteTrain, getTrain,
  addMinutes,
  operators, trainTypes, places, stations,
  services, serviceStops, serviceEvents,
} from "./db.js";
import SEED_FIXTURES from "./fixtures/seedTrains.js";
import { broadcast } from "./ws.js";
import { getAllRoutes, reloadRoutesDataset } from "./services/routeService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard";

const adminAuth = basicAuth({
  users: { admin: ADMIN_PASSWORD },
  challenge: true,
  realm: "Railboard Admin",
});

const storage = multer.diskStorage({
  destination: path.resolve(__dirname, "../uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    const allowedExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error("Tipo de archivo no permitido. Solo imágenes (PNG, JPG, GIF, WebP, SVG).");
      err.code = "FILE_TYPE_NOT_ALLOWED";
      cb(err, false);
    }
  },
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["audio/ogg", "audio/opus", "audio/mpeg"];
    const allowedExts = [".ogg", ".opus", ".mp3"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      const err = new Error("Tipo de archivo no permitido. Solo OGG / Opus / MP3.");
      err.code = "FILE_TYPE_NOT_ALLOWED";
      cb(err, false);
    }
  },
});

const r = Router();
const ping = () => broadcast({ type: "update", at: Date.now() });

// RODALIA_ROUTES moved to ./fixtures/routes.js

function ensureLearnedRailData() {
  const railRoutes = getAllRoutes();
  const baseOperators = ["Renfe", "Iryo", "Ouigo", "SNCF"];
  const knownOperators = new Set(operators.list().map((o) => o.name));
  for (const opName of baseOperators) {
    if (!knownOperators.has(opName)) {
      operators.create({ name: opName });
      knownOperators.add(opName);
    }
  }

  const knownTypes = trainTypes.list().map((t) => t.code);
  for (const route of railRoutes) {
    if (!knownTypes.includes(route.code)) {
      trainTypes.create({ code: route.code, name: route.name, color: route.color });
    }
  }

  const knownPlaces = new Set(places.list().map((p) => p.name));
  for (const route of railRoutes) {
    for (const station of route.stations) {
      if (!knownPlaces.has(station)) {
        places.create({ name: station });
        knownPlaces.add(station);
      }
    }
  }
}

const normalizeStation = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/estacio/g, "estacion")
    .replace(/valencia[-\s]*estacio(n)? del nord/g, "valencia nord")
    .replace(/valencia estacion del nord/g, "valencia nord")
    .replace(/barcelona[-\s]*sants/g, "barcelona sants")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stationIndex = (stations, name) => {
  const target = normalizeStation(name);
  return stations.findIndex((station) => normalizeStation(station) === target);
};

function orderedIntermediateStops(stations, fromIndex, toIndex) {
  if (fromIndex === toIndex) return [];
  const step = fromIndex < toIndex ? 1 : -1;
  const stops = [];
  for (let i = fromIndex + step; i !== toIndex; i += step) {
    stops.push(stations[i]);
  }
  return stops;
}

const minutesFromHHMM = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const clockBaseFromConfig = (config) => {
  if (config?.clockMode !== "fake") return new Date();
  const [h = 12, m = 0, s = 0] = String(config.clockFakeTime || "12:00:00")
    .split(":")
    .map((part) => Number(part));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, Number.isFinite(s) ? s : 0, 0);
  return d;
};

const hhmmFromOffsetAt = (baseDate, offsetMin) => {
  const d = new Date(baseDate.getTime() + offsetMin * 60_000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const minutesUntilHHMM = (hhmm, baseDate = new Date()) => {
  let diff = minutesFromHHMM(hhmm) - (baseDate.getHours() * 60 + baseDate.getMinutes());
  if (diff < -12 * 60) diff += 24 * 60;
  if (diff > 12 * 60) diff -= 24 * 60;
  return diff;
};

// ----- config -----
r.get("/config", (_req, res) => res.json(getConfig()));
r.put("/config", adminAuth, (req, res) => {
  setConfig(req.body || {});
  ping();
  res.json(getConfig());
});

// ----- trains -----
r.get("/trains", (req, res) => {
  const stationId = req.query.station_id != null ? Number(req.query.station_id) : null;
  res.json(listTrains(stationId));
});

r.delete("/trains", adminAuth, (req, res) => {
  if (req.headers["x-confirm"] !== "yes") {
    return res.status(400).json({ error: 'Requiere header X-Confirm: yes para borrar todos los trenes.' });
  }
  db.exec("DELETE FROM trains");
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

r.post("/trains", adminAuth, (req, res) => {
  const t = createTrain(req.body);
  ping();
  res.status(201).json(t);
});
r.put("/trains/:id", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), req.body);
  if (!t) return res.status(404).end();
  ping();
  res.json(t);
});
r.patch("/trains/:id/status", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), { status: req.body.status });
  if (!t) return res.status(404).end();
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
  });
  ping();
  res.json(t);
});
r.patch("/trains/:id/platform", adminAuth, (req, res) => {
  const t = updateTrain(Number(req.params.id), {
    platform: req.body.platform,
    sector: req.body.sector,
  });
  if (!t) return res.status(404).end();
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
r.post("/operators", adminAuth, upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  operators.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(operators.list());
});
r.put("/operators/:id", adminAuth, upload.single("logo"), (req, res) => {
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
r.post("/operators/:id/pre-announce", adminAuth, uploadAudio.single("file"), (req, res) => {
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
r.post("/routes/reload", adminAuth, (_req, res) => res.json(reloadRoutesDataset()));

// ----- train types -----
r.get("/train-types", (_req, res) => res.json(trainTypes.list()));
r.post("/train-types", adminAuth, upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
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
    });
  } else {
    trainTypes.create({
      code,
      name: req.body.name,
      color: req.body.color,
      logo_url,
    });
  }
  ping();
  res.status(statusCode).json(trainTypes.list());
});
r.put("/train-types/:id", adminAuth, upload.single("logo"), (req, res) => {
  const id = Number(req.params.id);
  const logo_url = req.file ? `/uploads/${req.file.filename}` : req.body.logo_url;
  trainTypes.update(id, {
    code: req.body.code,
    name: req.body.name,
    color: req.body.color,
    logo_url,
  });
  ping();
  res.json(trainTypes.list());
});
r.delete("/train-types/:id", adminAuth, (req, res) => {
  trainTypes.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/train-types/:id/pre-announce", adminAuth, uploadAudio.single("file"), (req, res) => {
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
r.post("/places", adminAuth, upload.single("logo"), (req, res) => {
  const logo_url = req.file ? `/uploads/${req.file.filename}` : null;
  places.create({ name: req.body.name, logo_url });
  ping();
  res.status(201).json(places.list());
});
r.put("/places/:id", adminAuth, upload.single("logo"), (req, res) => {
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
  const s = stations.create(req.body);
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
  stations.remove(Number(req.params.id));
  ping();
  res.status(204).end();
});
r.post("/stations/:id/pre-announce", adminAuth, uploadAudio.single("file"), (req, res) => {
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
r.post("/generate-random-train", adminAuth, (_req, res) => {
  ensureLearnedRailData();
  const railRoutes = getAllRoutes();

  const opList = operators.list();
  const typeList = trainTypes.list();
  const placeList = places.list();
  if (railRoutes.length === 0) {
    return res.status(400).json({ error: "No routes available from backend data" });
  }

  if (opList.length === 0 || typeList.length === 0 || placeList.length === 0) {
    return res.status(400).json({ error: "Need at least one operator, train type, and place" });
  }

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const profileForType = (typeCode) => {
    if (/^(C(-\d+)?|R\d+[A-Z]?|R2N)$/i.test(typeCode)) {
      return { delayedProb: 0.16, cancelledProb: 0.03, advancedProb: 0.04, delayMin: 2, delayMax: 9 };
    }
    if (/^(MD)$/i.test(typeCode)) {
      return { delayedProb: 0.14, cancelledProb: 0.03, advancedProb: 0.03, delayMin: 4, delayMax: 16 };
    }
    if (/^(AVANT|AVE|IRYO|OUIGO|INOUI|EMD)$/i.test(typeCode)) {
      return { delayedProb: 0.09, cancelledProb: 0.02, advancedProb: 0.02, delayMin: 3, delayMax: 14 };
    }
    return { delayedProb: 0.12, cancelledProb: 0.03, advancedProb: 0.03, delayMin: 3, delayMax: 12 };
  };
  const statusForOffset = (offset, profile, modeValue) => {
    if (offset < 0) return modeValue === "arrivals" ? "Arrived" : "Departed";
    if (offset <= 8) return "Boarding";
    const roll = Math.random();
    if (roll < profile.cancelledProb) return "Cancelled";
    if (roll < profile.cancelledProb + profile.delayedProb) return "Delayed";
    if (roll < profile.cancelledProb + profile.delayedProb + profile.advancedProb) return "Advanced";
    return "Scheduled";
  };
  const config = getConfig();
  const clockBase = clockBaseFromConfig(config);
  const hhmmFromOffset = (offsetMin) => hhmmFromOffsetAt(clockBase, offsetMin);
  const mode = config.mode === "arrivals" ? "arrivals" : "departures";
  const station = config.station_name || "Madrid Puerta de Atocha";
  const routesAtStation = railRoutes.filter((r) => stationIndex(r.stations, station) >= 0);
  const routePool = routesAtStation.length ? routesAtStation : railRoutes;
  const existing = listTrains().filter((t) => !["Departed", "Arrived"].includes(t.status));
  const routeCounts = new Map();
  for (const train of existing) routeCounts.set(train.type_code, (routeCounts.get(train.type_code) || 0) + 1);
  const pool = routePool.map((r) => ({ route: r, count: routeCounts.get(r.code) || 0 }));
  const weights = pool.map((p) => 1 / (1 + p.count));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let pick = Math.random() * totalWeight;
  let chosenIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) { chosenIndex = i; break; }
  }
  const route = pool[chosenIndex % pool.length].route;
  const routeStationIndex = stationIndex(route.stations, station);
  const currentIndex = routeStationIndex >= 0 ? routeStationIndex : 0;
  const direction = currentIndex === 0 ? 1 : currentIndex === route.stations.length - 1 ? -1 : randomItem([-1, 1]);
  const terminalIndex = direction === 1 ? route.stations.length - 1 : 0;
  const xativaIndex = route.stations.indexOf("Xàtiva");
  const endIndex = route.code === "C-2" && direction === 1 && currentIndex < xativaIndex && Math.random() < 0.55
    ? xativaIndex
    : terminalIndex;
  const [fromIndex, toIndex] = mode === "arrivals" ? [endIndex, currentIndex] : [currentIndex, endIndex];
  const routeStops = orderedIntermediateStops(route.stations, fromIndex, toIndex);
  const op = opList.find((o) => o.name === (route.operator || "Renfe"))
    || opList.find((o) => o.name === "Renfe")
    || randomItem(opList);
  const type = typeList.find((t) => t.code === route.code) || randomItem(typeList);
  const sameLineUpcoming = existing
    .filter((t) => t.type_code === route.code)
    .map((t) => minutesUntilHHMM(t.scheduled_time, clockBase))
    .filter((offset) => offset > -5)
    .sort((a, b) => a - b);
  const lastOffset = sameLineUpcoming.length ? sameLineUpcoming[sameLineUpcoming.length - 1] : randomInt(2, 10);
  const scheduledOffset = Math.random() < 0.14
    ? -randomInt(2, 25)
    : Math.min(240, Math.max(3, lastOffset + route.headwayMin + randomInt(-3, 4)));
  const profile = profileForType(route.code);
  const rawStatus = statusForOffset(scheduledOffset, profile, mode);
  const expectedOffset = rawStatus === "Delayed"
    ? scheduledOffset + randomInt(profile.delayMin, profile.delayMax)
    : rawStatus === "Advanced"
      ? Math.max(1, scheduledOffset - randomInt(1, Math.min(7, profile.delayMax)))
      : scheduledOffset;
  const status = rawStatus === "Advanced" ? "Scheduled" : rawStatus;
  const maxStopLimit = Math.min(9, routeStops.length);
  const stopLimit = route.code === "C-3"
    ? routeStops.length
    : maxStopLimit > 0
      ? randomInt(Math.min(4, maxStopLimit), maxStopLimit)
      : 0;
  const stops = routeStops.slice(0, stopLimit);
  const usedNumbers = new Set(existing.map((t) => t.number));
  const availableNumbers = route.numbers.filter((number) => !usedNumbers.has(number));
  const observations = randomItem([
    "",
    "",
    "",
    "",
    "Por obras en el corredor",
    "Tren con parada en todas las estaciones",
    "Servicio sujeto a regulación de tráfico",
  ]);

  const train = createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmFromOffset(scheduledOffset),
    expected_time: hhmmFromOffset(expectedOffset),
    platform: randomItem(route.platforms),
    sector: "",
    status,
    observations,
  });

  ping();
  res.status(201).json(train);
});

// ----- generate train from specific route -----
r.post("/trains/from-route/:code", adminAuth, (req, res) => {
  ensureLearnedRailData();
  const railRoutes = getAllRoutes();
  const { code } = req.params;

  const route = railRoutes.find(r => r.code === code);
  if (!route) {
    return res.status(404).json({ error: `Route ${code} not found` });
  }

  const opList = req.body?.operator_id ?
    operators.list().filter(o => o.id === req.body.operator_id) :
    [operators.list().find(o => o.name === (route.operator || "Renfe")) ||
      operators.list().find(o => o.name === "Renfe") ||
      operators.list()[0]];

  const typeList = trainTypes.list();
  if (opList.length === 0 || typeList.length === 0) {
    return res.status(400).json({ error: "Missing operators or train types" });
  }

  const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const config = getConfig();
  const mode = config.mode === "arrivals" ? "arrivals" : "departures";
  const station = config.station_name || "Madrid Puerta de Atocha";
  const routeStationIndex = route.stations.indexOf(station);
  const currentIndex = routeStationIndex >= 0 ? routeStationIndex : 0;
  const direction = currentIndex === 0 ? 1 : currentIndex === route.stations.length - 1 ? -1 : randomItem([-1, 1]);
  const terminalIndex = direction === 1 ? route.stations.length - 1 : 0;
  const [fromIndex, toIndex] = mode === "arrivals" ? [terminalIndex, currentIndex] : [currentIndex, terminalIndex];

  const orderedIntermediateStops = (stations, from, to) => {
    const [start, end] = from <= to ? [from, to] : [to, from];
    return stations.slice(start + 1, end);
  };

  const routeStops = orderedIntermediateStops(route.stations, fromIndex, toIndex);
  const op = opList[0];
  const type = typeList.find(t => t.code === route.code) || randomItem(typeList);

  const existing = listTrains();
  const usedNumbers = new Set(existing.map(t => t.number));
  const availableNumbers = route.numbers.filter(number => !usedNumbers.has(number));

  const hhmmNow = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  const maxStopLimit = Math.min(9, routeStops.length);
  const stopLimit = maxStopLimit > 0 ? randomInt(Math.min(3, maxStopLimit), maxStopLimit) : 0;
  const stops = routeStops.slice(0, stopLimit);

  const train = createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmNow(),
    expected_time: hhmmNow(),
    platform: randomItem(route.platforms),
    sector: "",
    status: "Scheduled",
    observations: req.body?.observations || "",
  });

  ping();
  res.status(201).json(train);
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

    serviceEvents.log(service.id, null, 'service_created', { number });
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

    serviceEvents.log(Number(serviceId), stop.id, 'stop_created', { stop_number });
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
  const { order } = req.body;  // array of stop IDs in new order

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

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Arrived",
    delay_minutes: updated.delay_minutes,
    timestamp: Date.now()
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

  broadcast({
    type: "service_stop_state_changed",
    stop_id: updated.id,
    service_id: updated.service_id,
    new_state: "Departed",
    timestamp: Date.now()
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
    timestamp: Date.now()
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
    timestamp: Date.now()
  });

  res.json({ status: "ok", data: updated });
});

// ============ CRITICAL: BOARD DISPLAY ENDPOINT ============

// GET /stations/:stationId/board?mode=departures|arrivals|all
// Returns all service information needed for departure/arrival boards
r.get("/stations/:stationId/board", (req, res) => {
  const { stationId } = req.params;
  const { mode = "departures" } = req.query;
  const station = stations.list().find(s => s.id === Number(stationId));

  if (!station) {
    return res.status(404).json({ status: "error", error: "Station not found" });
  }

  // Legacy: Get trains from old table
  const trains = listTrains(Number(stationId));

  // New: Get services with stops at this station
  const allServices = services.list();
  const servicesWithStops = allServices
    .map(svc => {
      const stops = serviceStops.listByService(svc.id);
      return { service: svc, stops };
    })
    .filter(({ stops }) => stops.some(s => s.station_id === Number(stationId)))
    .map(({ service, stops }) => {
      const stopAtStation = stops.find(s => s.station_id === Number(stationId));
      return {
        ...service,
        stop_here: stopAtStation,
        all_stops: stops,
      };
    });

  // Filter by mode if provided
  const filtered = mode !== "all" ? {
    mode,
    trains: trains.filter(t => t.status !== "Cancelled"),
    services: servicesWithStops.filter(s => s.status !== "Cancelled"),
  } : {
    mode: "all",
    trains,
    services: servicesWithStops,
  };

  res.json({
    status: "ok",
    data: {
      station,
      timestamp: Date.now(),
      ...filtered,
    }
  });
});

export default r;
