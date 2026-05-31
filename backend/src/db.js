import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.resolve(__dirname, "../data.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS operators (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL UNIQUE,
    logo_url         TEXT,
    pre_announce_ogg TEXT
  );

  CREATE TABLE IF NOT EXISTS train_types (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    code             TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    color            TEXT NOT NULL DEFAULT '#7c1d2e',
    logo_url         TEXT,
    pre_announce_ogg TEXT
  );

  CREATE TABLE IF NOT EXISTS places (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL UNIQUE,
    logo_url TEXT
  );

  CREATE TABLE IF NOT EXISTS stations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT NOT NULL,
    short            TEXT NOT NULL DEFAULT '',
    logo_url         TEXT,
    pre_announce_ogg TEXT,
    color            TEXT NOT NULL DEFAULT '#1A3254',
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS station_display_configs (
    station_id  INTEGER PRIMARY KEY REFERENCES stations(id) ON DELETE CASCADE,
    config_json  TEXT NOT NULL DEFAULT '{}',
    updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
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

const hasObservations = db.prepare("PRAGMA table_info('trains')").all().some((c) => c.name === "observations");
if (!hasObservations) {
  db.exec("ALTER TABLE trains ADD COLUMN observations TEXT DEFAULT ''");
}

const hasPlaceLogo = db.prepare("PRAGMA table_info('places')").all().some((c) => c.name === "logo_url");
if (!hasPlaceLogo) {
  db.exec("ALTER TABLE places ADD COLUMN logo_url TEXT");
}

const hasDisplayConfigs = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'station_display_configs'").get();
if (!hasDisplayConfigs) {
  db.exec(`
    CREATE TABLE station_display_configs (
      station_id  INTEGER PRIMARY KEY REFERENCES stations(id) ON DELETE CASCADE,
      config_json  TEXT NOT NULL DEFAULT '{}',
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

const hasStationId = db.prepare("PRAGMA table_info('trains')").all().some((c) => c.name === "station_id");
if (!hasStationId) {
  db.exec("ALTER TABLE trains ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL");
}

const hasOpPre = db.prepare("PRAGMA table_info('operators')").all().some((c) => c.name === "pre_announce_ogg");
if (!hasOpPre) {
  db.exec("ALTER TABLE operators ADD COLUMN pre_announce_ogg TEXT");
  db.exec("ALTER TABLE train_types ADD COLUMN pre_announce_ogg TEXT");
  db.exec("ALTER TABLE stations ADD COLUMN pre_announce_ogg TEXT");
}

const DEFAULT_CONFIG = {
  platformMin: "1",
  platformMax: "8",
  platformAllowEmpty: "1",
  sectorMin: "A",
  sectorMax: "D",
  sectorAllowEmpty: "1",
};

// Defaults
const seedConfig = db.prepare(
  "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)"
);
seedConfig.run("station_name", "MADRID PUERTA DE ATOCHA");
seedConfig.run("mode", "departures"); // departures | arrivals
seedConfig.run("displayMode", "multiple"); // single | multiple
seedConfig.run("platformMin", "1");
seedConfig.run("platformMax", "8");
seedConfig.run("platformAllowEmpty", "1");
seedConfig.run("sectorMin", "A");
seedConfig.run("sectorMax", "D");
seedConfig.run("sectorAllowEmpty", "1");
seedConfig.run("announce_departure", "Atención. Tren {type_name} {number} con destino a {destination}, efectuará su salida por la vía {platform}, sector {sector}.");
seedConfig.run("announce_arrival", "Atención. Tren {type_name} {number} procedente de {origin}, efectuará su llegada por la vía {platform}, sector {sector}.");
seedConfig.run("announce_templates_map", "{}");
seedConfig.run("announce_presets", JSON.stringify([
  { id: "welcome", label: "Bienvenida", text: "Bienvenidos a la estación. Mantengan su billete a mano y no crucen las vías." },
  { id: "closing", label: "Cierre", text: "Atención. La estación va a cerrar. Asegúrense de recoger todas sus pertenencias." },
  { id: "workshop", label: "Taller", text: "Atención. El taller de iniciación a la soldadura comenzará en 5 minutos en la sala contigua." },
  { id: "delay-warning", label: "Retraso general", text: "Rogamos disculpen las molestias. Debido a la densidad de tráfico ferroviario, algunos trenes pueden sufrir retrasos." },
  { id: "photo", label: "Foto", text: "Atención. Dentro de 10 minutos realizaremos la foto de grupo. Les rogamos se acerquen al área central." },
]));
seedConfig.run("tts_rate", "0.95");
seedConfig.run("tts_pitch", "1");
seedConfig.run("tts_volume", "1");
seedConfig.run("tts_voice", "");
seedConfig.run("tts_voice_map", "{}");

const hasStation = db.prepare("SELECT id FROM stations LIMIT 1").get();
const defaultStationName = getConfig().station_name || "Madrid Puerta de Atocha";
if (!hasStation) {
  db.prepare("INSERT INTO stations (name, short) VALUES (?, ?)").run(defaultStationName, defaultStationName);
} else {
  const firstStation = db.prepare("SELECT * FROM stations ORDER BY id ASC LIMIT 1").get();
  if (firstStation && /principal/i.test(firstStation.name || "") && /principal/i.test(firstStation.short || "")) {
    db.prepare("UPDATE stations SET name = ?, short = ? WHERE id = ?").run(defaultStationName, defaultStationName, firstStation.id);
  }
}

export function getConfig() {
  const rows = db.prepare("SELECT key, value FROM config").all();
  return {
    ...DEFAULT_CONFIG,
    ...Object.fromEntries(rows.map((r) => [r.key, r.value])),
  };
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

export function listTrains(stationId) {
  let sql = `SELECT t.*,
                    op.name              AS operator_name,
                    op.logo_url          AS operator_logo,
                    op.pre_announce_ogg  AS operator_pre_announce,
                    tt.code              AS type_code,
                    tt.name              AS type_name,
                    tt.color             AS type_color,
                    tt.logo_url          AS type_logo,
                    tt.pre_announce_ogg  AS type_pre_announce,
                    st.name              AS station_name,
                    st.short             AS station_short,
                    st.color             AS station_color,
                    st.pre_announce_ogg  AS station_pre_announce
             FROM trains t
             LEFT JOIN operators   op ON op.id = t.operator_id
             LEFT JOIN train_types tt ON tt.id = t.train_type_id
             LEFT JOIN stations    st ON st.id = t.station_id`;
  const params = [];
  if (stationId != null) {
    sql += ` WHERE t.station_id = ?`;
    params.push(stationId);
  }
  sql += ` ORDER BY t.sort_order ASC, t.expected_time ASC`;
  const rows = db.prepare(sql).all(...params);
  return rows.map(rowToTrain);
}

export function getTrain(id) {
  return rowToTrain(db.prepare("SELECT * FROM trains WHERE id = ?").get(id));
}

export function createTrain(t) {
  const stmt = db.prepare(`
    INSERT INTO trains
      (number, operator_id, train_type_id, origin, destination, stops,
       scheduled_time, expected_time, platform, sector, status, observations, station_id)
    VALUES
      (@number, @operator_id, @train_type_id, @origin, @destination, @stops,
       @scheduled_time, @expected_time, @platform, @sector, @status, @observations, @station_id)
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
    observations: t.observations || "",
    station_id: t.station_id ?? null,
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
       platform=@platform, sector=@sector, status=@status,
       observations=@observations, station_id=@station_id
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
    platform: next.platform || "-",
    sector: next.sector || "-",
    status: next.status,
    observations: next.observations || "",
    station_id: next.station_id ?? null,
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
  update: (id, { name, logo_url, pre_announce_ogg }) => {
    const cur = db.prepare("SELECT * FROM operators WHERE id = ?").get(id);
    if (!cur) return null;
    db.prepare("UPDATE operators SET name=?, logo_url=?, pre_announce_ogg=? WHERE id=?")
      .run(name ?? cur.name, logo_url !== undefined ? logo_url : cur.logo_url, pre_announce_ogg !== undefined ? pre_announce_ogg : cur.pre_announce_ogg, id);
    return db.prepare("SELECT * FROM operators WHERE id = ?").get(id);
  },
  remove: (id) => db.prepare("DELETE FROM operators WHERE id = ?").run(id),
};

export const trainTypes = {
  list: () => db.prepare("SELECT * FROM train_types ORDER BY code").all(),
  create: ({ code, name, color, logo_url, pre_announce_ogg }) =>
    db
      .prepare(
        "INSERT INTO train_types (code, name, color, logo_url, pre_announce_ogg) VALUES (?, ?, ?, ?, ?)"
      )
      .run(code, name, color || "#7c1d2e", logo_url || null, pre_announce_ogg || null),
  update: (id, { code, name, color, logo_url, pre_announce_ogg }) => {
    const cur = db.prepare("SELECT * FROM train_types WHERE id = ?").get(id);
    if (!cur) return null;
    db.prepare("UPDATE train_types SET code=?, name=?, color=?, logo_url=?, pre_announce_ogg=? WHERE id=?")
      .run(
        code ?? cur.code,
        name ?? cur.name,
        color ?? cur.color,
        logo_url !== undefined ? logo_url : cur.logo_url,
        pre_announce_ogg !== undefined ? pre_announce_ogg : cur.pre_announce_ogg,
        id,
      );
    return db.prepare("SELECT * FROM train_types WHERE id = ?").get(id);
  },
  remove: (id) => db.prepare("DELETE FROM train_types WHERE id = ?").run(id),
};

export const places = {
  list: () => db.prepare("SELECT * FROM places ORDER BY name").all(),
  create: ({ name, logo_url }) =>
    db.prepare("INSERT INTO places (name, logo_url) VALUES (?, ?)").run(name, logo_url || null),
  update: (id, { name, logo_url }) =>
    db.prepare("UPDATE places SET name = ?, logo_url = ? WHERE id = ?").run(name, logo_url || null, id),
  remove: (id) => db.prepare("DELETE FROM places WHERE id = ?").run(id),
};

export const stations = {
  list: () => db.prepare("SELECT * FROM stations ORDER BY sort_order ASC, name ASC").all(),
  get: (id) => db.prepare("SELECT * FROM stations WHERE id = ?").get(id),
  create: ({ name, short, color, logo_url }) =>
    db.prepare("INSERT INTO stations (name, short, color, logo_url) VALUES (?, ?, ?, ?)")
      .run(name, short || "", color || "#1A3254", logo_url || null),
  update: (id, { name, short, color, logo_url, sort_order, pre_announce_ogg }) => {
    const cur = db.prepare("SELECT * FROM stations WHERE id = ?").get(id);
    if (!cur) return null;
    db.prepare("UPDATE stations SET name=?, short=?, color=?, logo_url=?, sort_order=?, pre_announce_ogg=? WHERE id=?")
      .run(
        name ?? cur.name,
        short ?? cur.short,
        color ?? cur.color,
        logo_url !== undefined ? logo_url : cur.logo_url,
        sort_order ?? cur.sort_order,
        pre_announce_ogg !== undefined ? pre_announce_ogg : cur.pre_announce_ogg,
        id,
      );
    return db.prepare("SELECT * FROM stations WHERE id = ?").get(id);
  },
  remove: (id) => db.prepare("DELETE FROM stations WHERE id = ?").run(id),
};

export function countStations() {
  return db.prepare("SELECT COUNT(*) AS count FROM stations").get()?.count || 0;
}

const parseConfigJson = (value) => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const SUPPORTED_DISPLAY_LANGUAGES = new Set(["es", "ca", "en", "fr", "eu", "gl"]);

const normalizeDisplayLanguage = (value) => {
  const lang = String(value || "").toLowerCase().trim();
  return SUPPORTED_DISPLAY_LANGUAGES.has(lang) ? lang : "es";
};

const normalizeDisplayLanguages = (value, fallbackLanguage = "es") => {
  const rawList = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim().startsWith("[")
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return [value];
          }
        })()
      : typeof value === "string" && value.includes(",")
        ? value.split(",")
        : value != null
          ? [value]
          : [];
  const unique = [];
  for (const item of rawList) {
    const lang = normalizeDisplayLanguage(item);
    if (!unique.includes(lang)) unique.push(lang);
  }
  if (!unique.length) unique.push(normalizeDisplayLanguage(fallbackLanguage));
  return unique;
};

const normalizeStationDisplayConfig = (config) => {
  const primaryLanguage = normalizeDisplayLanguage(
    config?.language || (Array.isArray(config?.languages) ? config.languages[0] : null) || "es"
  );
  const languages = normalizeDisplayLanguages(config?.languages || config?.language, primaryLanguage);
  return {
    ...(config || {}),
    language: primaryLanguage,
    languages,
  };
};

const stationDisplayConfigDefaults = (station) => ({
  station_name: station?.short || station?.name || "",
  logo_url: station?.logo_url || null,
  routeRegion: "",
  ...DEFAULT_CONFIG,
  platformAllowEmpty: true,
  sectorAllowEmpty: true,
});

export function getStationDisplayConfig(stationId) {
  const station = stations.get(stationId);
  if (!station) return null;
  const row = db.prepare("SELECT config_json FROM station_display_configs WHERE station_id = ?").get(stationId);
  const overrides = parseConfigJson(row?.config_json);
  return normalizeStationDisplayConfig({
    ...getConfig(),
    ...stationDisplayConfigDefaults(station),
    ...overrides,
  });
}

export function setStationDisplayConfig(stationId, patch) {
  const station = stations.get(stationId);
  if (!station) return null;
  const current = getStationDisplayConfig(stationId) || {};
  const next = normalizeStationDisplayConfig({ ...current, ...(patch || {}) });
  const statement = db.prepare(`
    INSERT INTO station_display_configs (station_id, config_json, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(station_id) DO UPDATE SET
      config_json = excluded.config_json,
      updated_at = excluded.updated_at
  `);
  statement.run(stationId, JSON.stringify(next));
  return getStationDisplayConfig(stationId);
}

export function listStationDisplayConfigs() {
  const allStations = stations.list();
  return allStations.map((station) => ({
    station,
    config: getStationDisplayConfig(station.id),
  }));
}

// ---- MULTISTATION SUPPORT: Services and Service Stops ----

export const services = {
  list: (filters = {}) => {
    let sql = `
      SELECT s.*,
             op.name           AS operator_name,
             op.logo_url       AS operator_logo,
             tt.code           AS train_type_code,
             tt.name           AS train_type_name,
             tt.color          AS train_type_color,
             tt.logo_url       AS train_type_logo,
             org.name          AS origin_name,
             dst.name          AS destination_name,
             (SELECT COUNT(*) FROM service_stops ss WHERE ss.service_id = s.id) AS stops_count,
             (SELECT MAX(delay_minutes) FROM service_stops ss WHERE ss.service_id = s.id) AS delay_minutes,
             (SELECT id FROM service_stops ss WHERE ss.service_id = s.id 
              AND ss.state NOT IN ('Departed', 'Passed', 'Completed', 'Cancelled') LIMIT 1) AS next_stop_id,
             (SELECT st.name FROM service_stops ss 
              JOIN stations st ON st.id = ss.station_id 
              WHERE ss.service_id = s.id 
              AND ss.state NOT IN ('Departed', 'Passed', 'Completed', 'Cancelled') LIMIT 1) AS next_stop_name
      FROM services s
      LEFT JOIN operators op ON op.id = s.operator_id
      LEFT JOIN train_types tt ON tt.id = s.train_type_id
      LEFT JOIN places org ON org.id = s.origin_place_id
      LEFT JOIN places dst ON dst.id = s.destination_place_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ` AND s.status = ?`;
      params.push(filters.status);
    }
    if (filters.operator_id) {
      sql += ` AND s.operator_id = ?`;
      params.push(filters.operator_id);
    }

    sql += ` ORDER BY s.created_at DESC`;
    return db.prepare(sql).all(...params);
  },

  get: (id) => {
    return db.prepare(`
      SELECT s.*,
             op.name           AS operator_name,
             tt.code           AS train_type_code,
             tt.name           AS train_type_name,
             tt.color          AS train_type_color,
             org.name          AS origin_name,
             dst.name          AS destination_name
      FROM services s
      LEFT JOIN operators op ON op.id = s.operator_id
      LEFT JOIN train_types tt ON tt.id = s.train_type_id
      LEFT JOIN places org ON org.id = s.origin_place_id
      LEFT JOIN places dst ON dst.id = s.destination_place_id
      WHERE s.id = ?
    `).get(id);
  },

  create: ({ number, operator_id, train_type_id, origin_place_id, destination_place_id, notes }) => {
    const info = db.prepare(`
      INSERT INTO services (number, operator_id, train_type_id, origin_place_id, destination_place_id, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')
    `).run(number, operator_id || null, train_type_id || null, origin_place_id || null, destination_place_id || null, notes || null);
    return services.get(info.lastInsertRowid);
  },

  update: (id, { status, notes }) => {
    const cur = services.get(id);
    if (!cur) return null;
    db.prepare(`
      UPDATE services 
      SET status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status ?? cur.status, notes ?? cur.notes, id);
    return services.get(id);
  },

  cancel: (id, reason) => {
    const cur = services.get(id);
    if (!cur) return null;

    // Mark all stops as cancelled
    db.prepare(`
      UPDATE service_stops 
      SET state = 'Cancelled', updated_at = datetime('now')
      WHERE service_id = ?
    `).run(id);

    // Update service status
    db.prepare(`
      UPDATE services 
      SET status = 'Cancelled', cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    // Log event
    serviceEvents.log(id, null, 'service_cancelled', { reason });

    return services.get(id);
  },

  complete: (id) => {
    const cur = services.get(id);
    if (!cur) return null;
    db.prepare(`
      UPDATE services 
      SET status = 'Completed', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    serviceEvents.log(id, null, 'service_completed', {});
    return services.get(id);
  },

  remove: (id) => {
    db.prepare("DELETE FROM services WHERE id = ?").run(id);
  },
};

export const serviceStops = {
  listByService: (service_id) => {
    return db.prepare(`
      SELECT ss.*,
             st.name           AS station_name,
             st.short          AS station_short,
             st.color          AS station_color,
             s.number          AS service_number,
             s.operator_id,
             op.name           AS operator_name,
             tt.code           AS train_type_code,
             tt.color          AS train_type_color,
             dst.name          AS destination_name
      FROM service_stops ss
      JOIN stations st ON st.id = ss.station_id
      JOIN services s ON s.id = ss.service_id
      LEFT JOIN operators op ON op.id = s.operator_id
      LEFT JOIN train_types tt ON tt.id = s.train_type_id
      LEFT JOIN places dst ON dst.id = s.destination_place_id
      WHERE ss.service_id = ?
      ORDER BY ss.stop_number ASC
    `).all(service_id);
  },

  get: (id) => {
    return db.prepare(`
      SELECT ss.*,
             st.name           AS station_name,
             st.short          AS station_short,
             s.number          AS service_number
      FROM service_stops ss
      JOIN stations st ON st.id = ss.station_id
      JOIN services s ON s.id = ss.service_id
      WHERE ss.id = ?
    `).get(id);
  },

  create: ({ service_id, station_id, stop_number, stop_type, arrival_scheduled, departure_scheduled, platform, sector, notes }) => {
    const info = db.prepare(`
      INSERT INTO service_stops 
      (service_id, station_id, stop_number, stop_type, arrival_scheduled, departure_scheduled, 
       arrival_expected, departure_expected, state, platform, sector, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?)
    `).run(
      service_id, station_id, stop_number, stop_type,
      arrival_scheduled || null, departure_scheduled || null,
      arrival_scheduled || null, departure_scheduled || null,
      platform || null, sector || null, notes || null
    );
    return serviceStops.get(info.lastInsertRowid);
  },

  update: (id, { platform, sector, notes, delay_locked }) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;
    db.prepare(`
      UPDATE service_stops 
      SET platform = ?, sector = ?, notes = ?, delay_locked = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      platform ?? cur.platform,
      sector ?? cur.sector,
      notes ?? cur.notes,
      delay_locked !== undefined ? delay_locked : cur.delay_locked,
      id
    );
    return serviceStops.get(id);
  },

  reorder: (service_id, newOrder) => {
    // newOrder is an array of service_stop IDs in new order
    db.transaction(() => {
      newOrder.forEach((stop_id, index) => {
        db.prepare(`
          UPDATE service_stops 
          SET stop_number = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(index + 1, stop_id);
      });
    })();

    return serviceStops.listByService(service_id);
  },

  markArrival: (id, actual_time, platform) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    // Calculate delay
    const scheduled = new Date(cur.arrival_scheduled).getTime();
    const actual = new Date(actual_time).getTime();
    const delayMs = Math.max(0, actual - scheduled);
    const delayMinutes = Math.round(delayMs / 60000);

    db.transaction(() => {
      // Update this stop
      db.prepare(`
        UPDATE service_stops 
        SET state = 'Arrived', arrival_actual = ?, delay_minutes = ?, 
            arrival_expected = ?, platform = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        actual_time,
        delayMinutes,
        actual_time,
        platform !== undefined ? platform : cur.platform,
        id
      );

      // Propagate delay to subsequent stops if not locked
      if (delayMinutes > 0) {
        const service_id = cur.service_id;
        db.prepare(`
          UPDATE service_stops 
          SET delay_minutes = delay_minutes + ?,
              arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
              departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
              updated_at = datetime('now')
          WHERE service_id = ? 
            AND stop_number > ?
            AND delay_locked = 0
        `).run(delayMinutes, delayMinutes, delayMinutes, service_id, cur.stop_number);
      }

      // Log event
      serviceEvents.log(cur.service_id, id, 'stop_arrival', { actual_time, delay_minutes: delayMinutes });
    })();

    return serviceStops.get(id);
  },

  markDeparture: (id, actual_time) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    db.transaction(() => {
      // Update this stop
      db.prepare(`
        UPDATE service_stops 
        SET state = 'Departed', departure_actual = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(actual_time, id);

      // Check if this is the last stop
      const maxStop = db.prepare(`
        SELECT MAX(stop_number) as max_num 
        FROM service_stops 
        WHERE service_id = ?
      `).get(cur.service_id);

      if (cur.stop_number === maxStop.max_num) {
        // Mark service as completed
        services.complete(cur.service_id);
      } else {
        // Mark service as in progress
        db.prepare(`
          UPDATE services 
          SET status = 'In Progress', started_at = CASE WHEN started_at IS NULL THEN datetime('now') ELSE started_at END
          WHERE id = ?
        `).run(cur.service_id);
      }

      // Log event
      serviceEvents.log(cur.service_id, id, 'stop_departure', { actual_time });
    })();

    return serviceStops.get(id);
  },

  markPass: (id, actual_time) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    db.prepare(`
      UPDATE service_stops 
      SET state = 'Passed', arrival_actual = ?, departure_actual = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(actual_time, actual_time, id);

    serviceEvents.log(cur.service_id, id, 'stop_passed', { actual_time });
    return serviceStops.get(id);
  },

  addDelay: (id, minutes, reason) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    db.transaction(() => {
      // Update this stop's delay
      const newDelay = cur.delay_minutes + minutes;
      db.prepare(`
        UPDATE service_stops 
        SET delay_minutes = ?,
            arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
            departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(newDelay, minutes, minutes, id);

      // Propagate to subsequent stops if not locked
      db.prepare(`
        UPDATE service_stops 
        SET delay_minutes = delay_minutes + ?,
            arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
            departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
            updated_at = datetime('now')
        WHERE service_id = ? 
          AND stop_number > ?
          AND delay_locked = 0
      `).run(minutes, minutes, minutes, cur.service_id, cur.stop_number);

      // Log event
      serviceEvents.log(cur.service_id, id, 'delay_added', { minutes, reason, affected_stops: 'see DB' });
    })();

    return serviceStops.get(id);
  },

  remove: (id) => {
    const cur = serviceStops.get(id);
    if (!cur) return;

    db.transaction(() => {
      // Delete the stop
      db.prepare("DELETE FROM service_stops WHERE id = ?").run(id);

      // Reorder remaining stops
      const remaining = serviceStops.listByService(cur.service_id);
      remaining.forEach((stop, idx) => {
        db.prepare(`
          UPDATE service_stops 
          SET stop_number = ? 
          WHERE id = ?
        `).run(idx + 1, stop.id);
      });
    })();
  },
};

export const serviceEvents = {
  log: (service_id, stop_id, event_type, details) => {
    db.prepare(`
      INSERT INTO service_events (service_id, stop_id, event_type, details)
      VALUES (?, ?, ?, ?)
    `).run(service_id, stop_id || null, event_type, JSON.stringify(details));
  },

  listByService: (service_id, limit = 100) => {
    return db.prepare(`
      SELECT * FROM service_events 
      WHERE service_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(service_id, limit);
  },
};
