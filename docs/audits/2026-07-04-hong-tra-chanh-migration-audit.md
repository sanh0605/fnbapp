# Hồng trà chanh → Lục trà chanh Migration Pre-flight Audit

Date: 2026-07-04  
Cutoff: `2026-06-29 00:00:00 Asia/Ho_Chi_Minh`  
Equivalent instant: `2026-06-28T17:00:00.000Z`  
Mode: read-only; no operational data was changed

## Executive result

- The affected set is **4 completed orders, 4 order lines, 5 drinks**.
- All affected drinks are `700ml`. The target catalog has an exact active
  size match: `VAR-016` → `VAR-051`.
- Original and target prices are both `15,000 VND`; preserving the original
  price leaves all revenue, discount, and order-total fields unchanged.
- Stored COGS for the four lines is `20,923 VND`. Replaying the target recipe
  against the inventory and MAC state at each sale projects `11,370 VND`, a
  `-9,553 VND` change.
- `stock_ledger.item_reference` is an ingredient or semi-product ID, not a
  product variant ID. There is no `mac_ledger` table. MAC is derived from
  `stock_ledger`.
- The four orders have 29 `SALES_CONSUME` rows in total because two orders
  contain other products. Ledger rows are linked at order level and have no
  order-line ID.
- Rebuilding every affected order from its saved recipe snapshots reproduces
  all 29 stored rows with zero quantity mismatch. This gives a safe basis for
  an atomic order-ledger rebuild.
- `REC-068` still exists but is closed at the cutoff. It is not yet deleted.
  Order snapshots do not store recipe IDs, so no order line directly
  references `REC-068`.

## A. Product catalog audit

The live schema uses `status`, not an `active` boolean.

| Product | Product ID | Category | Status |
| --- | --- | --- | --- |
| Hồng trà chanh | `PROD-011` | `CAT-004` | `ACTIVE` |
| Lục trà chanh | `PROD-042` | `CAT-004` | `ACTIVE` |

| Product | Size | Variant ID | Price | Status |
| --- | --- | --- | ---: | --- |
| Hồng trà chanh | 700ml | `VAR-016` | 15,000 | `ACTIVE` |
| Hồng trà chanh | 1000ml | `VAR-017` | 20,000 | `ACTIVE` |
| Lục trà chanh | 700ml | `VAR-051` | 15,000 | `ACTIVE` |
| Lục trà chanh | 1000ml | `VAR-052` | 20,000 | `ACTIVE` |

`PROD-042` was physically created on 2026-07-04. Its variants and recipes
were backdated to the cutoff instant. The migration must therefore treat the
catalog history as an explicit recovery artifact, not infer it from the
product row's `created_at`.

## B. Recipe history audit

Effective recipe selection uses the half-open interval
`start <= sale time < end`.

At exactly the cutoff:

| Variant | Effective recipe | Ingredients |
| --- | --- | --- |
| `VAR-016` Hồng 700ml | `REC-093` | Lục trà 150 + Nước đường 40 + Trái chanh 1 |
| `VAR-017` Hồng 1000ml | `REC-094` | Lục trà 200 + Nước đường 50 + Trái chanh 1 |
| `VAR-051` Lục 700ml | `REC-098` | Lục trà 150 + Nước đường 40 + Trái chanh 1 |
| `VAR-052` Lục 1000ml | `REC-099` | Lục trà 200 + Nước đường 50 + Trái chanh 1 |

Relevant Hồng trà chanh 700ml chain:

| Recipe | Effective start | End | Summary |
| --- | --- | --- | --- |
| `REC-062` | 2026-06-15 00:00:01 +07 | 2026-06-25 10:03:10 +07 | Hồng trà 150 + Nước đường 40 + Chanh 1 |
| `REC-068` | 2026-06-25 10:03:10 +07 | 2026-06-29 00:00:00 +07 | Hồng trà 220 + Nước đường 40; missing chanh |
| `REC-093` | 2026-06-29 00:00:00 +07 | 2026-06-29 00:00:01 +07 | Transitional Lục-trà recipe on Hồng variant |
| `REC-096` | 2026-06-29 00:00:01 +07 | open | Restored Hồng trà 150 + Nước đường 40 + Chanh 1 |

The Lục variants have their own open recipe chain:

- `REC-098` for `VAR-051` 700ml.
- `REC-099` for `VAR-052` 1000ml.

`REC-093` and `REC-094` are one-second transitional rows attached to the
Hồng variants. No affected sale falls in that one-second interval. They are
not part of the requested `REC-068` cleanup and should not be silently
deleted.

### REC-068 safety

- `recipe_snapshot_json` contains ingredient snapshots, not a `recipe_id`.
- Direct order-line references to the string `REC-068`: **0**.
- Three affected lines (4 drinks) carry the corrupt ingredient shape
  `BTP-008 x 220 + ING-022 x 40` without lemon.
- The fourth affected line (1 drink) already carries the restored Hồng recipe
  shape but is still migrated because the user requested every qualifying
  Hồng trà chanh sale.

Hard deletion is technically possible because there is no order FK/reference,
but it removes the database-level history of the corruption. The audit file
and pre-apply snapshot must therefore be retained if hard deletion is chosen.

## C. Affected completed orders

The real order-line schema does not have `product_name`; the name is stored in
`product_snapshot_json.name`. Selection must use:

```sql
o.status = 'COMPLETED'
AND o.created_at >= '2026-06-29T00:00:00+07:00'::timestamptz
AND (
  ol.product_id = 'PROD-011'
  OR ol.product_snapshot_json->>'name' = 'Hồng trà chanh'
)
```

| Order | Order ID | Created in Việt Nam | Line | Qty | Stored COGS |
| --- | --- | --- | --- | ---: | ---: |
| `UCK000364` | `ord-85ae2ec8-9c4e-4aa7-8574-92848656974b` | 2026-07-01 20:29:17 +07 | `ol-da46c55c-13ce-4925-886a-7c236669d2c9` | 2 | 8,295 |
| `UCK000369` | `ord-053d2cf7-135c-43bf-acdd-336e0fb828cc` | 2026-07-02 07:49:00 +07 | `ol-f75a72f2-17d7-49d4-9e1f-f26081989d29` | 1 | 4,147 |
| `UCK000384` | `ord-e71ac11d-c526-462f-9fd9-f7fc8da6fac7` | 2026-07-03 20:02:51 +07 | `ol-3206d450-fe42-4e64-95f5-bce7baabca7b` | 1 | 4,136 |
| `UCK000391` | `ord-528c0651-02bf-498f-abb2-6a6e2e192394` | 2026-07-04 17:33:08 +07 | `ol-1cc85bc3-4d8b-4771-b86b-eeb5f203d42c` | 1 | 4,345 |

Range: 2026-07-01 20:29:17 +07 through 2026-07-04 17:33:08 +07.

None of the four orders has a non-empty `superseded_by`.

## D. Stock ledger audit

The proposed query using
`item_reference = '<hong_tra_chanh_variant_id>'` is not valid for this schema.
`item_reference` contains IDs such as `BTP-008`, `ING-021`, and `NNL-006`.
Order linkage is through `reference_id`.

```sql
SELECT *
FROM stock_ledger
WHERE reference_id IN (
  'ord-85ae2ec8-9c4e-4aa7-8574-92848656974b',
  'ord-053d2cf7-135c-43bf-acdd-336e0fb828cc',
  'ord-e71ac11d-c526-462f-9fd9-f7fc8da6fac7',
  'ord-528c0651-02bf-498f-abb2-6a6e2e192394'
)
AND transaction_type = 'SALES_CONSUME';
```

Result: **29 rows**. The first two orders contain another product line, so
not every row belongs to Hồng trà chanh. There is no line-level key on
`stock_ledger`.

The deterministic replay used:

1. inventory balance immediately before each order;
2. saved line recipes in `line_no` order;
3. the effective BTP recipe at sale time;
4. the same BTP-shortfall expansion as checkout.

It reproduced the full stored ledger of all four orders with **0 mismatched
items**.

### Projected affected-line consumption

| Item | Old consumption | New consumption | Inventory balance delta |
| --- | ---: | ---: | ---: |
| Đá viên `ING-001` | 245.238095 | 178.571429 | +66.666667 |
| Lá trà xanh `ING-020` | 0 | 35.714286 | -35.714286 |
| Lá hồng trà `ING-021` | 49.047619 | 0 | +49.047619 |
| Nước đường `ING-022` | 200 | 200 | 0 |
| Trân châu trắng `ING-034` | 50 | 50 | 0 |
| Nước sôi `NNL-003` | 980.952381 | 714.285714 | +266.666667 |
| Trái chanh `NNL-006` | 1 | 5 | -4 |

All five target drinks encounter `BTP-009` shortfall at their sale time, so
the projected ledger consumes the Lục-trà BTP recipe inputs rather than
`BTP-009` itself.

Current and projected balances for changed items:

| Item | Current | Projected after migration |
| --- | ---: | ---: |
| Đá viên `ING-001` | -4,197.450292 | -4,130.783625 |
| Lá trà xanh `ING-020` | 6,142.857144 | 6,107.142858 |
| Lá hồng trà `ING-021` | -548.511896 | -499.464277 |
| Nước sôi `NNL-003` | -30,586.095250 | -30,319.428583 |
| Trái chanh `NNL-006` | -1 | -5 |

The migration does not resolve pre-existing negative stock. Those balances
belong to the separate negative-stock recovery workstream.

Product variants themselves do not have stock balances in this model.
Therefore the proposed verification “Hồng variant stock = 0 / Lục variant
stock unchanged” is not applicable; verification must use ingredient/BTP
balances.

## E. MAC and COGS audit

There is no `public.mac_ledger` table (`PGRST205`). The MAC index is built from
all `stock_ledger` rows.

| Order | Stored affected-line COGS | Projected Lục-trà COGS | Delta |
| --- | ---: | ---: | ---: |
| `UCK000364` | 8,295 | 4,038 | -4,257 |
| `UCK000369` | 4,147 | 2,019 | -2,128 |
| `UCK000384` | 4,136 | 2,019 | -2,117 |
| `UCK000391` | 4,345 | 3,294 | -1,051 |
| **Total** | **20,923** | **11,370** | **-9,553** |

The calculation uses the target consumption rows and MAC state at each
original sale timestamp. Revenue is unchanged, so P&L gross profit increases
by `9,553 VND` for the affected period.

## F. Timezone verification

The cutoff is unambiguous:

```text
2026-06-29T00:00:00+07:00
= 2026-06-28T17:00:00.000Z
```

PostgREST returned every `timestamptz` value with `+00:00`. Direct
`SHOW timezone` is not exposed through this project's PostgREST schemas:
`pg_catalog` access returns `PGRST106`, and there is no read-only SQL RPC.
The server setting therefore could not be read without adding a database
function or using a direct Postgres connection.

Important PostgreSQL behavior: `timestamptz` stores an instant, not the
original textual offset. Supplying `+07:00` makes the filter correct but does
not preserve `+07:00` for display. A database viewer will render the value in
its session timezone.

Recommended contract:

- Pass the cutoff as the explicit ISO value
  `2026-06-29T00:00:00+07:00`.
- Keep all timestamp columns as `timestamptz`.
- For human-readable queries, use:

```sql
SELECT
  created_at,
  created_at AT TIME ZONE 'Asia/Ho_Chi_Minh' AS created_at_vn
FROM orders_v2;
```

- If the Supabase SQL editor/database client must display `+07`, configure
  that session or role with `SET TIME ZONE 'Asia/Ho_Chi_Minh'`. Do not replace
  `timestamptz` with a timezone-less column.

## Decisions and recommended migration design

### Pricing

**Recommendation: preserve every original commercial field.**

The target prices exactly equal the original prices for both sizes, and only
700ml is affected. Update product/variant identity and snapshots, but do not
change `unit_price`, gross/net totals, or discount allocations.

### Ledger treatment

**Recommendation: rebuild the complete `SALES_CONSUME` set for each of the
four orders atomically. Do not leave the old ledger as-is.**

Leaving it unchanged contradicts the requested product swap: inventory would
still show Hồng-trà consumption and `cost_at_sale` would still price the old
recipe. Updating only rows guessed to belong to the changed line is unsafe
because ledger rows have no line ID.

The safer process is:

1. lock and re-read the four qualifying orders;
2. verify their IDs, status, line fingerprints, and 29-row ledger fingerprint;
3. rebuild every line in `line_no` order, replacing only the selected line's
   product, variant, and variant-recipe snapshot;
4. delete and regenerate the four orders' `SALES_CONSUME` rows at the original
   sale timestamps;
5. update only the four selected lines' `cost_at_sale`;
6. insert a `MIGRATED` order event for each order with before/after IDs, COGS,
   script version, cutoff, and migration timestamp;
7. delete `REC-068` in the same transaction after verifying its fingerprint.

This is historical reprocessing, but it is explicit, bounded, recoverable,
and produces the inventory/COGS outcome requested by the user.

### Transaction boundary

The apply path must be a single PostgreSQL transaction, preferably a
purpose-built RPC following the existing atomic POS/recovery patterns.
Sequential PostgREST updates from a script are not acceptable for this
financial migration.

### Idempotency

Use a fixed migration key such as
`HONG_TO_LUC_2026-06-29_V1`. The transaction must:

- return success without changes when all four lines already target
  `PROD-042`/`VAR-051`, the ledger fingerprint matches the target, all
  migration events exist, and `REC-068` is absent;
- reject partial state;
- reject new qualifying lines not present in the reviewed dry-run;
- reject any changed source fingerprint.

## Backup and rollback plan

No snapshot was created during this read-only audit.

Immediately before `--apply`:

1. run `scripts/capture-recovery-snapshot.ts --capture`;
2. run `scripts/verify-recovery-snapshot.ts <snapshot-id>`;
3. record the immutable snapshot ID and SHA-256 manifest hash in the dry-run
   output and migration event;
4. save a focused before-image of `REC-068`, the four orders, all their lines,
   events, and 29 ledger rows.

Rollback must also be one transaction:

- restore the four original order-line rows;
- delete regenerated ledger rows by migration event/key;
- restore the exact 29 original ledger rows and IDs;
- restore `REC-068`;
- remove or append a rollback audit event according to the approved protocol;
- verify row fingerprints and P&L/stock parity against the focused
  before-image.

Snapshot restore is the disaster-recovery fallback, not the normal rollback
mechanism.

## Dry-run acceptance gates

The future `scripts/migrate-hong-tra-to-luc-tra.ts` must default to read-only
and print:

- the fixed cutoff in both `+07` and UTC;
- 4 orders, 4 lines, 5 units;
- all four before/after identity and recipe diffs;
- size coverage: 5/5 mapped to `VAR-051`;
- prices and all commercial totals unchanged;
- 29 source ledger rows and a zero-mismatch source replay;
- projected ingredient deltas above;
- COGS `20,923 → 11,370` (`-9,553`);
- `REC-068` fingerprint and zero direct recipe-ID references;
- snapshot ID/hash;
- a refusal message unless `--apply` is explicitly present.

Do not run `--apply` until the user reviews that dry-run output and explicitly
approves it.
