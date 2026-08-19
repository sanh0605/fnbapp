-- Batch 1, item A, section A3b (owner decision 2026-08-19, revising
-- section 9.2). Level 2 of the duplicate-name guard warns rather than
-- refuses when two names match only after diacritics are stripped (e.g.
-- "Ca phe" against "Cà phê") -- stripping is not safe to refuse on
-- outright, since it also collapses "Dứa" and "Dừa" (pineapple vs
-- coconut), and this catalogue already holds "Thạch dừa" (NNL-009).
--
-- "The confirmation is recorded as a field, not a note" -- same reasoning
-- as "Không nhớ" in the parent plan section 9.3: a later question like
-- "which items were created despite a warning" has to be answerable by a
-- query, not by reading rows by hand.
--
-- Scoped to base_ingredients for now -- the two required proof cases
-- (section A5) are both base_ingredients examples ("Thạch dứa" against
-- NNL-009, "Da vien" against "Đá viên"). The level-2 comparison logic
-- itself (findDiacriticStrippedMatch, lib/duplicate-name-guard.ts) is
-- table-agnostic and ready for the other six tables when they need it;
-- only this table's confirmation field exists today.

alter table public.base_ingredients
  add column if not exists duplicate_warning_confirmed boolean not null default false,
  add column if not exists duplicate_warning_confirmed_by text,
  add column if not exists duplicate_warning_confirmed_at timestamptz;
