import { fileURLToPath } from "url";
import path from "path";
import { getConfig, listTrains } from "../backend/src/db.js";
import RODALIA_ROUTES from "../backend/src/fixtures/routes.js";

function normalizeStation(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/estacio/g, "estacion")
    .replace(/valencia[-\s]*estacio(n)? del nord/g, "valencia nord")
    .replace(/valencia estacion del nord/g, "valencia nord")
    .replace(/barcelona[-\s]*sants/g, "barcelona sants")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stationIndex(stations, name) {
  const target = normalizeStation(name);
  return stations.findIndex((s) => normalizeStation(s) === target);
}

function profileForType(typeCode) {
  return {};
} // not needed here

function computePoolAndWeights() {
  const config = getConfig();
  const station = config.station_name || "Madrid Puerta de Atocha";
  const routesAtStation = RODALIA_ROUTES.filter((r) => stationIndex(r.stations, station) >= 0);
  const routePool = routesAtStation.length ? routesAtStation : RODALIA_ROUTES;
  const existing = listTrains().filter((t) => !["Departed", "Arrived"].includes(t.status));
  const routeCounts = new Map();
  for (const train of existing) routeCounts.set(train.type_code, (routeCounts.get(train.type_code) || 0) + 1);
  const pool = routePool.map((r) => ({ route: r, count: routeCounts.get(r.code) || 0 }));
  const weights = pool.map((p) => 1 / (1 + p.count));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  return { config, station, routePool, pool, weights, totalWeight, routeCounts, existing };
}

function simulateOnce(pool, weights, totalWeight) {
  let pick = Math.random() * totalWeight;
  let chosenIndex = 0;
  for (let i = 0; i < weights.length; i++) {
    pick -= weights[i];
    if (pick <= 0) {
      chosenIndex = i;
      break;
    }
  }
  return pool[chosenIndex % pool.length].route.code;
}

async function run(iter = 20000) {
  const { config, station, routePool, pool, weights, totalWeight, routeCounts, existing } = computePoolAndWeights();
  console.log("Config station_name:", config.station_name || "(unset)");
  console.log("Resolved station:", station);
  console.log("Routes at station:", routePool.map((r) => r.code).join(", "));
  console.log("Existing trains count:", existing.length);
  console.log("RouteCounts map:", Object.fromEntries([...routeCounts.entries()]));
  console.log("Pool sample (code -> count -> weight):");
  for (let i = 0; i < pool.length; i++) {
    console.log(`  ${pool[i].route.code} -> ${pool[i].count} -> ${weights[i].toFixed(4)}`);
  }
  console.log("Total weight:", totalWeight.toFixed(4));

  const counts = Object.create(null);
  for (let i = 0; i < iter; i++) {
    const code = simulateOnce(pool, weights, totalWeight);
    counts[code] = (counts[code] || 0) + 1;
  }
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => ({ code: c, count: n }));
  console.log(`\nDistribution after ${iter} picks:`);
  console.log(sorted);
  console.log("\nFull counts:", JSON.stringify(counts, null, 2));
}

const n = Number(process.argv[2] || 20000);
run(n).catch((err) => {
  console.error(err);
  process.exit(1);
});
