ALTER TABLE announcement_history ADD COLUMN queue_id INTEGER REFERENCES announcement_queue(id) ON DELETE SET NULL;
ALTER TABLE announcement_history ADD COLUMN priority TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE announcement_history ADD COLUMN composed_data TEXT;

-- Backfill composed_data from individual text columns for existing rows
UPDATE announcement_history SET composed_data = json_object(
  'ca', COALESCE(text_ca, ''),
  'es', COALESCE(text_es, ''),
  'en', COALESCE(text_en, ''),
  'eu', COALESCE(text_eu, ''),
  'gl', COALESCE(text_gl, ''),
  'va', COALESCE(text_va, '')
) WHERE composed_data IS NULL AND (text_ca IS NOT NULL OR text_es IS NOT NULL OR text_en IS NOT NULL);
