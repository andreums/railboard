-- Migration 000: Base schema (config, catalogs, trains, display configs)
-- Description: Creates the tables that existed before the migrations system was introduced.
-- Safe to run against a database that already has these tables (CREATE TABLE IF NOT EXISTS).

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operators (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL UNIQUE,
  logo_url         TEXT,
  pre_announce_ogg TEXT
);

CREATE TABLE IF NOT EXISTS train_types (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  code             TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  color            TEXT NOT NULL DEFAULT '#7c1d2e',
  logo_url         TEXT,
  pre_announce_ogg TEXT,
  destination_icon_url TEXT,
  announce_template TEXT
);

CREATE TABLE IF NOT EXISTS places (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL UNIQUE,
  logo_url TEXT
);

CREATE TABLE IF NOT EXISTS stations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  short            TEXT NOT NULL DEFAULT '',
  logo_url         TEXT,
  pre_announce_ogg TEXT,
  color            TEXT NOT NULL DEFAULT '#1A3254',
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS station_display_configs (
  station_id   INTEGER PRIMARY KEY REFERENCES stations(id) ON DELETE CASCADE,
  config_json  TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trains (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  number          TEXT NOT NULL,
  operator_id     INTEGER REFERENCES operators(id)   ON DELETE SET NULL,
  train_type_id   INTEGER REFERENCES train_types(id) ON DELETE SET NULL,
  origin          TEXT NOT NULL,
  destination     TEXT NOT NULL,
  stops           TEXT NOT NULL DEFAULT '[]',
  scheduled_time  TEXT NOT NULL,
  expected_time   TEXT NOT NULL,
  platform        TEXT NOT NULL DEFAULT '-',
  sector          TEXT NOT NULL DEFAULT '-',
  status          TEXT NOT NULL DEFAULT 'Scheduled',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  observations    TEXT DEFAULT '',
  station_id      INTEGER REFERENCES stations(id) ON DELETE SET NULL,
  custom_icon_url TEXT,
  icon_mode       TEXT DEFAULT 'destination',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS train_icons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  icon_url   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

COMMIT;
