ALTER TABLE stations ADD COLUMN announcement_languages TEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS station_announcement_config (
  station_id INTEGER PRIMARY KEY REFERENCES stations(id) ON DELETE CASCADE,
  languages TEXT NOT NULL DEFAULT '["ca","es","en"]',
  sound_mode TEXT NOT NULL DEFAULT 'SINGLE'
    CHECK(sound_mode IN ('SINGLE','PER_LANGUAGE')),
  delay_after_sound_ms INTEGER DEFAULT 600,
  delay_between_languages_ms INTEGER DEFAULT 1000,
  sound_volume REAL DEFAULT 1.0,
  speech_volume REAL DEFAULT 1.0,
  auto_announce_enabled INTEGER NOT NULL DEFAULT 1,
  tts_provider TEXT DEFAULT 'browser',
  tts_voice_map TEXT DEFAULT '{}',
  tts_rate REAL DEFAULT 0.95,
  tts_pitch REAL DEFAULT 1.0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE operators ADD COLUMN announcement_config TEXT DEFAULT '{}';
ALTER TABLE train_types ADD COLUMN announcement_config TEXT DEFAULT '{}';

CREATE TABLE IF NOT EXISTS announcement_event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  source_type TEXT,
  source_id INTEGER,
  details TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_event_log_type ON announcement_event_log(event_type);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON announcement_event_log(created_at DESC);
