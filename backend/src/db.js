import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../data.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS operators (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS train_types (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    code     TEXT NOT NULL UNIQUE,
    name     TEXT NOT NULL,
    color    TEXT NOT NULL DEFAULT '#7c1d2e',
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS places (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS trains (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    number          TEXT NOT NULL,
    operator_id     INTEGER REFERENCES operators(id)   ON DELETE SET NULL,
    train_type_id   INTEGER REFERENCES train_types(id) ON DELETE SET NULL,
    origin          TEXT NOT NULL,
    destination     TEXT NOT NULL,
    stops           TEXT NOT NULL DEFAULT '[]',
    scheduled_time  TEXT NOT NULL,
    expected_time   TEXT NOT NULL,
    platform        TEXT NOT NULL DEFAULT '-',
    sector          TEXT NOT NULL DEFAULT '-',
    status          TEXT NOT NULL DEFAULT 'Scheduled',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const hasSort = db.prepare("PRAGMA table_info('trains')").all().some((c) => c.name === "sort_order");
if (!hasSort) {
  db.exec("ALTER TABLE trains ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0");
  db.exec("UPDATE trains SET sort_order = id");
}

// Defaults
const seedConfig = db.prepare(
  "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)"
);
seedConfig.run("station_name", "MADRID PUERTA DE ATOCHA");
seedConfig.run("mode", "departures"); // departures | arrivals

export function getConfig() {
  const rows = db.prepare("SELECT key, value FROM config").all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setConfig(patch) {
  const stmt = db.prepare(
    "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  for (const [k, v] of Object.entries(patch)) stmt.run(k, String(v));
}

function rowToTrain(r) {
  if (!r) return null;
  return {
    ...r,
    stops: JSON.parse(r.stops || "[]"),
  };
}

export function listTrains() {
  const rows = db
    .prepare(
      `SELECT t.*,
              op.name     AS operator_name,
              op.logo_url AS operator_logo,
              tt.code     AS type_code,
              tt.name     AS type_name,
              tt.color    AS type_color,
              tt.logo_url AS type_logo
       FROM trains t
       LEFT JOIN operators   op ON op.id = t.operator_id
       LEFT JOIN train_types tt ON tt.id = t.train_type_id
        ORDER BY t.sort_order ASC, t.expected_time ASC`
    )
    .all();
  return rows.map(rowToTrain);
}

export function getTrain(id) {
  return rowToTrain(db.prepare("SELECT * FROM trains WHERE id = ?").get(id));
}

export function createTrain(t) {
  const stmt = db.prepare(`
    INSERT INTO trains
      (number, operator_id, train_type_id, origin, destination, stops,
       scheduled_time, expected_time, platform, sector, status)
    VALUES
      (@number, @operator_id, @train_type_id, @origin, @destination, @stops,
       @scheduled_time, @expected_time, @platform, @sector, @status)
  `);
  const info = stmt.run({
    number: t.number,
    operator_id: t.operator_id ?? null,
    train_type_id: t.train_type_id ?? null,
    origin: t.origin,
    destination: t.destination,
    stops: JSON.stringify(t.stops || []),
    scheduled_time: t.scheduled_time,
    expected_time: t.expected_time || t.scheduled_time,
    platform: t.platform || "-",
    sector: t.sector || "-",
    status: t.status || "Scheduled",
  });
  return getTrain(info.lastInsertRowid);
}

export function updateTrain(id, t) {
  const cur = getTrain(id);
  if (!cur) return null;
  const next = { ...cur, ...t };
  db.prepare(
    `UPDATE trains SET
       number=@number, operator_id=@operator_id, train_type_id=@train_type_id,
       origin=@origin, destination=@destination, stops=@stops,
       scheduled_time=@scheduled_time, expected_time=@expected_time,
       platform=@platform, sector=@sector, status=@status
     WHERE id=@id`
  ).run({
    id,
    number: next.number,
    operator_id: next.operator_id ?? null,
    train_type_id: next.train_type_id ?? null,
    origin: next.origin,
    destination: next.destination,
    stops: JSON.stringify(next.stops || []),
    scheduled_time: next.scheduled_time,
    expected_time: next.expected_time,
    platform: next.platform,
    sector: next.sector,
    status: next.status,
  });
  return getTrain(id);
}

export function deleteTrain(id) {
  db.prepare("DELETE FROM trains WHERE id = ?").run(id);
}

// ---- helpers used by routes ----

export function addMinutes(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + Number(minutes);
  const norm = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = String(Math.floor(norm / 60)).padStart(2, "0");
  const nm = String(norm % 60).padStart(2, "0");
  return `${nh}:${nm}`;
}

// ---- generic CRUD for operators, train_types, places ----

export const operators = {
  list: () => db.prepare("SELECT * FROM operators ORDER BY name").all(),
  create: ({ name, logo_url }) =>
    db
      .prepare("INSERT INTO operators (name, logo_url) VALUES (?, ?)")
      .run(name, logo_url || null),
  update: (id, { name, logo_url }) =>
    db
      .prepare("UPDATE operators SET name = ?, logo_url = ? WHERE id = ?")
      .run(name, logo_url || null, id),
  remove: (id) => db.prepare("DELETE FROM operators WHERE id = ?").run(id),
};

export const trainTypes = {
  list: () => db.prepare("SELECT * FROM train_types ORDER BY code").all(),
  create: ({ code, name, color, logo_url }) =>
    db
      .prepare(
        "INSERT INTO train_types (code, name, color, logo_url) VALUES (?, ?, ?, ?)"
      )
      .run(code, name, color || "#7c1d2e", logo_url || null),
  update: (id, { code, name, color, logo_url }) =>
    db
      .prepare("UPDATE train_types SET code = ?, name = ?, color = ?, logo_url = ? WHERE id = ?")
      .run(code, name, color || "#7c1d2e", logo_url || null, id),
  remove: (id) => db.prepare("DELETE FROM train_types WHERE id = ?").run(id),
};

export const places = {
  list: () => db.prepare("SELECT * FROM places ORDER BY name").all(),
  create: ({ name }) =>
    db.prepare("INSERT INTO places (name) VALUES (?)").run(name),
  remove: (id) => db.prepare("DELETE FROM places WHERE id = ?").run(id),
};
