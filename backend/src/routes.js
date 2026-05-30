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
  operators, trainTypes, places,
} from "./db.js";
import RODALIA_ROUTES from "./fixtures/routes.js";
import SEED_FIXTURES from "./fixtures/seedTrains.js";
import { broadcast } from "./ws.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "railboard";

const adminAuth = basicAuth({
  users: { admin: ADMIN_PASSWORD },
  challenge: true,
  realm: "Railboard Admin",
});

const upload = multer({
  storage: multer.diskStorage({
    destination: path.resolve(__dirname, "../uploads"),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    },
  }),
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

const r = Router();
const ping = () => broadcast({ type: "update", at: Date.now() });

// RODALIA_ROUTES moved to ./fixtures/routes.js

function ensureLearnedRailData() {
  const baseOperators = ["Renfe", "Iryo", "Ouigo", "SNCF"];
  const knownOperators = new Set(operators.list().map((o) => o.name));
  for (const opName of baseOperators) {
    if (!knownOperators.has(opName)) {
      operators.create({ name: opName });
      knownOperators.add(opName);
    }
  }

  const knownTypes = trainTypes.list().map((t) => t.code);
  for (const route of RODALIA_ROUTES) {
    if (!knownTypes.includes(route.code)) {
      trainTypes.create({ code: route.code, name: route.name, color: route.color });
    }
  }

  const knownPlaces = new Set(places.list().map((p) => p.name));
  for (const route of RODALIA_ROUTES) {
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
r.get("/trains", (_req, res) => res.json(listTrains()));

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

  const opList = operators.list();
  const typeList = trainTypes.list();
  const placeList = places.list();

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
  const routesAtStation = RODALIA_ROUTES.filter((r) => stationIndex(r.stations, station) >= 0);
  const routePool = routesAtStation.length ? routesAtStation : RODALIA_ROUTES;
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

export default r;
