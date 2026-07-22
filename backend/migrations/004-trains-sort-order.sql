-- Migration 004: Add sort_order to trains (legacy DBs created before it was in the base schema)
-- Note: only applies to databases created before migration 000; on those the column is already
-- present via CREATE TABLE and this migration is skipped (duplicate column, treated as applied).

ALTER TABLE trains ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE trains SET sort_order = id;
