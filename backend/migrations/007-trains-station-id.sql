-- Migration 007: Add station_id to trains (legacy DBs, pre-multistation)

ALTER TABLE trains ADD COLUMN station_id INTEGER REFERENCES stations(id) ON DELETE SET NULL;
