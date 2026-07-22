-- Migration 008: Add pre_announce_ogg to operators, train_types and stations (legacy DBs)

ALTER TABLE operators ADD COLUMN pre_announce_ogg TEXT;
ALTER TABLE train_types ADD COLUMN pre_announce_ogg TEXT;
ALTER TABLE stations ADD COLUMN pre_announce_ogg TEXT;
