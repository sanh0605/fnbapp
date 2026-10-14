# Nhóm tuỳ chọn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Option groups become a table the owner edits on the page "Nhóm tuỳ chọn". Each group can be Chọn một (with a pre-picked default) or Chọn nhiều (with caps), is attached to chosen dishes, and appears on the till in making order.

**Architecture:**
- Two new tables: `modifier_groups`, and `modifier_group_products` linking groups to dishes.
- Three new columns on `modifiers`: `group_id`, `is_default`, `max_qty`.
- One pure module, `lib/sales/option-groups.ts`, decides which groups a dish shows and what a tap does. One shared picker, `components/ui/OptionGroupPicker.tsx`, draws it, used by the till, Sửa đơn's line editor and Sửa đơn's "add a dish".
- Every write that touches two tables goes through a Postgres function.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres (plpgsql), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md`. Read it first. The owner's answers there are final.

## Hiện trạng

1. **States.**
   - A group is the text `modifiers.group_name` (nullable, measured 2026-10-14). It has no state.
   - Options are `ACTIVE`/`INACTIVE`.
   - `modifiers.sort_order` exists but nothing reads it. It is noted for plan item 6d and not used here.
   - After this plan, a group is `ACTIVE`, set by "Dùng lại", or `INACTIVE`, set by "Ngừng dùng". An empty group can be erased (`ADMIN`).
2. **Buttons.**
   - Group page: Tạo nhóm, Sửa, Ngừng dùng / Dùng lại, and Xoá (`ADMIN` only, shown only when the group has no option).
   - Option form: the "Bán độc lập" switch shows when the option's group has `allow_standalone`, no longer when the name is "Thêm Topping".
   - Till: in Chọn một groups, one button per option. In Chọn nhiều groups, − and +, with "+" greyed at a cap.
3. **Lists.**
   - The till shows, for one dish, only the `ACTIVE` groups ticked for that dish that have at least one `ACTIVE` option, by `sort_order` then name.
   - The group list shows every group (both states), by `sort_order` then name.
   - The group page's dish tick list shows every dish not `DELETED`, under its dish group.
4. **Inputs.**

   | Field | Accepts | Out of range |
   |---|---|---|
   | Tên | not blank, unique ignoring case | "Nhập tên nhóm" / "Tên nhóm đã có" |
   | Thứ tự hiện | integer 1–99 | "Thứ tự hiện từ 1 đến 99" |
   | Tối đa mấy phần (Chọn nhiều) | blank or integer 1–20 | "Tối đa từ 1 đến 20 phần" |
   | Option "Tối đa mỗi món" (Chọn nhiều) | blank or integer 1–20 | same message |
   | Option "Có sẵn" | Chọn một groups only | not shown otherwise |
5. **Data served.**
   - Serves live option groups and dishes.
   - It deliberately does not rewrite sold lines: `order_lines_v2.modifiers_snapshot_json` stays as written.
   - It does not touch stock or cost, because options never did.

**Own questions for this job:**

6. **What does a sale store?** Only the picks away from the default, one entry per portion (spec "Data"). The default is never stored.
7. **What does the till do when a dish has no groups?** It shows no option section at all.
8. **What about Sửa đơn on a line whose option is no longer attached?** The pick is shown in a trailing "Đã chọn trước" list with a − button, and is kept unless removed.
9. **Does the server refuse anything new on order intake?** No. Rule 6 of the spec: `lib/sales/order-cart.ts` already prices options by id and checks neither attachment nor caps. **This plan does not touch it.**

**Looked at:**
- `app/pos/components/ItemConfigModal.tsx`, `POSScreen.tsx:271-279`, `app/pos/page.tsx`, `app/pos/actions.ts:52-78`;
- `lib/sales/order-cart.ts:300-310`, `app/admin/orders/[id]/edit/components/OrderEditForm.tsx:127-135`, `app/admin/orders/components/LineItemEditor.tsx`;
- `app/admin/products/modifiers/*`, `app/admin/products/types/*` (the template to copy), `app/admin/nav-items.ts`, `lib/db/tables.ts`, `lib/products/product-save-transaction.ts`, `lib/products/topping-price-sync.ts`;
- migrations 0098, 0100, 0105 (`save_product_atomic`) and 0109 (table conventions).

**Not looked at:**
- the service worker and offline bootstrap of the till: Task 5 must read `app/pos` for any cache of the props before relying on them;
- `ProductForm.tsx` internals: Task 4 reads them.

**Real-data example (measured 2026-10-14).**
- Line `ol-f6a37a8a-ee83-4973-91d3-965f06b244f6` on order `ord-9e4e4a2b-08e5-499a-ab97-02c1856a8985`: one Matcha latte with snapshot `[{"id":"MOD-004","name":"Trân châu trắng","price":5000,"qty":1}]`. Migration A leaves it byte for byte unchanged.
- After the deploy, ringing the same cup again stores the same snapshot. Thêm Topping is a Chọn nhiều group with no default and no caps, and Matcha latte is a drink, so it gets ticked.
- Khoai lang no longer shows Thêm Topping. 0 of the 322 lines ever sold with options were food, so no past habit breaks.

## Global Constraints

- Code and comments in English; visible text in Vietnamese.
- No popups on admin pages (`BR-DATA-007`); the till is exempt.
- Desktop and phone layouts both (`.claude/rules/ui-devices.md`); use `components/ui` parts only (the guard tests refuse hand-built inputs and tables).
- Ponytail is a project rule (CLAUDE.md, owner 2026-10-14): no wrapper, option or abstraction beyond this plan; no Lodash.
- Writes touching two tables go through one Postgres function.
- No migration runs on the server without the owner's separate yes. Migration B is not written in this plan.
- Every new test must fail first, and the report says whether it failed on a wrong value or a missing function.

## Review Focus

1. **Default stored by mistake.** A cashier taps Sữa tươi (the default) after Sữa yến mạch. The pick must be removed, not replaced by a 0đ "Sữa tươi" entry. Pinned in Task 2's `pickOne` test.
2. **A stopped default option.** If the owner stops "Bình thường", the group must open with nothing lit, not a stopped option lit. Pinned in Task 2's `optionGroupsForProduct` test.
3. **Mode switched from Chọn một to Chọn nhiều while an option is the default.** The flag must be cleared, or a hidden default lingers. Pinned in Task 1's migration text test and Task 3's action test.
4. **Ticking "Có sẵn" on a second option.** The first must lose it in the same save, otherwise the partial unique index throws. Pinned in Task 1's migration text test.
5. **Old till page.** Between the deploy and a reload, an old till may send an option the dish no longer shows. The order must still save. Already true; Task 3 adds the test to `lib/sales/order-cart.test.ts`.

---

### Task 1: Migration 0119 (Sonnet)

**Files:**
- Create: `supabase/migrations/0119_modifier_groups.sql`
- Test: `tests/migrations/0119-modifier-groups.test.ts`

**Interfaces:**
- **Produces tables:**
  - `modifier_groups(id text pk, name text, selection_mode text, max_total int null, allow_standalone bool, sort_order int, status text, created_at, updated_at)`.
  - `modifier_group_products(group_id, product_id, pk(group_id, product_id))`.
  - On `modifiers`: `group_id text null references modifier_groups RESTRICT`, `is_default bool not null default false`, `max_qty int null`.
- **Produces functions:**
  - `save_modifier_group_atomic(p_is_edit boolean, p_group jsonb, p_product_ids text[]) returns jsonb {group_id, product_count}`.
  - `save_modifier_atomic(p_is_edit boolean, p_modifier jsonb) returns jsonb {modifier_id, variant_id, price_history}`.
  - `save_product_atomic(boolean, jsonb, jsonb, jsonb, timestamptz, p_option_group_ids text[] default null)`, with the same return as today.

- [ ] **Step 1: Header comment.** List the triggers of every table touched, following `supabase/CLAUDE.md`. On 2026-10-14 Opus queried `modifiers` and found one: `trg_modifiers_touch`. Grep the migrations for triggers on `products` and `product_variants`, and say which source each fact comes from.

- [ ] **Step 2: Write the failing text test.** Copy the shape of an existing test in `tests/migrations/` that reads a migration file as text.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0119_modifier_groups.sql", "utf8");

describe("0119 modifier groups", () => {
  it("creates both tables with RESTRICT keys and the mode checks", () => {
    expect(sql).toMatch(/create table if not exists public\.modifier_groups/);
    expect(sql).toMatch(/selection_mode in \('ONE', 'MANY'\)/);
    expect(sql).toMatch(/selection_mode = 'MANY' or \(allow_standalone = false and max_total is null\)/);
    expect(sql).toMatch(/create table if not exists public\.modifier_group_products/);
    expect(sql.match(/on delete restrict/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("seeds Thêm Topping and ticks only drink dishes", () => {
    expect(sql).toMatch(/'Thêm Topping', 'MANY', null, true, 50/);
    expect(sql).toMatch(/is_drink/);
    expect(sql).toMatch(/status <> 'DELETED'/);
  });
  it("allows one default per group and clears defaults when a group is Chọn nhiều", () => {
    expect(sql).toMatch(/create unique index if not exists idx_modifiers_one_default[\s\S]*where is_default/);
    const fn = sql.slice(sql.indexOf("function public.save_modifier_group_atomic"));
    expect(fn).toMatch(/'MANY'[\s\S]{0,200}set is_default = false/);
  });
  it("clears the other default before setting a new one", () => {
    const fn = sql.slice(sql.indexOf("function public.save_modifier_atomic"));
    expect(fn.indexOf("set is_default = false")).toBeGreaterThan(-1);
    expect(fn.indexOf("set is_default = false")).toBeLessThan(fn.indexOf("insert into public.modifiers"));
  });
  it("reads the group, not the name, for standalone toppings", () => {
    const fn = sql.slice(sql.indexOf("function public.create_standalone_topping_product_atomic"));
    expect(fn).toMatch(/allow_standalone/);
    expect(fn).not.toMatch(/'Thêm Topping'/);
  });
  it("replaces save_product_atomic instead of adding a second version", () => {
    expect(sql).toMatch(/drop function if exists public\.save_product_atomic\(\s*boolean, jsonb, jsonb, jsonb, timestamptz\s*\)/);
    expect(sql).toMatch(/p_option_group_ids text\[\] default null/);
  });
  it("locks every new table and function to service_role", () => {
    for (const t of ["modifier_groups", "modifier_group_products"]) {
      expect(sql).toContain(`alter table public.${t} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${t} from public, anon, authenticated`);
    }
    for (const f of ["save_modifier_group_atomic", "save_modifier_atomic", "save_product_atomic"]) {
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`));
    }
  });
});
```

- [ ] **Step 3: Run it.** Run `npx vitest run tests/migrations/0119-modifier-groups.test.ts`. Expected: FAIL with ENOENT (the file is missing).

- [ ] **Step 4: Write the migration.** Copy the conventions of 0109: `create table if not exists`, the normalised unique name index, RLS on, revoke from public/anon/authenticated, grant to service_role. The core:

```sql
create table if not exists public.modifier_groups (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  selection_mode text not null check (selection_mode in ('ONE', 'MANY')),
  max_total integer check (max_total between 1 and 20),
  allow_standalone boolean not null default false,
  sort_order integer not null check (sort_order between 1 and 99),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (selection_mode = 'MANY' or (allow_standalone = false and max_total is null))
);
-- same normalised unique-name index expression as idx_product_types_name (0109)

create table if not exists public.modifier_group_products (
  group_id text not null references public.modifier_groups(id) on delete restrict,
  product_id text not null references public.products(id) on delete restrict,
  primary key (group_id, product_id)
);

alter table public.modifiers
  add column if not exists group_id text references public.modifier_groups(id) on delete restrict,
  add column if not exists is_default boolean not null default false,
  add column if not exists max_qty integer check (max_qty between 1 and 20);
create unique index if not exists idx_modifiers_one_default on public.modifiers (group_id) where is_default;

insert into public.modifier_groups (id, name, selection_mode, max_total, allow_standalone, sort_order)
values ('MG-001', 'Thêm Topping', 'MANY', null, true, 50)
on conflict (id) do nothing;
update public.modifiers set group_id = 'MG-001' where group_name = 'Thêm Topping' and group_id is null;
```

  Then add the following:
  - **Other names.** Any other distinct `group_name`, none on 2026-10-14, gets its own `MG-00n` group, `MANY`, sort 50. Write it as a loop, so the migration is correct even if one appears before it runs.
  - **The drink ticks:** `insert into modifier_group_products select 'MG-001', p.id from products p join product_categories c on c.id = p.category_id join product_types t on t.id = c.type_id where t.is_drink and p.status <> 'DELETED' on conflict do nothing`.
  - **`create_standalone_topping_product_atomic`.** Same signature and return; copy the 0100 body. Replace the `group_name <> 'Thêm Topping'` check with: `select coalesce(g.allow_standalone, false) … from modifiers m left join modifier_groups g on g.id = m.group_id`. Refuse when it is false, with the message `Modifier % is in a group that does not sell options on their own`.
  - **`save_modifier_group_atomic`.**
    - Insert or update the group from `p_group` (fields as the table).
    - If the mode is `MANY`, run `update modifiers set is_default = false where group_id = id`.
    - Delete the links whose product is not in `p_product_ids`, insert the missing ones `on conflict do nothing`.
    - Return `{group_id, product_count}`.
  - **`save_modifier_atomic`.**
    - On insert: `p_modifier` carries `id, name, price, group_id, is_default, max_qty`. Set `group_name` to the group's name, which keeps the old column filled until migration B. If `is_default`, first `update modifiers set is_default = false where group_id = … and id <> …`. Then insert with status `ACTIVE`.
    - On edit: update `group_id, is_default, max_qty` the same way, then `return public.sync_topping_price_atomic(id, price, name, <group name>)`. That reuses 0098's price sync unchanged.
  - **`save_product_atomic`.** Drop the 5-argument version, then recreate it with 0105's body unchanged plus, at the end, before the return: `if p_option_group_ids is not null then` delete this product's links not in the array, and insert the missing ones. The product id is the one the body already resolved.

- [ ] **Step 5: Run the test.** Expected: PASS.

- [ ] **Step 6: Re-check against the server, read-only.** Running from the repo root, compare the old `save_product_atomic` body with 0105 (`select prosrc from pg_proc where proname = 'save_product_atomic'`) and say whether it is identical. Opus will run the migration only after the owner's yes.

- [ ] **Step 7: Commit.** `git add supabase/migrations/0119_modifier_groups.sql tests/migrations/0119-modifier-groups.test.ts`. Message: "feat(db): option groups tables and functions (not run)".

### Task 2: Pure option logic (Sonnet)

**Files:**
- Create: `lib/sales/option-groups.ts`, `lib/sales/option-groups.test.ts`

**Interfaces:**
- **Produces types:**
  - `OptionGroup = { id: string; name: string; selection_mode: "ONE" | "MANY"; max_total: number | null; allow_standalone: boolean; sort_order: number; status: string }`
  - `OptionRow = { id: string; name: string; price: number | string; status: string; group_id: string | null; is_default: boolean; max_qty: number | null; product_id: string | null }`
  - `GroupLink = { group_id: string; product_id: string }`
  - `Pick = { id: string; name: string; price: number | string }`, one entry per portion
  - `ProductOptionGroup = { group: OptionGroup; options: OptionRow[]; defaultId: string | null }`
- **Produces functions:**
  - `optionGroupsForProduct(productId: string, groups: OptionGroup[], links: GroupLink[], options: OptionRow[]): ProductOptionGroup[]`
  - `litOptionId(picks: Pick[], g: ProductOptionGroup): string | null`, for Chọn một
  - `pickOne(picks: Pick[], g: ProductOptionGroup, option: OptionRow): Pick[]`
  - `canAddPortion(picks: Pick[], g: ProductOptionGroup, option: OptionRow): boolean`

- [ ] **Step 1: Write the failing tests.**

```ts
import { describe, expect, it } from "vitest";
import { canAddPortion, litOptionId, optionGroupsForProduct, pickOne, type OptionGroup, type OptionRow } from "./option-groups";

const g = (o: Partial<OptionGroup>): OptionGroup => ({ id: "MG-1", name: "X", selection_mode: "MANY", max_total: null, allow_standalone: false, sort_order: 50, status: "ACTIVE", ...o });
const opt = (o: Partial<OptionRow>): OptionRow => ({ id: "M", name: "M", price: 0, status: "ACTIVE", group_id: "MG-1", is_default: false, max_qty: null, product_id: null, ...o });

const sugar = g({ id: "MG-2", name: "Mức đường", selection_mode: "ONE", sort_order: 1 });
const topping = g({ id: "MG-1", name: "Thêm Topping", sort_order: 50, max_total: 3, allow_standalone: true });
const milk = g({ id: "MG-3", name: "Loại sữa", selection_mode: "ONE", sort_order: 3 });
const options = [
  opt({ id: "S1", name: "Ít đường", group_id: "MG-2" }),
  opt({ id: "S2", name: "Bình thường", group_id: "MG-2", is_default: true }),
  opt({ id: "T1", name: "Trân châu trắng", price: 5000, max_qty: 2 }),
  opt({ id: "T2", name: "Kem muối", price: 4000 }),
  opt({ id: "K1", name: "Sữa tươi", group_id: "MG-3", is_default: true }),
  opt({ id: "K2", name: "Sữa yến mạch", group_id: "MG-3", price: 8000 }),
];
const links = [
  { group_id: "MG-1", product_id: "TRA" }, { group_id: "MG-2", product_id: "TRA" }, { group_id: "MG-3", product_id: "TRA" },
  { group_id: "MG-1", product_id: "CAFE" },
];

describe("optionGroupsForProduct", () => {
  it("gives a dish only its ticked, active groups in making order", () => {
    const tra = optionGroupsForProduct("TRA", [topping, sugar, milk], links, options);
    expect(tra.map((x) => x.group.name)).toEqual(["Mức đường", "Loại sữa", "Thêm Topping"]);
    expect(optionGroupsForProduct("CAFE", [topping, sugar, milk], links, options).map((x) => x.group.name)).toEqual(["Thêm Topping"]);
    expect(optionGroupsForProduct("KHOAI", [topping, sugar, milk], links, options)).toEqual([]);
  });
  it("drops stopped groups, stopped options and groups left empty", () => {
    const stopped = optionGroupsForProduct("TRA", [topping, { ...sugar, status: "INACTIVE" }, milk], links,
      options.map((o) => (o.group_id === "MG-3" ? { ...o, status: "INACTIVE" } : o)));
    expect(stopped.map((x) => x.group.name)).toEqual(["Thêm Topping"]);
  });
  it("has no default when the default option is stopped", () => {
    const [s] = optionGroupsForProduct("TRA", [sugar], links, options.map((o) => (o.id === "S2" ? { ...o, status: "INACTIVE" } : o)));
    expect(s.defaultId).toBeNull();
  });
});

describe("Chọn một", () => {
  const [s, m] = optionGroupsForProduct("TRA", [sugar, milk], links, options);
  it("lights the default when nothing is picked", () => {
    expect(litOptionId([], s)).toBe("S2");
  });
  it("moves the pick and never stores the default", () => {
    const yen = pickOne([], m, options[5]);
    expect(yen.map((p) => p.id)).toEqual(["K2"]);
    expect(pickOne(yen, m, options[4])).toEqual([]);
  });
  it("clears the pick when the lit option is tapped again", () => {
    const it1 = pickOne([], s, options[0]);
    expect(pickOne(it1, s, options[0])).toEqual([]);
  });
  it("keeps picks of other groups", () => {
    const both = pickOne(pickOne([], s, options[0]), m, options[5]);
    expect(both.map((p) => p.id).sort()).toEqual(["K2", "S1"]);
  });
});

describe("Chọn nhiều caps", () => {
  const [t] = optionGroupsForProduct("CAFE", [topping], links, options);
  const tc = { id: "T1", name: "Trân châu trắng", price: 5000 };
  const km = { id: "T2", name: "Kem muối", price: 4000 };
  it("stops an option at its own cap", () => {
    expect(canAddPortion([tc], t, options[2])).toBe(true);
    expect(canAddPortion([tc, tc], t, options[2])).toBe(false);
  });
  it("stops the group at its total", () => {
    expect(canAddPortion([tc, tc, km], t, options[3])).toBe(false);
  });
  it("has no cap when both are blank", () => {
    const [free] = optionGroupsForProduct("CAFE", [{ ...topping, max_total: null }], links, options);
    expect(canAddPortion(Array(9).fill(km), free, options[3])).toBe(true);
  });
});
```

- [ ] **Step 2: Run them.** Run `npx vitest run lib/sales/option-groups.test.ts`. Expected: FAIL, the module is missing.

- [ ] **Step 3: Implement.**

```ts
export type OptionGroup = { id: string; name: string; selection_mode: "ONE" | "MANY"; max_total: number | null; allow_standalone: boolean; sort_order: number; status: string };
export type OptionRow = { id: string; name: string; price: number | string; status: string; group_id: string | null; is_default: boolean; max_qty: number | null; product_id: string | null };
export type GroupLink = { group_id: string; product_id: string };
export type Pick = { id: string; name: string; price: number | string };
export type ProductOptionGroup = { group: OptionGroup; options: OptionRow[]; defaultId: string | null };

export function optionGroupsForProduct(productId: string, groups: OptionGroup[], links: GroupLink[], options: OptionRow[]): ProductOptionGroup[] {
  const ticked = new Set(links.filter((l) => l.product_id === productId).map((l) => l.group_id));
  return groups
    .filter((g) => g.status === "ACTIVE" && ticked.has(g.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "vi"))
    .map((group) => {
      const own = options.filter((o) => o.group_id === group.id && o.status === "ACTIVE");
      const def = group.selection_mode === "ONE" ? own.find((o) => o.is_default) : undefined;
      return { group, options: own, defaultId: def?.id ?? null };
    })
    .filter((x) => x.options.length > 0);
}

const inGroup = (picks: Pick[], g: ProductOptionGroup) => picks.filter((p) => g.options.some((o) => o.id === p.id));

export function litOptionId(picks: Pick[], g: ProductOptionGroup): string | null {
  return inGroup(picks, g)[0]?.id ?? g.defaultId;
}

export function pickOne(picks: Pick[], g: ProductOptionGroup, option: OptionRow): Pick[] {
  const rest = picks.filter((p) => !g.options.some((o) => o.id === p.id));
  const wasPicked = picks.some((p) => p.id === option.id);
  if (wasPicked || option.id === g.defaultId) return rest;
  return [...rest, { id: option.id, name: option.name, price: option.price }];
}

export function canAddPortion(picks: Pick[], g: ProductOptionGroup, option: OptionRow): boolean {
  const own = picks.filter((p) => p.id === option.id).length;
  return own < (option.max_qty ?? Infinity) && inGroup(picks, g).length < (g.group.max_total ?? Infinity);
}
```

- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit.** `git add lib/sales/option-groups.ts lib/sales/option-groups.test.ts`. Message: "feat(sales): option group rules for one dish".

### Task 3: Server side, loaders and wrappers (Sonnet)

**Files:**
- Create:
  - `lib/products/modifier-group-transaction.ts` (+ test): `saveModifierGroupAtomic`;
  - `lib/products/modifier-save-transaction.ts` (+ test): `saveModifierAtomic`;
  - `app/admin/products/modifier-groups/actions.ts` (+ `actions.test.ts`).
- Modify:
  - `lib/products/product-save-transaction.ts` (+ test): `optionGroupIds?: string[]`, passed as `p_option_group_ids` (`null` when undefined);
  - `app/admin/products/actions.ts`: read `formData.getAll("option_group_ids")` and pass it;
  - `app/admin/products/modifiers/actions.ts` (+ test): create and edit through `saveModifierAtomic`; read `group_id`, `is_default`, `max_qty`; drop `group_name` from the form;
  - `lib/products/topping-price-sync.ts`: delete it and its test if no caller is left (grep first, and say so in the report);
  - `types/db.ts`: `DBModifier` gains `group_id: string | null; is_default: boolean; max_qty: number | null`; add `DBModifierGroup` and `DBModifierGroupProduct`;
  - `lib/db/tables.ts`: add `'Modifier_Groups'` and `'Modifier_Group_Products'` to `CATALOG_SHEETS`;
  - `app/pos/page.tsx` and `app/admin/orders/[id]/edit/page.tsx`: also load `Modifier_Groups` and `Modifier_Group_Products`, and pass them on as `optionGroups` and `optionGroupLinks`;
  - the product new and edit pages: load the groups and this product's links; pass `optionGroups` and `selectedOptionGroupIds`;
  - `lib/sales/order-cart.test.ts`: Review Focus 5.

**Interfaces:**
- **Consumes:** the Task 1 functions and the Task 2 types.
- **Produces the server actions in `app/admin/products/modifier-groups/actions.ts`:**
  - `getModifierGroups(): Promise<Array<{ group: DBModifierGroup; optionNames: string[]; productCount: number }>>`
  - `getModifierGroup(id): Promise<{ group; options: DBModifier[]; productIds: string[] } | null>`
  - `saveModifierGroup(formData)` and `updateModifierGroup(formData)`. Fields: `id`, `name`, `selection_mode`, `max_total`, `allow_standalone` (`"on"`), `sort_order`, and `product_ids` (`getAll`).
  - `setModifierGroupStatus(formData)`, with `id` and `status`.
  - `deleteModifierGroup(formData)`, `requireOwner`.
  - Each returns `ActionResponse`. Guard: `requireAdmin`, as on Topping & tuỳ chọn.

- [ ] **Step 1: Write the failing action tests.** Copy the mock style of `app/admin/products/types/actions.test.ts`. Each test calls the action and asserts either the `fail` message or the rpc arguments:
  - (a) A blank name gives "Nhập tên nhóm". A duplicate name ignoring case gives "Tên nhóm đã có".
  - (b) `sort_order` 0 or 100 gives "Thứ tự hiện từ 1 đến 99". `max_total` 21 gives "Tối đa từ 1 đến 20 phần".
  - (c) Turning `allow_standalone` off, or switching to `ONE`, while option MOD-004 "Trân châu trắng" has `product_id` gives "Nhóm có món bán riêng: Trân châu trắng. Tắt bán riêng ở từng món trước."
  - (d) Switching to `ONE` sends `allow_standalone: false` and `max_total: null`.
  - (e) Deleting a group with options gives "Nhóm còn tuỳ chọn: Trân châu trắng, Kem muối." and never calls `remove`. Use the same foreign-key fallback as `deleteProductType`.
  - (f) In `app/admin/products/modifiers/actions.test.ts`: saving an option sold on its own into a group whose `allow_standalone` is false is refused with "Món Trân châu trắng đang bán riêng; nhóm này không cho bán riêng."
  - (g) The same file: `is_default` on a Chọn nhiều group is refused with "Chỉ nhóm chọn một mới có lựa chọn có sẵn". `max_qty` on a Chọn một group is ignored, sent as null.
  - (h) Review Focus 5, in `order-cart.test.ts`: `buildOrderFromCart` with an option whose group is not ticked for the dish still prices it and stores it.

- [ ] **Step 2: Run them.** Expected: FAIL. The new modules are missing; (h) may already pass, so say so, since that test only pins existing behaviour.
- [ ] **Step 3: Implement.** Write the wrappers in the style of `product-save-transaction.ts`: call `rpc`, throw `"<fn>: message"` on error, and check the returned counts (`product_count` against `product_ids.length`). Write the actions in the style of `types/actions.ts`. After each write, call `revalidateTag(getCacheTag("Modifier_Groups"))`, `revalidateTag(getCacheTag("Modifier_Group_Products"))` and `revalidateTag(getCacheTag("Modifiers"))`, plus `revalidatePath`.
- [ ] **Step 4: Run the tests and tsc.** Run `npx vitest run app/admin/products lib/products lib/sales`, then `npx tsc --noEmit`. Expected: PASS. tsc may still show errors in screens Gemini owns (Tasks 4–5); list them, do not fix them.
- [ ] **Step 5: Commit.** "feat(products): option group actions, loaders and transaction wrappers".

### Task 4: Admin screens (Gemini)

**Files:**
- Create, under `app/admin/products/modifier-groups/`:
  - `page.tsx`, `loading.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`;
  - `components/ModifierGroupsClient.tsx`, `components/ModifierGroupForm.tsx`, `[id]/components/ModifierGroupDetailView.tsx`;
  - a test beside each component.
- Modify:
  - `app/admin/nav-items.ts`: `{ name: "Nhóm tuỳ chọn", href: "/admin/products/modifier-groups" }`, right after "Topping & tuỳ chọn";
  - `ModifierForm.tsx`: the "Nhóm" Select of groups, "Có sẵn" (Chọn một only), "Tối đa mỗi món" (Chọn nhiều only). The "Bán độc lập" switch shows when the chosen group has `allow_standalone`;
  - `StandaloneToppingSwitch.tsx`: drop `STANDALONE_ELIGIBLE_GROUP`; take `allowStandalone: boolean`;
  - `ModifiersClient.tsx` and `ModifierDetailView.tsx`: show the group's name by id;
  - `app/admin/products/components/ProductForm.tsx`: a "Nhóm tuỳ chọn" tick list sending `option_group_ids`.

**Interfaces:** These consume Task 3's actions and props exactly as named there. The form posts the field names listed in Task 3.

- [ ] **Step 1: Tests first.** Copy the style of `app/admin/products/types/components/*.test.tsx`:
  - the list sorts by Thứ tự hiện;
  - the form hides "Tối đa mấy phần" and "Cho bán riêng" when Chọn một is chosen;
  - "Chọn cả nhóm" ticks every dish of one dish group;
  - Xoá shows only for `ADMIN` and only when the group has no option;
  - on ModifierForm, "Có sẵn" shows only for a Chọn một group;
  - the `it.todo` in `ModifierForm.test.tsx` becomes a passing test: the group box lists the groups from the page's data, not four fixed names.
- [ ] **Step 2: Build the screens.** Each needs a desktop and a phone layout and must not use popups.
- [ ] **Step 3: Report.** List the files changed and the tests added, and say which tests fail on the old code and why. **Opus runs the tests.**

### Task 5: Till and Sửa đơn picker (Gemini)

**Files:**
- Create: `components/ui/OptionGroupPicker.tsx`, `components/ui/OptionGroupPicker.test.tsx`
- Modify:
  - `app/pos/components/POSScreen.tsx`: remove `groupedModifiers`. Take `optionGroups` and `optionGroupLinks` props, and pass `optionGroupsForProduct(product.id, …)` to the dialog;
  - `app/pos/components/ItemConfigModal.tsx`: replace the "MODIFIERS" section with `<OptionGroupPicker>`;
  - `app/admin/orders/components/LineItemEditor.tsx` and `app/admin/orders/[id]/edit/components/OrderEditForm.tsx`: the same, keyed on each line's product.

**Interfaces:**
- **Consumes, from Task 2:** `ProductOptionGroup`, `Pick`, `litOptionId`, `pickOne`, `canAddPortion`.
- **Produces:** `OptionGroupPicker({ groups, picks, onChange }: { groups: ProductOptionGroup[]; picks: Pick[]; onChange: (picks: Pick[]) => void })`.
  - Each group gets an uppercase heading.
  - A Chọn một group shows one button per option, lit by `litOptionId`, with the price suffix "+8.000" when the price is above 0. A tap calls `pickOne`.
  - A Chọn nhiều group shows −, a count and +; "+" is disabled when `canAddPortion` is false.
  - Picks matching no option in `groups` go in a trailing list "Đã chọn trước", each with −.

- [ ] **Step 1: Tests first** in `OptionGroupPicker.test.tsx`:
  - Bình thường is lit with no picks;
  - tapping Sữa yến mạch calls `onChange` with `[K2]`;
  - "+" on Trân châu trắng is disabled at x2;
  - an orphan pick "Kem muối" shows under "Đã chọn trước" and its − removes it.
- [ ] **Step 2: Build it.** It must work at phone width; the till dialog is already a bottom sheet there.
- [ ] **Step 3: Report.** Same report as Task 4. **Opus runs the tests.**

### Task 6: Docs, gates, review, server (Opus)

- [ ] **Step 1: Docs.**
  - New rule `BR-CATALOG-005` in `docs/02-rules/business-rules/catalog.md`: the model, with the owner's words and dates.
  - `docs/03-workflows/product-catalog.md`: the flow declaration lists the new files, and a "Behaviour change — date" line.
  - `docs/01-system/TABLE-DICTIONARY.md`: the two tables.
  - Regenerate OPEN-ITEMS.
- [ ] **Step 2: Run the five gates, with the build in a throwaway worktree.** Run `npx vite-node scripts/verify-cogs.ts` too: no figure should move.
- [ ] **Step 3: Review.** A fresh reviewer agent checks the branch against the spec and this plan, including excess code (ponytail rule).
- [ ] **Step 4: Ask the owner to run migration 0119**, on its own and before any push. After it runs, measure, with denominators:
  - options without a group: 0 of 8;
  - links per dish group;
  - drinks without Thêm Topping: 0.
- [ ] **Step 5: Push.** Push needs the owner's separate yes. After the deploy is checked, write migration B (spec "Rollout" step 3) as its own plan row.
