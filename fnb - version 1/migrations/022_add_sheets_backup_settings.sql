-- Insert settings key for Google Sheets backup timestamp
INSERT INTO settings (key, value, updated_at)
VALUES ('sheets_last_backup', NULL, now())
ON CONFLICT (key) DO NOTHING;
