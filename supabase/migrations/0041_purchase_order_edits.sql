-- Edit trail for purchase orders. Sales orders already have order_events;
-- purchase orders had none, which becomes a gap once completed POs are
-- editable by an admin (see the clean rebuild program, Phase 2).
create table if not exists public.purchase_order_edits (
  id text primary key,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  edited_by_id text not null,
  edited_by_name text not null,
  edited_at timestamptz not null default now(),
  previous_status text not null,
  previous_subtotal_amount bigint not null,
  previous_line_count integer not null,
  new_subtotal_amount bigint not null,
  new_line_count integer not null
);
create index if not exists idx_purchase_order_edits_po
  on public.purchase_order_edits(purchase_order_id, edited_at desc);
