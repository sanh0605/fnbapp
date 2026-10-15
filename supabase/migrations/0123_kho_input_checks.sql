-- supabase/migrations/0123_kho_input_checks.sql
-- Kho dot 2, S1: the database itself refuses the bad input the actions already
-- refuse. NOT YET RUN on the server; the owner approves running it separately.
-- The application code does not depend on it: without it the actions still refuse
-- the same input; with it a path that skips the actions is refused too.
--
-- Violations measured on the server 2026-10-15 just before writing (rows / bad):
--   purchase_orders, any money column < 0 ............ 203 / 0
--   purchase_order_lines.quantity < 0 ................. 359 / 0  (<= 0: also 0)
--   assets.status not ACTIVE/INACTIVE ................. 84 / 0
--   asset_disposals.quantity <= 0 ..................... 2 / 0
--   disposals past their asset's quantity ............. 0; disposals on an INACTIVE asset: 0
--   asset_depreciation_bands term_months <= 0 ......... 3 / 0
--   asset_depreciation_bands max_unit_price <= min .... 3 / 0 (a NULL max is the open top band)
--
-- Writer inventory (skill fnbapp-bulk-data-change, section 6). Triggers on these (queried from
-- the server 2026-10-15): only the BEFORE UPDATE touch triggers, they set updated_at only.
--
-- purchase_orders money columns (subtotal_amount, shipping_fee, tax_amount,
-- voucher_amount, discount_amount, total_amount; all bigint):
--   save_purchase_order_atomic, live in 0116 (also defined in 0006, 0078, 0107,
--     0108, 0112): inserts and updates them from the payload; savePurchaseOrder
--     now refuses a negative value, a non-integer and a negative total before calling it.
--   cancel_purchase_order_atomic, 0108: sets status/cancelled_* only, no money column.
--   No other app, lib or script code writes this table.
-- purchase_order_lines.quantity (numeric): the CHECK is >= 0, not > 0, because a draft
--   line with an empty quantity box is stored with quantity 0 on purpose (BR-UI-009,
--   write plan); a COMPLETED order refuses 0 in the action.
--   save_purchase_order_atomic 0116: coalesce(row.quantity, 0), so never negative
--     unless the payload is; the action refuses a negative one.
--   No other writer.
-- assets.status:
--   save_purchase_order_atomic 0116 (the 0112 body is dead): insert leaves status to
--     its default 'ACTIVE', retire sets 'INACTIVE'.
--   cancel_purchase_order_atomic 0108: sets 'INACTIVE'.
--   app/admin/inventory/items/actions.ts:339 and scripts/retire-misfiled-assets.ts: 'INACTIVE'.
-- asset_disposals.quantity: the only writer is disposeAsset (app/admin/inventory/assets/
--   actions.ts), a direct insert, not an rpc. The action now requires a whole number > 0.
--   So the over-quantity and INACTIVE refusals are a BEFORE INSERT trigger below: it takes
--   the asset's row lock, so two disposals at once queue and the second sees the first.
-- asset_depreciation_bands.term_months, max_unit_price:
--   replace_asset_depreciation_bands, 0118 (only live writer; 0069/0070 are one-off seed
--     and fix-up statements already applied): refuses term_months < 1 itself, and sets
--     every max_unit_price = the next band's min (strictly greater) or NULL for the top band.
--   app/admin/inventory/asset-bands/actions.ts calls only that function.

alter table public.purchase_orders
  add constraint purchase_orders_money_not_negative check (
    subtotal_amount >= 0 and shipping_fee >= 0 and tax_amount >= 0
    and voucher_amount >= 0 and discount_amount >= 0 and total_amount >= 0
  );

alter table public.purchase_order_lines
  add constraint purchase_order_lines_quantity_not_negative check (quantity >= 0);

alter table public.assets
  add constraint assets_status_valid check (status in ('ACTIVE', 'INACTIVE'));

alter table public.asset_disposals
  add constraint asset_disposals_quantity_positive check (quantity > 0);

alter table public.asset_depreciation_bands
  add constraint asset_depreciation_bands_term_positive check (term_months > 0),
  add constraint asset_depreciation_bands_max_above_min check (max_unit_price is null or max_unit_price > min_unit_price);

create or replace function public.asset_disposals_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_status text;
  v_quantity integer;
  v_disposed integer;
begin
  select status, quantity into v_status, v_quantity
  from public.assets where id = new.asset_id for update;
  if not found then
    raise exception 'Không tìm thấy tài sản';
  end if;
  if v_status = 'INACTIVE' then
    raise exception 'Tài sản đã ngừng dùng, không thanh lý được';
  end if;
  select coalesce(sum(quantity), 0) into v_disposed
  from public.asset_disposals where asset_id = new.asset_id;
  if v_disposed + new.quantity > v_quantity then
    raise exception 'Số lượng thanh lý (%) vượt quá số lượng còn lại (%)', new.quantity, v_quantity - v_disposed;
  end if;
  return new;
end;
$$;

create trigger asset_disposals_guard before insert on public.asset_disposals
  for each row execute function public.asset_disposals_guard();

revoke all on function public.asset_disposals_guard() from public;
revoke all on function public.asset_disposals_guard() from anon;
revoke all on function public.asset_disposals_guard() from authenticated;
