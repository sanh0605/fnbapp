# "Ngừng bán", and a delete that means it

**Written 2026-08-29 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). `OPEN-ITEMS 73`.

**Found by the owner** looking for the button `CLAUDE.md` §2's never-delete rule
tells him to press. It does not exist.

---

## 1. What is wrong today

`ProductsClient.tsx:101` offers a **Ngừng bán** filter and lines 168/235 render
a **Ngừng bán** badge. `app/admin/products/actions.ts` exports exactly two
functions — `saveProduct` and `deleteProduct` — and **neither writes
`INACTIVE`**. Measured 2026-08-29: **44 ACTIVE, 4 DELETED, 0 INACTIVE**, with no
code path that could produce one.

The opposite defect sits beside it: **`deleteProduct` does not delete.** It sets
`status = 'DELETED'` and cascades that to the variants. So the button honours
the rule while announcing that it breaks it, and a careful person avoids the one
safe action on the screen.

**Three intentions, two buttons.** Pause a seasonal drink; retire one for good;
erase one created by mistake. The missing one is the everyday case — which is
why the product list only grows.

## 2. What the owner decided, 2026-08-29

Three states, and a delete that is real when it safely can be:

| State | Shown on POS | In the admin list | Reversible |
|---|---|---|---|
| **Đang bán** | yes | yes | — |
| **Ngừng bán** | no | yes | one click |
| **Đã xoá** | no | no | see below |

**A product that has never been sold is erased. A product that has been sold is
only hidden.** He confirmed this after being shown why.

**This overrides `CLAUDE.md` §2**, which lists *món* among the things never to
delete. Record the exception with its date and reason in the same commit, scoped
to products that have never been sold — do not widen it.

## 3. The database already enforces the split

**Do not implement this rule in application code.** Every foreign key into
`products` and `product_variants` is `RESTRICT`:

| From | To |
|---|---|
| `order_lines_v2.product_id` | `products` |
| `order_lines_v2.variant_id` | `product_variants` |
| `product_price_history.variant_id` | `product_variants` |
| `product_variants.product_id` | `products` |

**Postgres will refuse to erase a product that has been sold.** Attempt the
delete and translate the refusal into Vietnamese — the guarantee then comes from
the deepest layer, not from a check anyone can forget to run.

**But `product_price_history` restricts too, and that one must cascade.**
Measured: of the 4 currently-DELETED products, all have 0 sales, yet **3 have a
price-history row** and would be refused for a reason the owner would find
absurd. A price history for a drink never sold records nothing.

So an erase removes, in order: **price history → variants → product.** It never
touches `order_lines_v2`, and if that FK refuses, the refusal is the answer.

**My own first count was wrong here and the correction matters.** I told him 4
products were erasable; with the price-history FK unhandled the true number is
**1**. With the cascade it is 4. State the number after implementing, not before.

## 4. History does not need protecting the way it looks

**All 3.438 order lines carry `product_snapshot_json`** — every sale holds its
own copy of the product's name, size and price. Erasing a never-sold product
removes nothing any order needs, which is the same reason the recipe deletion is
survivable.

**The reference is what breaks, not the record.** `TS-009`/`TS-010` are today's
live example: two assets point at a purchase line that no longer exists, so
every join from assets to purchases silently returns 82 of 84 rows
(`OPEN-ITEMS 65`). That is precisely what the `RESTRICT` keys exist to prevent
here, and why the sold case must stay hidden rather than erased.

## 5. The change

1. **A `Ngừng bán` / `Bán lại` toggle** writing `INACTIVE` / `ACTIVE`. Cascade
   to variants the same way `deleteProduct` already cascades — a paused drink
   must not remain sellable through a variant.
2. **Rename the existing button.** It currently says *Xóa* and hides.
   The screen should say what it does: hiding is **Ẩn khỏi danh sách**, erasing
   is **Xoá vĩnh viễn**, and the second is offered only when it is possible.
3. **Erase**: price history, then variants, then product. Confirm first, naming
   the product, and say plainly that it cannot be undone.
4. **The POS must not sell an `INACTIVE` product.** Check where the POS filters
   products today — if it filters on `status === "ACTIVE"` this is already true;
   if it filters on `!== "DELETED"` it is not, and a paused drink stays on sale.
   **Establish which, do not assume** — this is the whole point of the feature.

## 6. Verification

- **Test first, failing on the value:** pausing a product sets `INACTIVE` on it
  and its variants; today no code path can. Say whether the pre-fix failure was
  the value or a missing function.
- **The refusal is tested, not just the success:** erasing a product with a sale
  must fail and surface a Vietnamese message. Use `Test1` — 1 sale, 1 price
  history — as the fixture shape. A delete path whose refusal nobody tested is a
  delete path that will one day not refuse.
- **The POS does not offer an `INACTIVE` product** — proved by a test, since
  this is the behaviour the owner is buying.
- Erasing a never-sold product leaves `order_lines_v2` untouched: assert its row
  count and `verify-revenue.ts` unmoved.
- Full `CLAUDE.md` §9.

## 7. Done means

`CLAUDE.md` §9, and the `CLAUDE.md` §2 exception recorded. Do not push without
approval. **Then the owner pauses one real drink, checks it is gone from the POS
and still in the list, and un-pauses it** — that round trip is the feature, and
no test proves it for him.
