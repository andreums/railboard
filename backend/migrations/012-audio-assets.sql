CREATE TABLE IF NOT EXISTS audio_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'CUSTOM'
    CHECK(asset_type IN ('CHIME','GONG','ATTENTION_TONE','JINGLE','PRERECORDED_ANNOUNCEMENT','VOICE_FRAGMENT','CUSTOM')),
  format TEXT NOT NULL DEFAULT 'MP3'
    CHECK(format IN ('MP3','OGG','WAV')),
  file_path TEXT NOT NULL,
  original_filename TEXT,
  duration_ms INTEGER,
  bitrate INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  volume_db REAL,
  normalized INTEGER NOT NULL DEFAULT 0,
  default_volume REAL DEFAULT 1.0,
  waveform_data TEXT,
  metadata_json TEXT DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audio_asset_conversions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id INTEGER NOT NULL REFERENCES audio_assets(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK(format IN ('MP3','OGG','WAV')),
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
