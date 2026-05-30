-- Migration 001: Create services and service_stops tables for multistation support
-- Date: 2026-05-30
-- Description: Adds support for services with multiple stops across stations

BEGIN TRANSACTION;

-- Services table: represents a single train/service that travels across multiple stations
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  operator_id INTEGER,
  train_type_id INTEGER,
  origin_place_id INTEGER,
  destination_place_id INTEGER,
  status TEXT NOT NULL DEFAULT 'Scheduled',
  -- Valid statuses: 'Scheduled', 'In Progress', 'Completed', 'Cancelled'
  
  notes TEXT,
  started_at TEXT,           -- ISO 8601 when service reaches first station
  completed_at TEXT,         -- ISO 8601 when service reaches final destination
  cancelled_at TEXT,         -- ISO 8601 if cancelled
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL,
  FOREIGN KEY (train_type_id) REFERENCES train_types(id) ON DELETE SET NULL,
  FOREIGN KEY (origin_place_id) REFERENCES places(id) ON DELETE SET NULL,
  FOREIGN KEY (destination_place_id) REFERENCES places(id) ON DELETE SET NULL
);

-- Service stops table: represents a single stop of a service at a station
CREATE TABLE IF NOT EXISTS service_stops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  station_id INTEGER NOT NULL,
  stop_number INTEGER NOT NULL,  -- 1, 2, 3, ... order in the route
  
  stop_type TEXT NOT NULL,       -- 'Origin', 'Stop', 'Pass', 'Destination'
  
  -- Scheduled times (plan)
  arrival_scheduled TEXT,        -- ISO 8601, NULL if origin
  departure_scheduled TEXT,      -- ISO 8601, NULL if destination or pass
  
  -- Expected times (adjusted for delays)
  arrival_expected TEXT,         -- ISO 8601, updated with delays
  departure_expected TEXT,       -- ISO 8601, updated with delays
  
  -- Actual times (real)
  arrival_actual TEXT,           -- ISO 8601, recorded when marking arrival
  departure_actual TEXT,         -- ISO 8601, recorded when marking departure/pass
  
  -- Operational state
  state TEXT NOT NULL DEFAULT 'Scheduled',
  -- Valid states: 'Scheduled', 'Arrived', 'Departed', 'Passed', 'Cancelled', 'Skipped'
  
  platform TEXT,                 -- Track/Platform at this station
  sector TEXT,                   -- Sector of the station (A, B, C, D...)
  
  -- Delay management
  delay_minutes INTEGER DEFAULT 0,     -- Accumulated delay at this stop
  delay_locked INTEGER DEFAULT 0,      -- 1 = does not inherit delays from previous stops
  
  -- Observations
  notes TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE RESTRICT,
  
  UNIQUE(service_id, station_id, stop_number)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_operator ON services(operator_id);
CREATE INDEX IF NOT EXISTS idx_service_stops_service ON service_stops(service_id);
CREATE INDEX IF NOT EXISTS idx_service_stops_station ON service_stops(station_id);
CREATE INDEX IF NOT EXISTS idx_service_stops_state ON service_stops(state);
CREATE INDEX IF NOT EXISTS idx_service_stops_station_state ON service_stops(station_id, state);

COMMIT;
