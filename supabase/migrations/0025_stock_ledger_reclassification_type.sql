-- Adds a new transaction_type value used only for the 2026-07-20 historical
-- reclassification of BTP-shortfall orders (see
-- docs/superpowers/plans/2026-07-20-implicit-production-shortfall-design.md).
-- Those orders had raw ingredients debited directly as SALES_CONSUME instead
-- of an implicit production step; the correction reverses the original
-- mis-classified row (audit-trail preserved, never overwritten) and inserts
-- the correct PRODUCTION_CONSUME/PRODUCTION_YIELD/SALES_CONSUME rows.
-- RECLASSIFICATION_REVERSAL is a distinct type (not reused from
-- EDIT_REVERSAL) because no order edit actually happened here -- reusing
-- EDIT_REVERSAL would misleadingly imply one did.

alter table public.stock_ledger
  drop constraint if exists stock_ledger_transaction_type_check;

alter table public.stock_ledger
  add constraint stock_ledger_transaction_type_check
  check (transaction_type in (
    'SALES_CONSUME','EDIT_REVERSAL','EDIT_CONSUME','PO_RECEIPT',
    'PRODUCTION_CONSUME','PRODUCTION_YIELD','STOCK_ADJUST',
    'ADJUSTMENT_IN','ADJUSTMENT_OUT','RECLASSIFICATION_REVERSAL'
  ));
