CREATE TABLE IF NOT EXISTS announcement_sound_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  company TEXT,
  operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL,
  train_type_id INTEGER REFERENCES train_types(id) ON DELETE SET NULL,
  commercial_service TEXT,
  service_type TEXT,
  default_sound_id INTEGER REFERENCES audio_assets(id) ON DELETE SET NULL,
  delay_after_sound_ms INTEGER DEFAULT 600,
  sound_volume REAL DEFAULT 1.0,
  speech_volume REAL DEFAULT 1.0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcement_sound_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  priority INTEGER NOT NULL DEFAULT 0,
  match_config TEXT NOT NULL DEFAULT '{}',
  sound_id INTEGER REFERENCES audio_assets(id) ON DELETE SET NULL,
  profile_id INTEGER REFERENCES announcement_sound_profiles(id) ON DELETE SET NULL,
  event_type TEXT,
  sound_mode TEXT NOT NULL DEFAULT 'SINGLE'
    CHECK(sound_mode IN ('SINGLE','PER_LANGUAGE')),
  delay_after_sound_ms INTEGER DEFAULT 600,
  delay_between_languages_ms INTEGER DEFAULT 1000,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sound_rules_enabled ON announcement_sound_rules(enabled);
CREATE INDEX idx_sound_profiles_station ON announcement_sound_profiles(station_id);
