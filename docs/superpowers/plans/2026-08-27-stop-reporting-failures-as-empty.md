# Stop reporting a database failure as "you have no data"

**Written 2026-08-27 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1). `OPEN-ITEMS 69`.

**Found in production by the owner**, not by a test: he opened *Hàng Mua Vào*
and it said **"Chưa có hàng hóa. Thêm hàng hóa để quản lý tồn kho."** while 145
rows sat untouched in the database. The first thing he had to be told was that
his catalogue still existed.

---

## 1. The defect

`app/admin/inventory/items/actions.ts:47`:

```ts
} catch (error) {
  console.error("Loi getItemsData:", error);
  return { categories: [], baseIngredients: [], items: [], conversions: [], units: [] };
}
```

The page cannot distinguish this from a genuinely empty catalogue, so it renders
its empty state.

**An empty `findAll` does not reach this branch.** A table with no rows returns
`[]` without throwing. The catch fires only on a real failure — so returning
`[]` from it is always a lie, never a degraded truth.

## 2. Fifteen loaders, all the same shape

Measured by grep across `app/**/actions.ts`, 2026-08-27:

`brands`, `outlets`, `suppliers`, `users`, `assets`, `asset-bands`,
`base-ingredients`, `conversions`, `items`, `purchase-orders`, `production`,
`products/categories`, `products/modifiers`, `promotions`, `semi-products`.

Against real counts today: purchase orders would read **0 against 153**,
suppliers **0 against 48**, assets **0 against 84**, items **0 against 145**.

**`app/actions/auth.ts:57` is NOT in scope.** It returns
`{ success: false, error }`, which is the action-result pattern
`lib/action-error.ts` exists to serve, and it is correct. Only loaders returning
**empty collections** are wrong. Do not "tidy" the action pattern while here.

## 3. The fix

**Rethrow. Build nothing.**

`app/error.tsx` already exists and is already right: Vietnamese heading *"Đã xảy
ra lỗi"*, a *"Thử lại"* button, the error digest shown for support, a 44px touch
target, and it already reports to `/api/client-errors`. `app/global-error.tsx`
backs it. Let the boundary do its job.

Keep the `console.error` — it is how the owner's Vercel logs named the failing
table this morning. Log, then rethrow.

## 4. What this deliberately makes worse, and why that is right

**Failures become visible instead of silent.** A page that today renders a
misleading-but-calm empty list will render an error card instead. During
`OPEN-ITEMS 66`'s outage this means the owner sees an error rather than a
plausible-looking empty screen.

That is the point. An error says *try again*; an empty list says *it is gone*,
and the recovery a person reaches for is re-entering data that was never lost.
**A wrong screen that looks calm is more dangerous than a right screen that
looks alarming.**

## 5. Verification

- **Prove the test fails first, on the value.** A loader whose `findAll`
  rejects must propagate the rejection; today it resolves with `[]`. Assert
  `rejects`, and state whether the pre-fix run failed on the value or on a
  missing function.
- **One test proving the opposite too:** a loader over a genuinely empty table
  still resolves with `[]` and does **not** throw. Without this, the fix could
  be "throw on empty", which is a different bug wearing the same diff.
- `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`,
  `npm run build` — `CLAUDE.md` §9 in full.
- Report the count of loaders changed, and confirm **no action function**
  (`{ success, error }`) was touched.

## 6. Done means

`CLAUDE.md` §9. Do not push.

**What a green suite cannot show:** that the error card actually renders on
these routes. After deploy, the owner opens one admin screen logged in — and
the honest test is the one nobody can schedule, the next time the database
hiccups.
