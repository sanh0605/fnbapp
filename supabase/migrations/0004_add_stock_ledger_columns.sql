-- Migration to add missing columns in stock_ledger table
--
-- Claude code — Supabase migration fix.
--
-- Rebuild WS-2/WS-3 added these columns to Stock_Ledger in Google Sheets
-- but the Supabase migrations (0001_init_schema.sql) missed them.
--
-- cost_at_sale: stored MAC cost for faster COGS reporting
-- order_event_id: linked event id for SALES_CONSUME/EDIT_REVERSAL records

ALTER TABLE public.stock_ledger
  ADD COLUMN IF NOT EXISTS order_event_id text DEFAULT '';

ALTER TABLE public.stock_ledger
  ADD COLUMN IF NOT EXISTS cost_at_sale numeric(18,6) NOT null DEFAULT 0;

-- Create index on order_event_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_stock_ledger_order_event ON public.stock_ledger(order_event_id);
