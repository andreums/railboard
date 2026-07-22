CREATE TABLE IF NOT EXISTS place_tts_pronunciations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER REFERENCES places(id) ON DELETE CASCADE,
  station_id INTEGER REFERENCES stations(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  language TEXT NOT NULL,
  pronunciation TEXT NOT NULL,
  CHECK (place_id IS NOT NULL OR station_id IS NOT NULL),
  UNIQUE(display_name, language)
);

CREATE INDEX IF NOT EXISTS idx_place_tts_lookup ON place_tts_pronunciations(display_name);
