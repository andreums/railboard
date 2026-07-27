CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  device_type   TEXT NOT NULL
    CHECK(device_type IN ('DISPLAY','OPERATOR','AUDIO_NODE','HARDWARE','UNKNOWN')),
  display_id    TEXT,
  station_id    INTEGER,
  ip_address    TEXT,
  last_seen     TEXT,
  status        TEXT DEFAULT 'OFFLINE'
    CHECK(status IN ('ONLINE','OFFLINE','UNKNOWN')),
  firmware      TEXT,
  capabilities  TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(device_type);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
CREATE INDEX IF NOT EXISTS idx_devices_display ON devices(display_id);
