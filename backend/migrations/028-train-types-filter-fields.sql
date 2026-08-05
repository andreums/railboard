-- Migration 028: Add filter/attribute fields to train_types
-- is_cercanias: boolean flag for commuter (cercanías) services
-- category: predefined category (AV, MD, Cercanías, Regional, ...)
-- attribute: free-text attribute for filtering

ALTER TABLE train_types ADD COLUMN is_cercanias INTEGER NOT NULL DEFAULT 0;
ALTER TABLE train_types ADD COLUMN category TEXT;
ALTER TABLE train_types ADD COLUMN attribute TEXT;

-- Backfill is_cercanias for existing commuter lines (code C-*, or name containing Cercanías/Rodalies/Rodalia)
UPDATE train_types SET is_cercanias = 1, category = 'Cercanías'
WHERE code LIKE 'C-%' OR name LIKE '%Cercanía%' OR name LIKE '%Cercanias%' OR name LIKE '%Rodalies%' OR name LIKE '%Rodalia%';

