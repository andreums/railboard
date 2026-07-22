import { stations, listTrains, updateTrain, setConfig } from "../src/db.js";

const STATIONS = [
  { name: "Madrid Puerta de Atocha", short: "Madrid Atocha", color: "#1A3254" },
  { name: "Barcelona Sants", short: "Barcelona Sants", color: "#1D3557" },
  { name: "València Estació del Nord", short: "València Nord", color: "#2A9D8F" },
  { name: "Sevilla Santa Justa", short: "Sevilla", color: "#6A4C93" },
  { name: "Bilbao Abando", short: "Bilbao", color: "#264653" },
];

const normalize = (v) =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const stationByNeedle = [
  { needle: "madrid", stationName: "Madrid Puerta de Atocha" },
  { needle: "barcelona", stationName: "Barcelona Sants" },
  { needle: "valencia", stationName: "València Estació del Nord" },
  { needle: "sevilla", stationName: "Sevilla Santa Justa" },
  { needle: "bilbao", stationName: "Bilbao Abando" },
];

function ensureStations() {
  const existing = stations.list();
  const byName = new Map(existing.map((s) => [normalize(s.name), s]));

  for (const [idx, seed] of STATIONS.entries()) {
    const key = normalize(seed.name);
    const found = byName.get(key);
    if (!found) {
      stations.create({ name: seed.name, short: seed.short, color: seed.color });
    }
  }

  // normalize ordering and labels
  const refreshed = stations.list();
  const targetOrder = STATIONS.map((s) => normalize(s.name));
  refreshed.forEach((st) => {
    const ix = targetOrder.indexOf(normalize(st.name));
    if (ix >= 0) {
      stations.update(st.id, { short: STATIONS[ix].short, color: STATIONS[ix].color, sort_order: ix });
    }
  });

  return stations.list();
}

function inferStationId(train, stationMap, fallbackIds, fallbackIndexRef) {
  const text = normalize(`${train.origin} ${train.destination}`);
  for (const rule of stationByNeedle) {
    if (text.includes(rule.needle)) {
      const id = stationMap.get(normalize(rule.stationName));
      if (id) return id;
    }
  }

  const id = fallbackIds[fallbackIndexRef.value % fallbackIds.length];
  fallbackIndexRef.value += 1;
  return id;
}

function assignTrains(stationRows) {
  const byNameToId = new Map(stationRows.map((s) => [normalize(s.name), s.id]));
  const stationIds = stationRows
    .filter((s) => STATIONS.some((cfg) => normalize(cfg.name) === normalize(s.name)))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => s.id);

  const trains = listTrains();
  const fallbackIndexRef = { value: 0 };

  for (const train of trains) {
    const stationId = inferStationId(train, byNameToId, stationIds, fallbackIndexRef);
    updateTrain(train.id, { station_id: stationId });
  }
}

function report(stationRows) {
  const trains = listTrains();
  const counts = new Map();
  for (const st of stationRows) counts.set(st.id, 0);
  for (const tr of trains) counts.set(tr.station_id, (counts.get(tr.station_id) || 0) + 1);

  console.log("\n✅ Configuración multiestación aplicada\n");
  for (const st of stationRows
    .filter((s) => STATIONS.some((cfg) => normalize(cfg.name) === normalize(s.name)))
    .sort((a, b) => a.sort_order - b.sort_order)) {
    const count = counts.get(st.id) || 0;
    console.log(`- [${st.id}] ${st.name} (${st.short}) -> ${count} trenes`);
    console.log(`  Display: http://localhost:5173/display/${st.id}`);
  }
}

const stationRows = ensureStations();
assignTrains(stationRows);
setConfig({ station_name: "Madrid Puerta de Atocha", mode: "departures" });
report(stationRows);
