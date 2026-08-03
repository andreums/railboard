-- Añadir el tipo de display BUS (monitor intermodal bus/ferri) al CHECK de display_type
-- SQLite no permite ALTER TABLE de una CHECK constraint; se recrea la tabla.
BEGIN;

CREATE TABLE IF NOT EXISTS display_screens_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE,
  station_id    INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  display_type  TEXT NOT NULL DEFAULT 'DEPARTURES'
    CHECK(display_type IN ('DEPARTURES','ARRIVALS','PLATFORM','TRAIN_INFO','CLOCK','DISRUPTIONS','CUSTOM','BUS')),
  platform      TEXT,
  sector        TEXT,
  orientation   TEXT DEFAULT 'LANDSCAPE'
    CHECK(orientation IN ('LANDSCAPE','PORTRAIT')),
  language      TEXT DEFAULT 'ca',
  secondary_languages TEXT DEFAULT '["es","en"]',
  audio_enabled INTEGER DEFAULT 0,
  theme         TEXT DEFAULT 'default',
  font_scale    REAL DEFAULT 1.0,
  refresh_mode  TEXT DEFAULT 'realtime'
    CHECK(refresh_mode IN ('realtime','polling','manual')),
  device_id     TEXT,
  max_rows      INTEGER DEFAULT 10,
  show_operator  INTEGER DEFAULT 1,
  show_train_type INTEGER DEFAULT 1,
  show_destination INTEGER DEFAULT 1,
  show_platform   INTEGER DEFAULT 1,
  show_time       INTEGER DEFAULT 1,
  show_status     INTEGER DEFAULT 1,
  show_notes      INTEGER DEFAULT 1,
  enabled       INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

INSERT INTO display_screens_new (id, name, slug, station_id, display_type, platform, sector, orientation, language, secondary_languages, audio_enabled, theme, font_scale, refresh_mode, device_id, max_rows, show_operator, show_train_type, show_destination, show_platform, show_time, show_status, show_notes, enabled, created_at, updated_at)
SELECT id, name, slug, station_id, display_type, platform, sector, orientation, language, secondary_languages, audio_enabled, theme, font_scale, refresh_mode, device_id, max_rows, show_operator, show_train_type, show_destination, show_platform, show_time, show_status, show_notes, enabled, created_at, updated_at
FROM display_screens;

DROP TABLE display_screens;
ALTER TABLE display_screens_new RENAME TO display_screens;

CREATE INDEX IF NOT EXISTS idx_display_screens_station ON display_screens(station_id);
CREATE INDEX IF NOT EXISTS idx_display_screens_type ON display_screens(display_type);

COMMIT;