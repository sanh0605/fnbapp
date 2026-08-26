-- docs/superpowers/plans/2026-08-26-outlet-done-properly.md sections 2, 3.
-- NOT APPLIED as part of this commit -- owner approval required separately
-- (CLAUDE.md section 2), same as every migration.

-- 2: operating hours belong to the outlet, not a brand or a slot table
-- (docs/superpowers/specs/2026-07-28-multi-outlet-design.md's
-- Outlet_Brand_Slot is not needed while one outlet sells exactly one
-- brand, and must not be built speculatively for a case that does not
-- exist yet). Nullable on both, never seeded with a guessed value --
-- CLAUDE.md section 7's rule for flexible things: the owner fills these
-- in on the screen, the field exists so he can.
alter table public.outlets
  add column if not exists open_time time,
  add column if not exists close_time time;

-- 3: pos_drafts belongs to the till it was started at, not the brand that
-- happened to be stamped at that moment. Re-verified immediately before
-- writing this migration (live query, not the plan's own claim taken on
-- faith): pos_drafts holds 0 rows in production, so this is schema-only --
-- no backfill, no migration risk. brand_id is kept, unchanged: it is the
-- sale-time fact, same as on an order.
alter table public.pos_drafts
  add column if not exists outlet_id text references public.outlets(id);
