-- docs/superpowers/plans/2026-09-11-bao-cao-lai-lo.md Mục 2, BR-CASH-006
-- (docs/02-rules/business-rules/cash-book.md). Owner decision 2026-09-11:
-- hand-recorded sales revenue counts as revenue on the P&L, on its own
-- line (BR-PNL-003). Which categories hold it is a fact about the category,
-- carried as data, the same way affects_pnl is.
--
-- Trigger check on public.cash_categories (per supabase/CLAUDE.md), from
-- migration 0101: only trg_cash_categories_touch (touch_updated_at), which
-- fires on row UPDATE. This migration only runs ALTER TABLE (add column,
-- add constraint) and writes no row, so it never fires.
--
-- Additive only. Every existing row gets false and no row is set true
-- here: the owner ticks "Doanh thu ghi tay" (CFC-006) himself after
-- release, so this file writes no business data.
--
-- Must reach production BEFORE the code that writes this column: the
-- category save path sends is_sales_revenue on every add and update. Code
-- already running before this migration never reads or writes the column,
-- and its inserts take the default, which satisfies the check below.

alter table public.cash_categories
  add column if not exists is_sales_revenue boolean not null default false;

alter table public.cash_categories
  drop constraint if exists cash_categories_sales_revenue_is_pnl_income;

alter table public.cash_categories
  add constraint cash_categories_sales_revenue_is_pnl_income
  check (not is_sales_revenue or (kind = 'INCOME' and affects_pnl));
