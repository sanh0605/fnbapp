# The outlet screen was never built, and nothing would have noticed

**Written 2026-08-25 by Opus 5.** Handoff to Sonnet 5. Critique before coding
(`CLAUDE.md` §1), in particular §3's allowlist approach and whether the guard
belongs in a test or in `scripts/check-rules-current.ts`.

---

## 1. What happened

`docs/superpowers/plans/2026-08-24-outlets-and-order-code.md` §5.1 step 2
specified: *"**Screen** to add, rename and retire an outlet — retiring sets
`end_date` and `status`, never deletes, and never frees the code."*

`app/admin/outlets/` contains `actions.ts` and `actions.test.ts`. **There is no
`page.tsx`.** The actions exist only to feed the POS modal. The owner has no way
to rename `Điểm bán 1`, add a third outlet, or retire one.

He found it himself, and he had already raised the general version on
2026-08-17: *"tránh xảy ra trường hợp anh cứ phải hỏi anh bấm vào đâu mới có
đường dẫn vào."*

**This is the third defect of the same shape in one batch** — the success-toast
instruction, and now this. The plan carried it, the implementation did not act
on it, the implementation report did not mention it, and the independent review
pass did not catch it. Every time, the owner found it by opening the app.

The lesson is not "read the plan more carefully". It is that **nothing
mechanical checks whether a screen the plan promised exists and is reachable**,
so the only detector is the owner. §3 fixes that.

## 2. Build the screen

`app/admin/outlets/page.tsx`, phone-first (`CLAUDE.md` §8): one card per outlet,
no horizontal table.

Per outlet show: code, name, brand, status, start/end date. Actions:

- **Thêm điểm bán** — name, brand, address, start date. **The code is assigned
  by the system as `max(code) + 1`, never chosen by the user and never taken
  from a freed gap** (owner: *"Điểm bán 4: 004 (không thay thế vào lại điểm bán
  đã ngừng hoạt động)"*). Show the code that will be assigned before saving.
- **Đổi tên** — the name is editable precisely because the code is frozen. Say
  so on the screen in one line, so nobody fears renaming.
- **Ngừng hoạt động** — sets `status` and `end_date`. Never deletes, never
  frees the code. Refuse if it is the last active outlet, with a Vietnamese
  message: there would be nothing to open the till with.

Add the nav entry under **Danh mục**, beside `Thương hiệu`.

**Do not** add outlet-scoped permissions, staff assignment, or brand time
windows — all still parked in
`docs/superpowers/specs/2026-07-28-multi-outlet-design.md`.

## 3. The guard that makes this class of defect fail loudly

Measured 2026-08-25: **33 static pages under `app/admin`, 28 nav entries, 0 nav
entries pointing at a missing page**, and **5 pages with no way in**:

| Page | Verdict |
|---|---|
| `/admin/inventory` | section index, reached as a parent — legitimately unlinked |
| `/admin/inventory/purchase-orders/new` | reached from the list — legitimately unlinked |
| `/admin/pos-sync` | **no way in** |
| `/admin/products/toppings` | **no way in** — possibly superseded by `Topping & Tùy chọn` (`/admin/products/modifiers`) |
| `/admin/reports/stock` | **no way in** |

Write a check that walks `app/admin/**/page.tsx`, ignores dynamic segments
(`[id]`), and asserts every remaining route either appears in `layout.tsx`'s
`navItems` **or** is named in an explicit allowlist with a one-line reason.

Seed the allowlist with the two legitimate entries above. **Put the other three
in it too, each marked `TODO: owner decision` with a comment** — do not quietly
link them into the menu, because `/admin/products/toppings` may be dead and
linking a dead screen is worse than leaving it unreachable. Report what those
three pages actually are so the owner can decide.

**Prove the guard fails first:** run it against the tree with the outlets entry
removed from `navItems`, confirm it reports that route, then restore.

The guard must fail on **either** half — a page with no entry, and an entry with
no page. The second half currently passes trivially (0 such cases); say so
rather than implying it was exercised.

## 4. Verification

- The guard, proven to fail as above.
- A rendered test that the outlets page lists the two seeded outlets and that
  the nav contains the entry.
- Creating a third outlet assigns `003`; retiring `002` and then creating
  another assigns `004`, not `002`. This is the owner's rule and it is the one
  worth a test.
- Retiring the last active outlet is refused.
- `CLAUDE.md` §9's four gates. No migration — `outlets` already exists in
  production and holds the two seeded rows.
- Do not push.

## 5. Done means

`CLAUDE.md` §9 in full, plus §4.
