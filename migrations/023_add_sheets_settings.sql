-- Add Google Sheets backup settings to admin panel
INSERT INTO settings (key, value, updated_at) VALUES
  ('sheets_sheet_id', '1RF-B2DLjLxuJ9VWtqJhiQLb5qlcUFVoehl7RxOP6xNc', now()),
  ('sheets_service_email', 'supabse-backup@beverages-496303.iam.gserviceaccount.com', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
