ALTER TABLE trains ADD COLUMN state_source TEXT DEFAULT 'manual';
ALTER TABLE trains ADD COLUMN state_updated_at TEXT;

CREATE TABLE IF NOT EXISTS train_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  train_id      INTEGER REFERENCES trains(id) ON DELETE SET NULL,
  service_id    INTEGER REFERENCES services(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL,
  from_state    TEXT,
  to_state      TEXT,
  source        TEXT DEFAULT 'manual',
  station_id    INTEGER,
  details       TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_train_events_train ON train_events(train_id);
CREATE INDEX IF NOT EXISTS idx_train_events_type ON train_events(event_type);
CREATE INDEX IF NOT EXISTS idx_train_events_created ON train_events(created_at DESC);
