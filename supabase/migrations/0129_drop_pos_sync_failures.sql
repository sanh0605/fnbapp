-- Drops pos_sync_failures (created in 0040) and with it cart_payload_json: the
-- till no longer sells offline (BR-SALE-015), so nothing writes or reads it.
-- Measured 2026-10-15: 0 rows ever. Only 0040 mentions the table; no view or function reads it.
-- Run only AFTER the push of the code without the table, approved separately.
drop table if exists public.pos_sync_failures;
