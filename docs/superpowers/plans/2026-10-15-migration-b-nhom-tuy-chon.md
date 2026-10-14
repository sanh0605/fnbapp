# Nhóm tuỳ chọn — migration B (drop the old group name)

Spec: `docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md`, "Rollout" step 3. The deploy it waits
for went live 2026-10-15 (`feebd7ee`) and the owner checked the live site the same day ("Đã kiểm tra và
ổn"). This plan is the short design plus the tasks; delete it when the master plan row is done.

## Hiện trạng

1. States: not applicable, because no new state is added. An option keeps ACTIVE / DELETED.
2. Buttons: not applicable, because no button changes. The option form already picks the group from the
   table.
3. Lists: "Topping & tuỳ chọn" shows the group by `group_id`; its fallback to the old name goes, since
   every option will have a group.
4. Inputs: not applicable, because no input changes. The server already refuses an option without a group
   (`save_modifier_atomic`).
5. Data: serves the 9 live options (8 ACTIVE, 1 DELETED), all in `MG-001` Thêm Topping. It deliberately
   does not serve backups taken before 0119 for options whose group name is not in the bundle; their rows
   are reported as skipped, never dropped silently, and stay in the backup file.

Extra questions for this job:

6. Who still reads `modifiers.group_name`? Measured 2026-10-15:
   - on the server, only `save_modifier_atomic` (writes it on insert) and
     `sync_topping_price_atomic(text, bigint, text, text)` (requires it and writes it). The live
     `create_standalone_topping_product_atomic` no longer reads it; 0119 replaced it;
   - in code, only the fallback in `app/admin/products/modifiers/components/ModifiersClient.tsx:82` and
     the type in `types/db.ts:136`, plus test fixtures;
   - no view, no Apps Script and no edge function names it. The backup copies whole rows, so it needs no
     change.
7. Can the till stop? No. No function's return type changes, the till never calls these two functions,
   and the live code (`feebd7ee`) sends `p_modifier` as jsonb, where an unused key is ignored. So the
   migration may run before or after this code is pushed.
8. What breaks that is not a caller? Restoring a backup. `lib/db/backup-restore.ts` inserts rows as saved:
   - a bundle taken before migration B carries `group_name`, which PostgREST refuses once the column is
     gone, so all 9 option rows would be skipped;
   - a bundle taken before 0119 also lacks `group_id`, which becomes not null.

   The restore therefore gets a shim like `backfillPurchaseOrderPayment`.

Measured on the server 2026-10-15 (read-only):
- 9 options, 0 without `group_id`;
- 0 whose `group_name` differs from their group's name;
- one name in use, "Thêm Topping".

Real example, before and after. "Kem muối", option `MOD-002`, price 4.000đ, group `MG-001`, linked to the
standalone dish `PROD-030` (ACTIVE, size price 4.000đ):
- before: the row holds `group_id = MG-001` and `group_name = 'Thêm Topping'`;
- after: it holds `group_id = MG-001` only;
- editing its price to 4.500đ on "Sửa tuỳ chọn" still sets `MOD-002.price` and `PROD-030`'s size price to
  4.500đ in one write, through the 3-argument `sync_topping_price_atomic`.

No order line is touched; sold lines keep their `modifiers_snapshot_json`.

## Design

Migration `0120_modifier_group_required.sql`, in one transaction:
1. Backfill, as the spec asks: `update modifiers m set group_id = g.id from modifier_groups g where
   m.group_id is null and g.name = m.group_name`. Then, if any row still has a null `group_id`, `raise
   exception` naming the ids, so nothing changes.
2. `alter table modifiers alter column group_id set not null`.
3. `drop function sync_topping_price_atomic(text, bigint, text, text)`, then create
   `sync_topping_price_atomic(p_modifier_id text, p_price bigint, p_name text)` with 0098's body, minus the
   group argument, its check and its assignment. Same return (jsonb), same grants as 0098, as amended by
   0117. Read both before writing.
4. `create or replace save_modifier_atomic` with 0119's body, minus `v_group_name` and the `group_name`
   column on insert, calling the 3-argument sync. Same signature, same return, same grants.
5. `alter table modifiers drop column group_name`.

Code:
- `types/db.ts`: drop `group_name` from `DBModifier`.
- `ModifiersClient.tsx`: `getGroupName` returns the group's name or "—", with no `group_name` fallback.
- `lib/db/backup-restore.ts`: a `backfillModifierGroup(table, row, bundle)` beside
  `backfillPurchaseOrderPayment`, for `modifiers` rows only:
  - when `group_id` is missing, set it from the bundle's `modifier_groups` row with the same name as
    `group_name`;
  - always drop the `group_name` key;
  - a row with no match keeps no `group_id`, so the insert fails and is recorded in `skipped` with its
    error, as today.
- Tests and fixtures that set `group_name` on an option drop it.
- Docs, in the same commit:
  - `docs/01-system/TABLE-DICTIONARY.md` modifiers row;
  - the spec's Rollout step 3 marked written;
  - `docs/03-workflows/product-catalog.md` behaviour line;
  - BR-CATALOG-005 if it names `group_name`.

## Tasks (Sonnet)

1. **Migration text test first.** In `tests/migrations/`, following the existing 0119 test's style,
   assert that 0120:
   - raises when a null `group_id` remains;
   - sets not null;
   - drops the 4-argument sync and creates the 3-argument one;
   - `save_modifier_atomic` no longer names `group_name`;
   - drops the column.

   Run it and see it red because the file is missing. Write the migration and see it green.
2. **Restore shim test first.** In the existing backup-restore test file, add:
   - (a) a pre-0119 row (`group_name` only), with the bundle holding `modifier_groups` `MG-001` Thêm
     Topping, inserts with `group_id: 'MG-001'` and no `group_name` key;
   - (b) a pre-B row with both keys inserts without `group_name`;
   - (c) a row whose name matches no group goes to `skipped`.

   See them red (missing behaviour), write the shim, green.
3. **Type and list.** Drop the type field and the fallback; fix the fixtures tsc and vitest then flag.
4. The five gates. Do not run the migration on the server, and do not push.

Ponytail is a project rule: no helper beyond the one shim, no option, no Lodash. Do not touch
`create_standalone_topping_product_atomic`. If a step is blocked, stop and report; do not route around it
with another tool.

## Rollout (each step needs the owner's own yes)

1. Run 0120 on the server. Measure after:
   - `modifiers.group_id` is not null;
   - no `group_name` column;
   - 9 of 9 options in a group;
   - `sync_topping_price_atomic` has one version, with 3 arguments.
2. Push the code. Either order is safe (question 7). The restore shim matters only for a restore after
   step 1, and the restore runs from this repository.

Seen: `supabase/migrations/0098`, `0100`, `0119`, `lib/db/backup-restore.ts`, `ModifiersClient.tsx`, the
server's functions and columns. Not seen: the 0117 grant lines for these two functions (Sonnet reads them
in step 3 of the design); the existing backup-restore test file's layout.
