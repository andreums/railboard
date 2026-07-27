-- Automation Rules Engine
CREATE TABLE IF NOT EXISTS automation_rules (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_type    TEXT NOT NULL CHECK(trigger_type IN ('time_based','state_change','delay_detected','schedule_match','periodic')),
  conditions      TEXT NOT NULL DEFAULT '{}',
  actions         TEXT NOT NULL DEFAULT '[]',
  priority        INTEGER NOT NULL DEFAULT 100,
  enabled         INTEGER NOT NULL DEFAULT 1,
  station_id      INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  train_type_id   INTEGER REFERENCES train_types(id) ON DELETE SET NULL,
  operator_id     INTEGER REFERENCES operators(id) ON DELETE SET NULL,
  interval_seconds INTEGER DEFAULT 30,
  cooldown_seconds INTEGER DEFAULT 60,
  last_evaluated  TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auto_rules_enabled ON automation_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_auto_rules_trigger ON automation_rules(trigger_type);

-- Track how long trains stay in each state
CREATE TABLE IF NOT EXISTS train_state_timings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  train_id        INTEGER NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  state           TEXT NOT NULL,
  entered_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expected_duration_seconds INTEGER,
  exceeded        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tst_train ON train_state_timings(train_id);
CREATE INDEX IF NOT EXISTS idx_tst_active ON train_state_timings(train_id, state) WHERE exceeded = 0;
