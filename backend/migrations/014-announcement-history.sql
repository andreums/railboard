CREATE TABLE IF NOT EXISTS announcement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  train_id INTEGER REFERENCES trains(id) ON DELETE SET NULL,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  languages TEXT NOT NULL DEFAULT '[]',
  text_ca TEXT,
  text_es TEXT,
  text_en TEXT,
  text_eu TEXT,
  text_gl TEXT,
  text_va TEXT,
  chime_asset_id INTEGER REFERENCES audio_assets(id) ON DELETE SET NULL,
  sound_rule_id INTEGER REFERENCES announcement_sound_rules(id) ON DELETE SET NULL,
  audio_file_path TEXT,
  queue_status TEXT NOT NULL DEFAULT 'COMPLETED'
    CHECK(queue_status IN ('PENDING','GENERATING_AUDIO','READY','PLAYING_SOUND','PLAYING_ANNOUNCEMENT','COMPLETED','CANCELLED','FAILED')),
  duration_ms INTEGER,
  played_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS announcement_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  train_id INTEGER REFERENCES trains(id) ON DELETE SET NULL,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER NOT NULL DEFAULT 1,
  dedup_key TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK(priority IN ('LOW','NORMAL','HIGH','EMERGENCY')),
  languages TEXT NOT NULL DEFAULT '[]',
  composed_data TEXT NOT NULL DEFAULT '{}',
  chime_asset_id INTEGER REFERENCES audio_assets(id) ON DELETE SET NULL,
  audio_file_path TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK(status IN ('PENDING','GENERATING_AUDIO','READY','PLAYING_SOUND','PLAYING_ANNOUNCEMENT','COMPLETED','CANCELLED','FAILED')),
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_announcement_dedup ON announcement_queue(dedup_key)
  WHERE status NOT IN ('COMPLETED','CANCELLED','FAILED');

CREATE INDEX idx_queue_status ON announcement_queue(status);
CREATE INDEX idx_queue_priority ON announcement_queue(priority);
CREATE INDEX idx_history_station ON announcement_history(station_id);
CREATE INDEX idx_history_created ON announcement_history(created_at DESC);
