ALTER TABLE trains ADD COLUMN stopping_pattern TEXT DEFAULT NULL;
ALTER TABLE trains ADD COLUMN fare_restrictions TEXT DEFAULT NULL;
ALTER TABLE trains ADD COLUMN except_stations TEXT DEFAULT '[]';
