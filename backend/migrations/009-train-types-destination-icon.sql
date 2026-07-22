-- Migration 009: Add destination_icon_url to train_types (legacy DBs)

ALTER TABLE train_types ADD COLUMN destination_icon_url TEXT;
