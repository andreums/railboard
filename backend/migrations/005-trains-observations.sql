-- Migration 005: Add observations to trains (legacy DBs)

ALTER TABLE trains ADD COLUMN observations TEXT DEFAULT '';
