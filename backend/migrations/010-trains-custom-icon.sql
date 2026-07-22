-- Migration 010: Add custom_icon_url and icon_mode to trains (legacy DBs)

ALTER TABLE trains ADD COLUMN custom_icon_url TEXT;
ALTER TABLE trains ADD COLUMN icon_mode TEXT DEFAULT 'destination';
