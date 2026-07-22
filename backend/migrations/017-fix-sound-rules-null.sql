-- Fix NOT NULL constraint on sound_id in announcement_sound_rules
-- SQLite requires table recreation to change constraints

CREATE TABLE IF NOT EXISTS announcement_sound_rules_new (
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

INSERT OR IGNORE INTO announcement_sound_rules_new 
  SELECT * FROM announcement_sound_rules;

DROP TABLE IF EXISTS announcement_sound_rules;

ALTER TABLE announcement_sound_rules_new RENAME TO announcement_sound_rules;

CREATE INDEX IF NOT EXISTS idx_sound_rules_enabled ON announcement_sound_rules(enabled);
