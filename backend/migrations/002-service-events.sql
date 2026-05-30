-- Migration 002: Create service_events table for audit trail
-- Date: 2026-05-30
-- Description: Tracks all changes to services for audit and debugging

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS service_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  stop_id INTEGER,
  event_type TEXT NOT NULL,
  -- Valid event types:
  -- 'service_created', 'service_updated', 'service_cancelled', 'service_completed',
  -- 'stop_arrival', 'stop_departure', 'stop_passed',
  -- 'delay_added', 'delay_propagated'
  
  details TEXT,  -- JSON with event details
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (stop_id) REFERENCES service_stops(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_service_events_service ON service_events(service_id);
CREATE INDEX IF NOT EXISTS idx_service_events_type ON service_events(event_type);
CREATE INDEX IF NOT EXISTS idx_service_events_created ON service_events(created_at);

COMMIT;
