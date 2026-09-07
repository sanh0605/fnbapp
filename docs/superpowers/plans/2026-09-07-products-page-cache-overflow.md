# Products page: the cached read that outgrew Next's 2 MB cache

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` for Task 1 and `superpowers:executing-plans` for the plan as a whole. Task 1 and Task 2 are independent; do them in order anyway, one commit each. Do not push, do not deploy.

**Goal:** stop `app/admin/products/page.tsx` from pulling every `order_lines_v2`
row into a Next data cache entry it cannot fit, without changing which products
offer "Xoá vĩnh viễn". Then give the app the icon its own manifest asks for.

**Found:** 2026-09-07, in the owner's `npm run dev` log, after the repo
restructure. The restructure did not cause it — the only change that commit
`51aad79` made to this file was the import path, `@/lib/sheets_db` →
`@/lib/db/tables`. This is a pre-existing defect that grew past a threshold.

## Current state (five numbered questions)

Measured 2026-09-07 against production with a read-only probe (`findAllNoCache`,
`CLI_MODE=true`), plus the owner's dev-server log.

1. **States.** The page has no states of its own. Per product it decides one
   thing: does "Xoá vĩnh viễn" appear? Set today by asking whether any
   `order_lines_v2` row names that product, or names one of its variants.
   That decision must not change.
2. **Buttons.** No button gains, loses, or changes behaviour. "Xoá vĩnh viễn"
   must appear on exactly the same 13 products before and after.
3. **Lists.** The page loads five tables. Four are small. The fifth,
   `Order_Lines_V2`, is 3.606 rows / 2.624.738 bytes raw and is the only one
   that must shrink. Not touched: which products are listed, the `DELETED`
   filter on categories and variants, the client component.
4. **Inputs.** Not applicable — no input field changes.
5. **Data.** Read-only. No migration, no write, no cache tag renamed. The
   `sheets-Order_Lines_V2` tag and every `revalidateTag` call stay as they are.

Seen: `app/admin/products/page.tsx`, `lib/db/tables.ts` (`findAll`,
`findAllNoCache`, `findAllWhere`), `app/manifest.ts`, `public/`, every caller of
`findAll("Order_Lines_V2")` (there is exactly one). Not seen: `ProductsClient.tsx`
body, the `order_lines_v2` table definition in `supabase/migrations/`.

## What is actually wrong

`findAll` wraps every read in `unstable_cache`. Next refuses to store a cache
entry over 2 MB. The entry for `Order_Lines_V2` is 3.016.077 bytes as Next
measures it, so **every** render throws:

```
Failed to set Next.js data cache, items over 2MB can not be cached (3016077 bytes)
```

Three consequences, in order of how much they matter:

1. **It surfaces as `unhandledRejection`, not a caught warning.** The page still
   renders, but an unhandled rejection at request time is not a safe steady
   state on a serverless runtime.
2. **The cache never populates.** Every visit re-reads all 3.606 rows from
   Supabase. The owner's log shows `POST /admin/products 200 in 2255ms`.
3. **It only gets worse.** The payload grows with every sale. There is no
   plateau.

The page does not need the rows. It needs two sets of ids: which products were
sold, and which variants were sold. Measured: **34 distinct `product_id` and 37
distinct `variant_id`** out of 3.606 rows. It is loading twenty columns per row
to compute that.

## Worked example, real numbers

Order line `ol-004ca7d2-fa55-40f2-aa12-39a46b418b4e` (order
`ord-d8c7ff1b-2510-427f-9b29-c0a36eb24db9`) carries `product_id` `PROD-001`,
`variant_id` `VAR-001`. That single row is what makes **Cà phê đá (`PROD-001`)**
sold, so it offers "Ngừng bán" and not "Xoá vĩnh viễn".

The shop has a second product also called **Cà phê đá**, `PROD-010`, which no
order line names. It is one of the 13 never-sold products that do offer "Xoá
vĩnh viễn" — alongside **Cà phê kem dẻo CT1** (`PROD-007`) and **Cà phê kem dẻo
CT2** (`PROD-008`). Two products share a display name and get opposite buttons;
the decision is by id, and must stay by id.

After the fix both products must land the same way: 47 products, 34 sold, 13
offering permanent deletion. Same names, same ids, same buttons.

Payload, measured on the same data:

| | rows | bytes | vs the 2 MB ceiling |
|---|---:|---:|---|
| today, all 20 columns | 3.606 | 2.624.738 | over (Next measures 3.016.077) |
| two id columns only | 3.606 | 111.787 | 5,3% of the ceiling |

**23× smaller.** At today's rate that is room for roughly twenty times the
current sales history before the ceiling is in sight again.

---

## Task 1: read only the two columns the page uses

**Files:**
- Modify: `lib/db/tables.ts` (one new exported function)
- Modify: `app/admin/products/page.tsx` (one call site)
- Create: a test file beside whichever module you put the helper in

- [ ] **Step 1: Write the failing test first**

The test must be red on the unmodified tree, and you must say in the commit
message whether it is red because a value is wrong or because a function is
missing. Assert on the shape that matters: given a fake table of order-line rows
carrying `product_id` and `variant_id`, the helper returns exactly the distinct
non-empty ids of each. Cover: a row with a `product_id` and no `variant_id`, a
row with both, a duplicate id appearing twice, and an empty table.

- [ ] **Step 2: Add the narrow read to `lib/db/tables.ts`**

Add one exported function next to `findAll`, selecting only the two columns
instead of `*`, paging by `id` exactly the way `findAllNoCache` already does, and
wrapped in `unstable_cache` with the same tag `getCacheTag(sheetName)` and the
same revalidation as `findAll`, so existing `revalidateTag` calls keep working
untouched. Do not add options, generics, or a column-list parameter — this plan
needs one shape and CLAUDE.md forbids abstraction beyond the request. Name it
for what it returns, not for how it works.

- [ ] **Step 3: Use it in `app/admin/products/page.tsx`**

Replace `findAll("Order_Lines_V2")` in the `Promise.all` with the new call. The
two loops that build `soldProductIds` and walk `variantProductId` keep their
exact logic — they already read only `line.product_id` and `line.variant_id`.
Leave the comment above them (the one explaining that this mirrors Postgres's
`RESTRICT`) in place; it is still true.

- [ ] **Step 4: Prove the decision did not move**

Before committing, run the page against production once (`npm run dev`, log in,
open `/admin/products`) and confirm three things in the server log: no
`Failed to set Next.js data cache` line, no `unhandledRejection`, and the page
returning in well under the 2.255ms it took today. Then confirm in the browser
that **Cà phê kem dẻo CT1** still offers "Xoá vĩnh viễn" and **Cà phê đá
(`PROD-001`)** still does not.

- [ ] **Step 5: Gates, then commit**

Four fast gates plus `npm run build`. Commit subject:
`fix(products): read only the two id columns the sold-set needs (cache entry was 3.0 MB, over Next's 2 MB ceiling)`

## Task 2: the icon the manifest promises

**Files:** `app/manifest.ts`, `public/`

`app/manifest.ts` lines 15 and 20 point at `/icon.png`, with a comment in the
file admitting it is a placeholder. `public/` holds only `pos-sw.js`, so every
page load logs `GET /icon.png 404`. On the POS this is the icon a phone or tablet
would use when the till is added to a home screen.

- [ ] **Step 1: Report, do not invent**

There is no icon file in the repo and this plan does not authorise drawing one.
Tell the owner what the manifest needs (a square PNG, and say what sizes
`app/manifest.ts` declares) and stop. If he supplies the file, add it under
`public/` and delete the placeholder comment. If he would rather not have one
yet, remove the two `icon.png` entries from the manifest so the app stops asking
for a file that does not exist — a dead reference, which this repo's own rule
says not to keep.

- [ ] **Step 2: Gates, then commit** — subject depends on which branch the owner picks.

---

## Cross-impact — flagged, not fixed here

`Orders_V2` is **3.198.720 bytes**, larger than the table that just broke. No
page calls `findAll("Orders_V2")` today, so nothing is failing. The moment one
does, it fails on the first render, the same way. Two smaller ones are far from
the ceiling: `Stock_Issues` at 37.688 bytes, `Stock_Adjustments` empty.

Worth considering after this plan, as its own decision, not folded in here: a
gate that fails the build when a page calls `findAll` on a table known to be near
the ceiling. It would have caught this before the owner saw it. That is a new
check, so it needs the owner's word before anyone builds it.

## Out of scope

Splitting `app/pos/components/POSScreen.tsx`; the `undated-data-claims`
advisory; anything that writes to production; any migration.
