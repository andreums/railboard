-- Migration 003: Add compatibility layer between trains and service_stops
-- Date: 2026-05-30
-- Description: Allows simple trains to be optionally linked to service_stops

BEGIN TRANSACTION;

-- Add optional service_stop reference to trains table
ALTER TABLE trains ADD COLUMN service_stop_id INTEGER DEFAULT NULL;

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_trains_service_stop ON trains(service_stop_id);

COMMIT;
