import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { runMigrations } from "./migrations.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.resolve(__dirname, "../data.db");

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

runMigrations(db);

const DEFAULT_CONFIG = {
  platformMin: "1",
  platformMax: "8",
  platformAllowEmpty: "1",
  sectorMin: "A",
  sectorMax: "D",
  sectorAllowEmpty: "1",
};

// Defaults
const seedConfig = db.prepare("INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)");
seedConfig.run("station_name", "MADRID PUERTA DE ATOCHA");
seedConfig.run("mode", "departures"); // departures | arrivals
seedConfig.run("displayMode", "multiple"); // single | multiple
seedConfig.run("platformMin", "1");
seedConfig.run("platformMax", "8");
seedConfig.run("platformAllowEmpty", "1");
seedConfig.run("sectorMin", "A");
seedConfig.run("sectorMax", "D");
seedConfig.run("sectorAllowEmpty", "1");
seedConfig.run(
  "announce_departure",
  "Atención. Tren {type_name} {number} con destino a {destination}, efectuará su salida por la vía {platform}, sector {sector}.",
);
seedConfig.run(
  "announce_arrival",
  "Atención. Tren {type_name} {number} procedente de {origin}, efectuará su llegada por la vía {platform}, sector {sector}.",
);
seedConfig.run("announce_templates_map", "{}");
seedConfig.run(
  "announce_presets",
  JSON.stringify([
    { id: "welcome", label: "Bienvenida", text: "Bienvenidos a la estación. Mantengan su billete a mano y no crucen las vías." },
    { id: "closing", label: "Cierre", text: "Atención. La estación va a cerrar. Asegúrense de recoger todas sus pertenencias." },
    {
      id: "workshop",
      label: "Taller",
      text: "Atención. El taller de iniciación a la soldadura comenzará en 5 minutos en la sala contigua.",
    },
    {
      id: "delay-warning",
      label: "Retraso general",
      text: "Rogamos disculpen las molestias. Debido a la densidad de tráfico ferroviario, algunos trenes pueden sufrir retrasos.",
    },
    {
      id: "photo",
      label: "Foto",
      text: "Atención. Dentro de 10 minutos realizaremos la foto de grupo. Les rogamos se acerquen al área central.",
    },
  ]),
);
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
  const stmt = db.prepare("INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [k, v] of Object.entries(patch)) stmt.run(k, String(v));
}

function rowToTrain(r) {
  if (!r) return null;
  return {
    ...r,
    stops: JSON.parse(r.stops || "[]"),
    fare_restrictions: JSON.parse(r.fare_restrictions || "null"),
    except_stations: JSON.parse(r.except_stations || "[]"),
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
                     tt.destination_icon_url AS type_destination_icon,
                     tt.announce_template  AS type_announce_template,
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
       scheduled_time, expected_time, platform, sector, status, observations,
       station_id, custom_icon_url, icon_mode, stopping_pattern, fare_restrictions, except_stations)
    VALUES
      (@number, @operator_id, @train_type_id, @origin, @destination, @stops,
       @scheduled_time, @expected_time, @platform, @sector, @status, @observations,
       @station_id, @custom_icon_url, @icon_mode, @stopping_pattern, @fare_restrictions, @except_stations)
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
    custom_icon_url: t.custom_icon_url || null,
    icon_mode: t.icon_mode || "destination",
    stopping_pattern: t.stopping_pattern || t.stoppingPattern || null,
    fare_restrictions: JSON.stringify(t.fare_restrictions || null),
    except_stations: JSON.stringify(t.except_stations || []),
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
       observations=@observations, station_id=@station_id,
       custom_icon_url=@custom_icon_url, icon_mode=@icon_mode,
       stopping_pattern=@stopping_pattern, fare_restrictions=@fare_restrictions, except_stations=@except_stations
     WHERE id=@id`,
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
    custom_icon_url: next.custom_icon_url || null,
    icon_mode: next.icon_mode || "destination",
    stopping_pattern: next.stopping_pattern || null,
    fare_restrictions: JSON.stringify(next.fare_restrictions || null),
    except_stations: JSON.stringify(next.except_stations || []),
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
  create: ({ name, logo_url }) => db.prepare("INSERT INTO operators (name, logo_url) VALUES (?, ?)").run(name, logo_url || null),
  update: (id, { name, logo_url, pre_announce_ogg }) => {
    const cur = db.prepare("SELECT * FROM operators WHERE id = ?").get(id);
    if (!cur) return null;
    db.prepare("UPDATE operators SET name=?, logo_url=?, pre_announce_ogg=? WHERE id=?").run(
      name ?? cur.name,
      logo_url !== undefined ? logo_url : cur.logo_url,
      pre_announce_ogg !== undefined ? pre_announce_ogg : cur.pre_announce_ogg,
      id,
    );
    return db.prepare("SELECT * FROM operators WHERE id = ?").get(id);
  },
  remove: (id) => db.prepare("DELETE FROM operators WHERE id = ?").run(id),
};

export const trainTypes = {
  list: () => db.prepare("SELECT * FROM train_types ORDER BY code").all(),
  create: ({ code, name, color, logo_url, pre_announce_ogg, destination_icon_url, announce_template }) =>
    db
      .prepare(
        "INSERT INTO train_types (code, name, color, logo_url, pre_announce_ogg, destination_icon_url, announce_template) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        code,
        name,
        color || "#7c1d2e",
        logo_url || null,
        pre_announce_ogg || null,
        destination_icon_url || null,
        announce_template || null,
      ),
  update: (id, { code, name, color, logo_url, pre_announce_ogg, destination_icon_url, announce_template }) => {
    const cur = db.prepare("SELECT * FROM train_types WHERE id = ?").get(id);
    if (!cur) return null;
    db.prepare(
      "UPDATE train_types SET code=?, name=?, color=?, logo_url=?, pre_announce_ogg=?, destination_icon_url=?, announce_template=? WHERE id=?",
    ).run(
      code ?? cur.code,
      name ?? cur.name,
      color ?? cur.color,
      logo_url !== undefined ? logo_url : cur.logo_url,
      pre_announce_ogg !== undefined ? pre_announce_ogg : cur.pre_announce_ogg,
      destination_icon_url !== undefined ? destination_icon_url : cur.destination_icon_url,
      announce_template !== undefined ? announce_template : cur.announce_template,
      id,
    );
    return db.prepare("SELECT * FROM train_types WHERE id = ?").get(id);
  },
  remove: (id) => db.prepare("DELETE FROM train_types WHERE id = ?").run(id),
};

export const places = {
  list: () => db.prepare("SELECT * FROM places ORDER BY name").all(),
  create: ({ name, logo_url }) => db.prepare("INSERT INTO places (name, logo_url) VALUES (?, ?)").run(name, logo_url || null),
  update: (id, { name, logo_url }) => db.prepare("UPDATE places SET name = ?, logo_url = ? WHERE id = ?").run(name, logo_url || null, id),
  remove: (id) => db.prepare("DELETE FROM places WHERE id = ?").run(id),
};

export const trainIcons = {
  list: () => db.prepare("SELECT * FROM train_icons ORDER BY name").all(),
  create: ({ name, icon_url }) => db.prepare("INSERT INTO train_icons (name, icon_url) VALUES (?, ?)").run(name, icon_url),
  update: (id, { name, icon_url }) => db.prepare("UPDATE train_icons SET name = ?, icon_url = ? WHERE id = ?").run(name, icon_url, id),
  remove: (id) => db.prepare("DELETE FROM train_icons WHERE id = ?").run(id),
};

export const stations = {
  list: () => db.prepare("SELECT * FROM stations ORDER BY sort_order ASC, name ASC").all(),
  get: (id) => db.prepare("SELECT * FROM stations WHERE id = ?").get(id),
  create: ({ name, short, color, logo_url }) =>
    db
      .prepare("INSERT INTO stations (name, short, color, logo_url) VALUES (?, ?, ?, ?)")
      .run(name, short || "", color || "#1A3254", logo_url || null),
  update: (id, { name, short, color, logo_url, sort_order, pre_announce_ogg }) => {
    const cur = db.prepare("SELECT * FROM stations WHERE id = ?").get(id);
    if (!cur) return null;
    db.prepare("UPDATE stations SET name=?, short=?, color=?, logo_url=?, sort_order=?, pre_announce_ogg=? WHERE id=?").run(
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
  const lang = String(value || "")
    .toLowerCase()
    .trim();
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
    config?.language || (Array.isArray(config?.languages) ? config.languages[0] : null) || "es",
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
    return db
      .prepare(
        `
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
    `,
      )
      .get(id);
  },

  create: ({ number, operator_id, train_type_id, origin_place_id, destination_place_id, notes }) => {
    const info = db
      .prepare(
        `
      INSERT INTO services (number, operator_id, train_type_id, origin_place_id, destination_place_id, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')
    `,
      )
      .run(number, operator_id || null, train_type_id || null, origin_place_id || null, destination_place_id || null, notes || null);
    return services.get(info.lastInsertRowid);
  },

  update: (id, { status, notes }) => {
    const cur = services.get(id);
    if (!cur) return null;
    db.prepare(
      `
      UPDATE services 
      SET status = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(status ?? cur.status, notes ?? cur.notes, id);
    return services.get(id);
  },

  cancel: (id, reason) => {
    const cur = services.get(id);
    if (!cur) return null;

    // Mark all stops as cancelled
    db.prepare(
      `
      UPDATE service_stops 
      SET state = 'Cancelled', updated_at = datetime('now')
      WHERE service_id = ?
    `,
    ).run(id);

    // Update service status
    db.prepare(
      `
      UPDATE services 
      SET status = 'Cancelled', cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(id);

    // Log event
    serviceEvents.log(id, null, "service_cancelled", { reason });

    return services.get(id);
  },

  complete: (id) => {
    const cur = services.get(id);
    if (!cur) return null;
    db.prepare(
      `
      UPDATE services 
      SET status = 'Completed', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(id);

    serviceEvents.log(id, null, "service_completed", {});
    return services.get(id);
  },

  remove: (id) => {
    db.prepare("DELETE FROM services WHERE id = ?").run(id);
  },
};

export const serviceStops = {
  listByService: (service_id) => {
    return db
      .prepare(
        `
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
    `,
      )
      .all(service_id);
  },

  get: (id) => {
    return db
      .prepare(
        `
      SELECT ss.*,
             st.name           AS station_name,
             st.short          AS station_short,
             s.number          AS service_number
      FROM service_stops ss
      JOIN stations st ON st.id = ss.station_id
      JOIN services s ON s.id = ss.service_id
      WHERE ss.id = ?
    `,
      )
      .get(id);
  },

  create: ({ service_id, station_id, stop_number, stop_type, arrival_scheduled, departure_scheduled, platform, sector, notes }) => {
    const info = db
      .prepare(
        `
      INSERT INTO service_stops 
      (service_id, station_id, stop_number, stop_type, arrival_scheduled, departure_scheduled, 
       arrival_expected, departure_expected, state, platform, sector, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, ?, ?)
    `,
      )
      .run(
        service_id,
        station_id,
        stop_number,
        stop_type,
        arrival_scheduled || null,
        departure_scheduled || null,
        arrival_scheduled || null,
        departure_scheduled || null,
        platform || null,
        sector || null,
        notes || null,
      );
    return serviceStops.get(info.lastInsertRowid);
  },

  update: (id, { platform, sector, notes, delay_locked }) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;
    db.prepare(
      `
      UPDATE service_stops 
      SET platform = ?, sector = ?, notes = ?, delay_locked = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(
      platform ?? cur.platform,
      sector ?? cur.sector,
      notes ?? cur.notes,
      delay_locked !== undefined ? delay_locked : cur.delay_locked,
      id,
    );
    return serviceStops.get(id);
  },

  reorder: (service_id, newOrder) => {
    // newOrder is an array of service_stop IDs in new order
    db.transaction(() => {
      newOrder.forEach((stop_id, index) => {
        db.prepare(
          `
          UPDATE service_stops 
          SET stop_number = ?, updated_at = datetime('now')
          WHERE id = ?
        `,
        ).run(index + 1, stop_id);
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
      db.prepare(
        `
        UPDATE service_stops 
        SET state = 'Arrived', arrival_actual = ?, delay_minutes = ?, 
            arrival_expected = ?, platform = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(actual_time, delayMinutes, actual_time, platform !== undefined ? platform : cur.platform, id);

      // Propagate delay to subsequent stops if not locked
      if (delayMinutes > 0) {
        const service_id = cur.service_id;
        db.prepare(
          `
          UPDATE service_stops 
          SET delay_minutes = delay_minutes + ?,
              arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
              departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
              updated_at = datetime('now')
          WHERE service_id = ? 
            AND stop_number > ?
            AND delay_locked = 0
        `,
        ).run(delayMinutes, delayMinutes, delayMinutes, service_id, cur.stop_number);
      }

      // Log event
      serviceEvents.log(cur.service_id, id, "stop_arrival", { actual_time, delay_minutes: delayMinutes });
    })();

    return serviceStops.get(id);
  },

  markDeparture: (id, actual_time) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    db.transaction(() => {
      // Update this stop
      db.prepare(
        `
        UPDATE service_stops 
        SET state = 'Departed', departure_actual = ?, updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(actual_time, id);

      // Check if this is the last stop
      const maxStop = db
        .prepare(
          `
        SELECT MAX(stop_number) as max_num 
        FROM service_stops 
        WHERE service_id = ?
      `,
        )
        .get(cur.service_id);

      if (cur.stop_number === maxStop.max_num) {
        // Mark service as completed
        services.complete(cur.service_id);
      } else {
        // Mark service as in progress
        db.prepare(
          `
          UPDATE services 
          SET status = 'In Progress', started_at = CASE WHEN started_at IS NULL THEN datetime('now') ELSE started_at END
          WHERE id = ?
        `,
        ).run(cur.service_id);
      }

      // Log event
      serviceEvents.log(cur.service_id, id, "stop_departure", { actual_time });
    })();

    return serviceStops.get(id);
  },

  markPass: (id, actual_time) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    db.prepare(
      `
      UPDATE service_stops 
      SET state = 'Passed', arrival_actual = ?, departure_actual = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(actual_time, actual_time, id);

    serviceEvents.log(cur.service_id, id, "stop_passed", { actual_time });
    return serviceStops.get(id);
  },

  addDelay: (id, minutes, reason) => {
    const cur = serviceStops.get(id);
    if (!cur) return null;

    db.transaction(() => {
      // Update this stop's delay
      const newDelay = cur.delay_minutes + minutes;
      db.prepare(
        `
        UPDATE service_stops 
        SET delay_minutes = ?,
            arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
            departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
            updated_at = datetime('now')
        WHERE id = ?
      `,
      ).run(newDelay, minutes, minutes, id);

      // Propagate to subsequent stops if not locked
      db.prepare(
        `
        UPDATE service_stops 
        SET delay_minutes = delay_minutes + ?,
            arrival_expected = datetime(arrival_expected, '+' || ? || ' minutes'),
            departure_expected = datetime(departure_expected, '+' || ? || ' minutes'),
            updated_at = datetime('now')
        WHERE service_id = ? 
          AND stop_number > ?
          AND delay_locked = 0
      `,
      ).run(minutes, minutes, minutes, cur.service_id, cur.stop_number);

      // Log event
      serviceEvents.log(cur.service_id, id, "delay_added", { minutes, reason, affected_stops: "see DB" });
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
        db.prepare(
          `
          UPDATE service_stops 
          SET stop_number = ? 
          WHERE id = ?
        `,
        ).run(idx + 1, stop.id);
      });
    })();
  },
};

export const serviceEvents = {
  log: (service_id, stop_id, event_type, details) => {
    db.prepare(
      `
      INSERT INTO service_events (service_id, stop_id, event_type, details)
      VALUES (?, ?, ?, ?)
    `,
    ).run(service_id, stop_id || null, event_type, JSON.stringify(details));
  },

  listByService: (service_id, limit = 100) => {
    return db
      .prepare(
        `
      SELECT * FROM service_events 
      WHERE service_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
      )
      .all(service_id, limit);
  },
};

// ---- ANNOUNCEMENT CONFIG ----

export const announcementConfig = {
  getStationConfig: (stationId) => {
    return db.prepare("SELECT * FROM station_announcement_config WHERE station_id = ?").get(stationId);
  },

  setStationConfig: (stationId, patch) => {
    const existing = announcementConfig.getStationConfig(stationId);
    if (existing) {
      const sets = [];
      const params = [];
      const allowed = ["languages", "sound_mode", "delay_after_sound_ms", "delay_between_languages_ms", "sound_volume", "speech_volume", "auto_announce_enabled", "tts_provider", "tts_voice_map", "tts_rate", "tts_pitch"];
      for (const field of allowed) {
        if (patch[field] !== undefined) {
          sets.push(`${field} = ?`);
          params.push(field === "languages" || field === "tts_voice_map" ? JSON.stringify(patch[field]) : patch[field]);
        }
      }
      if (sets.length > 0) {
        sets.push("updated_at = datetime('now')");
        params.push(stationId);
        db.prepare(`UPDATE station_announcement_config SET ${sets.join(", ")} WHERE station_id = ?`).run(...params);
      }
    } else {
      db.prepare(
        `INSERT INTO station_announcement_config (station_id, languages, sound_mode, delay_after_sound_ms, delay_between_languages_ms, sound_volume, speech_volume, auto_announce_enabled, tts_provider, tts_voice_map, tts_rate, tts_pitch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        stationId,
        JSON.stringify(patch.languages || ["ca", "es", "en"]),
        patch.sound_mode || "SINGLE",
        patch.delay_after_sound_ms ?? 600,
        patch.delay_between_languages_ms ?? 1000,
        patch.sound_volume ?? 1.0,
        patch.speech_volume ?? 1.0,
        patch.auto_announce_enabled ?? 1,
        patch.tts_provider || "browser",
        JSON.stringify(patch.tts_voice_map || {}),
        patch.tts_rate ?? 0.95,
        patch.tts_pitch ?? 1.0,
      );
    }
    return announcementConfig.getStationConfig(stationId);
  },
};

// ---- AUDIO ASSETS ----

export const audioAssets = {
  list: (filters = {}) => {
    let sql = "SELECT * FROM audio_assets WHERE 1=1";
    const params = [];
    if (filters.asset_type) { sql += " AND asset_type = ?"; params.push(filters.asset_type); }
    if (filters.format) { sql += " AND format = ?"; params.push(filters.format); }
    if (filters.enabled !== undefined) { sql += " AND enabled = ?"; params.push(filters.enabled ? 1 : 0); }
    sql += " ORDER BY name ASC";
    return db.prepare(sql).all(...params);
  },
  get: (id) => db.prepare("SELECT * FROM audio_assets WHERE id = ?").get(id),
  create: (data) => {
    const info = db.prepare(
      `INSERT INTO audio_assets (name, asset_type, format, file_path, original_filename, duration_ms, bitrate, sample_rate, channels, volume_db, default_volume, normalized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
    ).run(
      data.name, data.asset_type || "CUSTOM", data.format, data.file_path,
      data.original_filename || null, data.duration_ms || null, data.bitrate || null,
      data.sample_rate || null, data.channels || null, data.volume_db || null,
      data.default_volume ?? 1.0,
    );
    return audioAssets.get(info.lastInsertRowid);
  },
  update: (id, updates) => {
    const cur = audioAssets.get(id);
    if (!cur) return null;
    const allowed = ["name", "asset_type", "format", "file_path", "duration_ms", "bitrate", "sample_rate", "channels", "volume_db", "normalized", "default_volume", "waveform_data", "metadata_json", "enabled"];
    const sets = [];
    const params = [];
    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }
    if (sets.length === 0) return cur;
    sets.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE audio_assets SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return audioAssets.get(id);
  },
  remove: (id) => {
    const asset = audioAssets.get(id);
    if (!asset) return;
    if (asset.file_path) {
      const fullPath = path.resolve(path.dirname(path.resolve(fileURLToPath(import.meta.url), "../uploads")), path.basename(asset.file_path.replace("/uploads/", "")));
      try { fs.unlinkSync(fullPath); } catch {}
    }
    db.prepare("DELETE FROM audio_assets WHERE id = ?").run(id);
  },
  conversions: {
    list: (assetId) => db.prepare("SELECT * FROM audio_asset_conversions WHERE asset_id = ? ORDER BY format").all(assetId),
    add: (assetId, format, filePath) => db.prepare("INSERT INTO audio_asset_conversions (asset_id, format, file_path) VALUES (?, ?, ?)").run(assetId, format, filePath),
  },
};

// ---- ANNOUNCEMENT SOUND PROFILES ----

export const soundProfiles = {
  list: () => db.prepare("SELECT * FROM announcement_sound_profiles ORDER BY name").all(),
  get: (id) => db.prepare("SELECT * FROM announcement_sound_profiles WHERE id = ?").get(id),
  create: (data) => {
    const info = db.prepare(
      `INSERT INTO announcement_sound_profiles (name, station_id, company, operator_id, train_type_id, commercial_service, service_type, default_sound_id, delay_after_sound_ms, sound_volume, speech_volume, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      data.name, data.station_id || null, data.company || null, data.operator_id || null,
      data.train_type_id || null, data.commercial_service || null, data.service_type || null,
      data.default_sound_id || null, data.delay_after_sound_ms ?? 600,
      data.sound_volume ?? 1.0, data.speech_volume ?? 1.0,
    );
    return soundProfiles.get(info.lastInsertRowid);
  },
  update: (id, updates) => {
    const cur = soundProfiles.get(id);
    if (!cur) return null;
    const allowed = ["name", "station_id", "company", "operator_id", "train_type_id", "commercial_service", "service_type", "default_sound_id", "delay_after_sound_ms", "sound_volume", "speech_volume", "enabled"];
    const sets = [];
    const params = [];
    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }
    if (sets.length === 0) return cur;
    sets.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE announcement_sound_profiles SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return soundProfiles.get(id);
  },
  remove: (id) => db.prepare("DELETE FROM announcement_sound_profiles WHERE id = ?").run(id),
};

// ---- ANNOUNCEMENT SOUND RULES ----

export const soundRules = {
  list: () =>
    db.prepare(
      `SELECT r.*, a.name AS asset_name, a.file_path AS asset_path
       FROM announcement_sound_rules r
       LEFT JOIN audio_assets a ON a.id = r.sound_id
       ORDER BY r.priority ASC`
    ).all(),
  get: (id) => db.prepare("SELECT * FROM announcement_sound_rules WHERE id = ?").get(id),
  create: (data) => {
    const info = db.prepare(
      `INSERT INTO announcement_sound_rules (priority, match_config, sound_id, profile_id, event_type, sound_mode, language_sounds, delay_after_sound_ms, delay_between_languages_ms, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      data.priority ?? 0,
      JSON.stringify(data.match_config || {}),
      data.sound_id || null,
      data.profile_id || null,
      data.event_type || null,
      data.sound_mode || "SINGLE",
      data.language_sounds ? JSON.stringify(data.language_sounds) : null,
      data.delay_after_sound_ms ?? 600,
      data.delay_between_languages_ms ?? 1000,
    );
    return soundRules.get(info.lastInsertRowid);
  },
  update: (id, updates) => {
    const cur = soundRules.get(id);
    if (!cur) return null;
    const sets = [];
    const params = [];
    const allowed = ["priority", "sound_id", "profile_id", "event_type", "sound_mode", "delay_after_sound_ms", "delay_between_languages_ms", "enabled"];
    for (const field of allowed) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }
    if (updates.match_config !== undefined) {
      sets.push("match_config = ?");
      params.push(JSON.stringify(updates.match_config));
    }
    if (updates.language_sounds !== undefined) {
      sets.push("language_sounds = ?");
      params.push(updates.language_sounds ? JSON.stringify(updates.language_sounds) : null);
    }
    if (sets.length === 0) return cur;
    params.push(id);
    db.prepare(`UPDATE announcement_sound_rules SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    return soundRules.get(id);
  },
  remove: (id) => db.prepare("DELETE FROM announcement_sound_rules WHERE id = ?").run(id),
};

// ---- DEVICES ----

export const devices = {
  list: () => db.prepare("SELECT * FROM devices ORDER BY last_seen DESC").all(),
  get: (id) => db.prepare("SELECT * FROM devices WHERE id = ?").get(id),
  update: (id, data) => {
    const cur = devices.get(id);
    if (!cur) return null;
    const fields = [];
    const params = [];
    for (const key of ["name", "device_type", "display_id", "station_id", "firmware", "capabilities"]) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
    }
    if (fields.length === 0) return cur;
    params.push(id);
    db.prepare(`UPDATE devices SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return devices.get(id);
  },
  remove: (id) => { db.prepare("DELETE FROM devices WHERE id = ?").run(id); },
};

// ---- PLACE TTS PRONUNCIATIONS ----

// ---- DISPLAY SCREENS ----

function shortId() {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const displayScreens = {
  list: () =>
    db.prepare(`
      SELECT ds.*, s.name as station_name, s.short as station_short
      FROM display_screens ds
      LEFT JOIN stations s ON s.id = ds.station_id
      ORDER BY ds.created_at DESC
    `).all(),
  get: (id) => {
    let screen = db.prepare(`
      SELECT ds.*, s.name as station_name, s.short as station_short
      FROM display_screens ds
      LEFT JOIN stations s ON s.id = ds.station_id
      WHERE ds.id = ?
    `).get(id);
    if (!screen && /^\d+$/.test(id)) {
      screen = db.prepare(`
        SELECT ds.*, s.name as station_name, s.short as station_short
        FROM display_screens ds
        LEFT JOIN stations s ON s.id = ds.station_id
        WHERE ds.rowid = ?
      `).get(Number(id));
    }
    return screen;
  },
  create: (data) => {
    const id = shortId();
    const slug = data.slug || toSlug(data.name);
    db.prepare(`
      INSERT INTO display_screens (id, name, slug, station_id, display_type, platform, sector, orientation, language, secondary_languages, audio_enabled, theme, font_scale, refresh_mode, max_rows, show_operator, show_train_type, show_destination, show_platform, show_time, show_status, show_notes, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, slug, data.station_id || null, data.display_type || "DEPARTURES",
      data.platform || null, data.sector || null, data.orientation || "LANDSCAPE",
      data.language || "ca", JSON.stringify(data.secondary_languages || ["es", "en"]),
      data.audio_enabled ? 1 : 0, data.theme || "default", data.font_scale || 1.0,
      data.refresh_mode || "realtime", data.max_rows || 10,
      data.show_operator !== undefined ? (data.show_operator ? 1 : 0) : 1,
      data.show_train_type !== undefined ? (data.show_train_type ? 1 : 0) : 1,
      data.show_destination !== undefined ? (data.show_destination ? 1 : 0) : 1,
      data.show_platform !== undefined ? (data.show_platform ? 1 : 0) : 1,
      data.show_time !== undefined ? (data.show_time ? 1 : 0) : 1,
      data.show_status !== undefined ? (data.show_status ? 1 : 0) : 1,
      data.show_notes !== undefined ? (data.show_notes ? 1 : 0) : 1,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1,
    );
    return displayScreens.get(id);
  },
  update: (id, data) => {
    const cur = displayScreens.get(id);
    if (!cur) return null;
    const fields = [];
    const params = [];
    for (const key of ["name", "slug", "station_id", "display_type", "platform", "sector", "orientation", "language", "theme", "font_scale", "refresh_mode", "max_rows", "device_id"]) {
      if (data[key] !== undefined) { fields.push(`${key} = ?`); params.push(data[key]); }
    }
    if (data.secondary_languages !== undefined) { fields.push("secondary_languages = ?"); params.push(JSON.stringify(data.secondary_languages)); }
    for (const boolKey of ["audio_enabled", "show_operator", "show_train_type", "show_destination", "show_platform", "show_time", "show_status", "show_notes", "enabled"]) {
      if (data[boolKey] !== undefined) { fields.push(`${boolKey} = ?`); params.push(data[boolKey] ? 1 : 0); }
    }
    if (fields.length === 0) return cur;
    fields.push("updated_at = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE display_screens SET ${fields.join(", ")} WHERE id = ?`).run(...params);
    return displayScreens.get(id);
  },
  remove: (id) => {
    db.prepare("DELETE FROM display_screens WHERE id = ?").run(id);
  },
  getBoard: (id) => {
    const display = displayScreens.get(id);
    if (!display) return null;
    const stationId = display.station_id;
    if (!stationId) return { display, rows: [] };

    const rows = db.prepare(`
      SELECT t.id, t.number, t.destination, t.platform, t.sector, t.scheduled_time, t.expected_time, t.status, t.stops, t.observations,
        o.name as operator_name, o.logo_url as operator_logo,
        tc.code as type_code, tc.name as type_name, tc.color as type_color, tc.logo_url as type_logo, tc.destination_icon_url as type_destination_icon,
        s.name as station_name
      FROM trains t
      LEFT JOIN operators o ON o.id = t.operator_id
      LEFT JOIN train_types tc ON tc.id = t.train_type_id
      LEFT JOIN stations s ON s.id = t.station_id
      WHERE t.station_id = ?
      ORDER BY t.sort_order ASC, t.scheduled_time ASC
    `).all(stationId);

    return { display, rows };
  },
};

export const placeTtsPronunciations = {
  list: () => db.prepare("SELECT * FROM place_tts_pronunciations ORDER BY display_name, language").all(),
  get: (displayName, language) => db.prepare("SELECT * FROM place_tts_pronunciations WHERE display_name = ? AND language = ?").get(displayName, language),
  set: (displayName, language, pronunciation) => {
    db.prepare(
      "INSERT OR REPLACE INTO place_tts_pronunciations (display_name, language, pronunciation) VALUES (?, ?, ?)"
    ).run(displayName, language, pronunciation);
    return placeTtsPronunciations.get(displayName, language);
  },
  remove: (id) => db.prepare("DELETE FROM place_tts_pronunciations WHERE id = ?").run(id),
};
