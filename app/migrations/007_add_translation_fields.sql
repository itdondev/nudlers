-- Translation Fields Migration
-- Adds support for multi-language transaction names

-- Add translation fields to transactions table
DO $$
BEGIN
  -- Add name_en (English translation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'transactions' AND column_name = 'name_en') THEN
    ALTER TABLE transactions ADD COLUMN name_en VARCHAR(100);
    CREATE INDEX IF NOT EXISTS idx_transactions_name_en ON transactions(name_en);
  END IF;

  -- Add name_ru (Russian translation)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'transactions' AND column_name = 'name_ru') THEN
    ALTER TABLE transactions ADD COLUMN name_ru VARCHAR(100);
    CREATE INDEX IF NOT EXISTS idx_transactions_name_ru ON transactions(name_ru);
  END IF;

  -- Add name_original (preserve Hebrew original)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'transactions' AND column_name = 'name_original') THEN
    ALTER TABLE transactions ADD COLUMN name_original VARCHAR(100);
    -- Copy existing names to name_original for backward compatibility
    UPDATE transactions SET name_original = name WHERE name_original IS NULL;
  END IF;
END $$;

-- Add language preference setting
INSERT INTO app_settings (key, value, description)
VALUES ('display_language', '"he"', 'Display language for transaction names: he (Hebrew), en (English), ru (Russian)')
ON CONFLICT (key) DO NOTHING;

-- Add translation status tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'transactions' AND column_name = 'translation_status') THEN
    ALTER TABLE transactions ADD COLUMN translation_status VARCHAR(20) DEFAULT 'pending';
    -- pending, translated, error
    CREATE INDEX IF NOT EXISTS idx_transactions_translation_status ON transactions(translation_status);
  END IF;
END $$;

-- Comments for documentation
COMMENT ON COLUMN transactions.name_en IS 'English translation of transaction name';
COMMENT ON COLUMN transactions.name_ru IS 'Russian translation of transaction name';
COMMENT ON COLUMN transactions.name_original IS 'Original Hebrew transaction name from bank';
COMMENT ON COLUMN transactions.translation_status IS 'Translation status: pending, translated, error';
