-- Migration 006: Add logo_url to places (legacy DBs)

ALTER TABLE places ADD COLUMN logo_url TEXT;
