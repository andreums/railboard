-- Simulation Clock (singleton row, id=1)
CREATE TABLE IF NOT EXISTS simulation_clock (
  id            INTEGER PRIMARY KEY CHECK(id = 1),
  base_real     TEXT NOT NULL,
  base_sim      TEXT NOT NULL,
  multiplier    REAL DEFAULT 1.0,
  paused        INTEGER DEFAULT 0,
  updated_at    TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO simulation_clock (id, base_real, base_sim, multiplier, paused)
VALUES (1, datetime('now'), datetime('now'), 1.0, 1);

-- Simulation Events Log
CREATE TABLE IF NOT EXISTS simulation_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT NOT NULL,
  train_id      INTEGER,
  service_id    INTEGER,
  station_id    INTEGER,
  display_id    TEXT,
  source        TEXT DEFAULT 'manual',
  details       TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sim_events_type ON simulation_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sim_events_created ON simulation_events(created_at DESC);

-- Journey Sequences
CREATE TABLE IF NOT EXISTS journey_sequences (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  train_id      INTEGER REFERENCES trains(id) ON DELETE SET NULL,
  service_id    INTEGER REFERENCES services(id) ON DELETE SET NULL,
  station_id    INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  enabled       INTEGER DEFAULT 1,
  current_step  INTEGER DEFAULT 0,
  loop          INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journey_sequence_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sequence_id   INTEGER REFERENCES journey_sequences(id) ON DELETE CASCADE,
  step_order    INTEGER NOT NULL,
  event_type    TEXT NOT NULL,
  delay_seconds INTEGER DEFAULT 0,
  relative_to   TEXT DEFAULT 'previous',
  auto_proceed  INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_jss_sequence ON journey_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_jss_order ON journey_sequence_steps(sequence_id, step_order);

ALTER TABLE trains ADD COLUMN journey_id INTEGER;
ALTER TABLE trains ADD COLUMN simulation_sequence_id INTEGER;
