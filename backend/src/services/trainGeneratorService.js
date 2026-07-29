import { operators, trainTypes, places, stations, listTrains, createTrain, getConfig, getStationDisplayConfig } from "../db.js";
import { getAllRoutes } from "./routeService.js";
import { randomItem, randomInt } from "../lib/random.js";
import { pickObservation, pickDisplayLanguage } from "../data/observationBank.js";

export function ensureLearnedRailData() {
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
      const isCommuter =
        /^([A-Z]{2}-)?C(-\d+[A-Z]?)?$|^[A-Z]{2}-C\d/i.test(route.code) ||
        /^(R\d+[A-Z]?|R2N)$/i.test(route.code);
      trainTypes.create({
        code: route.code,
        name: route.name,
        color: route.color,
        logo_url: isCommuter ? "/uploads/CERCANIAS.png" : undefined,
      });
    }
  }

  // Set Cercanías logo on existing types that lack it
  const commuterRegex = /^([A-Z]{2}-)?C(-\d+[A-Z]?)?$|^[A-Z]{2}-C\d|^(R\d+[A-Z]?|R2N)$/i;
  const allTypes = trainTypes.list();
  for (const tt of allTypes) {
    if (!tt.logo_url && commuterRegex.test(tt.code)) {
      trainTypes.update(tt.id, { logo_url: "/uploads/CERCANIAS.png" });
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

const stationIndex = (stationNames, name) => {
  const target = normalizeStation(name);
  return stationNames.findIndex((station) => normalizeStation(station) === target);
};

const isTruthy = (value) => value === true || value === 1 || value === "1" || value === "true";

const normalizeChoiceBounds = (minRaw, maxRaw) => {
  const min = String(minRaw ?? "").trim();
  const max = String(maxRaw ?? "").trim();
  if (!min && !max) return [];
  if (min && max && /^\d+$/.test(min) && /^\d+$/.test(max)) {
    const start = Number(min);
    const end = Number(max);
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    const width = Math.max(min.length, max.length);
    return Array.from({ length: hi - lo + 1 }, (_, idx) => String(lo + idx).padStart(width, "0"));
  }
  if (min && max && min.length === 1 && max.length === 1) {
    const start = min.toUpperCase().charCodeAt(0);
    const end = max.toUpperCase().charCodeAt(0);
    const [lo, hi] = start <= end ? [start, end] : [end, start];
    return Array.from({ length: hi - lo + 1 }, (_, idx) => String.fromCharCode(lo + idx));
  }
  return [min || max].filter(Boolean);
};

const choiceFromConfig = (config, key, fallback = []) => {
  const min = config?.[`${key}Min`];
  const max = config?.[`${key}Max`];
  const allowEmpty = isTruthy(config?.[`${key}AllowEmpty`]);
  const choices = normalizeChoiceBounds(min, max);
  if (choices.length === 0) return allowEmpty ? [""] : [...fallback];
  return allowEmpty ? ["", ...choices] : choices;
};

const getRouteRegion = (route) => {
  const haystack = normalizeStation(`${route.network} ${route.name}`);
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
};

function orderedIntermediateStops(stationNames, fromIndex, toIndex) {
  if (fromIndex === toIndex) return [];
  const step = fromIndex < toIndex ? 1 : -1;
  const stops = [];
  for (let i = fromIndex + step; i !== toIndex; i += step) {
    stops.push(stationNames[i]);
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

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function generateRandomTrain(body) {
  ensureLearnedRailData();
  const railRoutes = getAllRoutes();

  const opList = operators.list();
  const typeList = trainTypes.list();
  const placeList = places.list();
  if (railRoutes.length === 0) {
    throw httpError(400, "No routes available from backend data");
  }

  if (opList.length === 0 || typeList.length === 0 || placeList.length === 0) {
    throw httpError(400, "Need at least one operator, train type, and place");
  }

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
  const requestedStationId = body?.station_id != null ? Number(body.station_id) : null;
  const stationRow = requestedStationId != null && Number.isFinite(requestedStationId) ? stations.get(requestedStationId) : null;
  const station = stationRow?.name || config.station_name || "Madrid Puerta de Atocha";
  const stationConfig = stationRow ? getStationDisplayConfig(stationRow.id) : config;
  const routesAtStation = railRoutes.filter((r) => stationIndex(r.stations, station) >= 0);
  const requestedRegion = String(stationConfig?.routeRegion || "").trim();
  const routePoolSource = routesAtStation.length ? routesAtStation : railRoutes;
  const routePool = requestedRegion ? routePoolSource.filter((route) => getRouteRegion(route) === requestedRegion) : routePoolSource;
  if (!routePool.length) {
    throw httpError(
      400,
      requestedRegion
        ? `No hay rutas disponibles para la región "${requestedRegion}" en este display.`
        : "No routes available for this display",
    );
  }
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
    if (pick <= 0) {
      chosenIndex = i;
      break;
    }
  }
  const route = pool[chosenIndex % pool.length].route;
  const routeStationIndex = stationIndex(route.stations, station);
  const currentIndex = routeStationIndex >= 0 ? routeStationIndex : 0;
  const direction = currentIndex === 0 ? 1 : currentIndex === route.stations.length - 1 ? -1 : randomItem([-1, 1]);
  const terminalIndex = direction === 1 ? route.stations.length - 1 : 0;
  const xativaIndex = route.stations.indexOf("Xàtiva");
  const endIndex =
    route.code === "C-2" && direction === 1 && currentIndex < xativaIndex && Math.random() < 0.55 ? xativaIndex : terminalIndex;
  const [fromIndex, toIndex] = mode === "arrivals" ? [endIndex, currentIndex] : [currentIndex, endIndex];
  const routeStops = orderedIntermediateStops(route.stations, fromIndex, toIndex);
  const op = opList.find((o) => o.name === (route.operator || "Renfe")) || opList.find((o) => o.name === "Renfe") || randomItem(opList);
  const type = typeList.find((t) => t.code === route.code) || randomItem(typeList);
  const sameLineUpcoming = existing
    .filter((t) => t.type_code === route.code)
    .map((t) => minutesUntilHHMM(t.scheduled_time, clockBase))
    .filter((offset) => offset > -5)
    .sort((a, b) => a - b);
  const lastOffset = sameLineUpcoming.length ? sameLineUpcoming[sameLineUpcoming.length - 1] : randomInt(2, 10);
  const scheduledOffset =
    Math.random() < 0.14 ? -randomInt(2, 25) : Math.min(240, Math.max(3, lastOffset + route.headwayMin + randomInt(-3, 4)));
  const profile = profileForType(route.code);
  const rawStatus = statusForOffset(scheduledOffset, profile, mode);
  const expectedOffset =
    rawStatus === "Delayed"
      ? scheduledOffset + randomInt(profile.delayMin, profile.delayMax)
      : rawStatus === "Advanced"
        ? Math.max(1, scheduledOffset - randomInt(1, Math.min(7, profile.delayMax)))
        : scheduledOffset;
  const status = rawStatus === "Advanced" ? "Scheduled" : rawStatus;
  const maxStopLimit = Math.min(9, routeStops.length);
  const stopLimit = route.code === "C-3" ? routeStops.length : maxStopLimit > 0 ? randomInt(Math.min(4, maxStopLimit), maxStopLimit) : 0;
  const stops = routeStops.slice(0, stopLimit);
  const usedNumbers = new Set(existing.map((t) => t.number));
  const availableNumbers = route.numbers.filter((number) => !usedNumbers.has(number));
  const observations = pickObservation({
    language: pickDisplayLanguage(stationConfig || config),
    status,
  });

  const stoppingPattern = route.code === "C-3" ? "ALL_STATIONS"
    : /^(C|R\d+[A-Z]?|R2N)$/i.test(route.code) ? "SEMI_FAST"
    : /^(AVE|IRYO|OUIGO|INOUI|EMD)$/i.test(type?.code || route.code) ? "DIRECT"
    : routeStops.length <= 1 ? "DIRECT"
    : "ONLY_STOPS_AT";

  return createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmFromOffset(scheduledOffset),
    expected_time: hhmmFromOffset(expectedOffset),
    platform: randomItem(choiceFromConfig(stationConfig, "platform", route.platforms)),
    sector: randomItem(choiceFromConfig(stationConfig, "sector", [""])),
    status,
    observations,
    station_id: stationRow?.id ?? null,
    stoppingPattern,
  });
}

export function generateTrainFromRoute(code, body) {
  ensureLearnedRailData();
  const railRoutes = getAllRoutes();

  const route = railRoutes.find((r) => r.code === code);
  if (!route) {
    throw httpError(404, `Route ${code} not found`);
  }

  const opList = body?.operator_id
    ? operators.list().filter((o) => o.id === body.operator_id)
    : [
        operators.list().find((o) => o.name === (route.operator || "Renfe")) ||
          operators.list().find((o) => o.name === "Renfe") ||
          operators.list()[0],
      ];

  const typeList = trainTypes.list();
  if (opList.length === 0 || typeList.length === 0) {
    throw httpError(400, "Missing operators or train types");
  }

  const config = getConfig();
  const mode = config.mode === "arrivals" ? "arrivals" : "departures";
  const station = config.station_name || "Madrid Puerta de Atocha";
  const stationRow = stations.list().find((s) => normalizeStation(s.name) === normalizeStation(station)) || null;
  const stationConfig = stationRow ? getStationDisplayConfig(stationRow.id) : config;
  const routeStationIndex = route.stations.indexOf(station);
  const currentIndex = routeStationIndex >= 0 ? routeStationIndex : 0;
  const direction = currentIndex === 0 ? 1 : currentIndex === route.stations.length - 1 ? -1 : randomItem([-1, 1]);
  const terminalIndex = direction === 1 ? route.stations.length - 1 : 0;
  const [fromIndex, toIndex] = mode === "arrivals" ? [terminalIndex, currentIndex] : [currentIndex, terminalIndex];

  const orderedIntermediateStopsSlice = (stationNames, from, to) => {
    const [start, end] = from <= to ? [from, to] : [to, from];
    return stationNames.slice(start + 1, end);
  };

  const routeStops = orderedIntermediateStopsSlice(route.stations, fromIndex, toIndex);
  const op = opList[0];
  const type = typeList.find((t) => t.code === route.code) || randomItem(typeList);

  const existing = listTrains();
  const usedNumbers = new Set(existing.map((t) => t.number));
  const availableNumbers = route.numbers.filter((number) => !usedNumbers.has(number));

  const hhmmNow = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const maxStopLimit = Math.min(9, routeStops.length);
  const stopLimit = maxStopLimit > 0 ? randomInt(Math.min(3, maxStopLimit), maxStopLimit) : 0;
  const stops = routeStops.slice(0, stopLimit);

  return createTrain({
    number: availableNumbers.length ? randomItem(availableNumbers) : randomItem(route.numbers),
    operator_id: op.id,
    train_type_id: type.id,
    origin: route.stations[fromIndex],
    destination: route.stations[toIndex],
    stops,
    scheduled_time: hhmmNow(),
    expected_time: hhmmNow(),
    platform: randomItem(choiceFromConfig(stationConfig, "platform", route.platforms)),
    sector: randomItem(choiceFromConfig(stationConfig, "sector", [""])),
    status: "Scheduled",
    observations:
      body?.observations ||
      pickObservation({
        language: pickDisplayLanguage(stationConfig || config),
        status: "Scheduled",
      }),
    station_id: stationRow?.id ?? null,
    stoppingPattern: routeStops.length <= 1 ? "DIRECT" : "ONLY_STOPS_AT",
  });
}
