# Catalogue rules

### BR-CATALOG-001 — A catalogue name is unique among live rows; a near-match warns instead of refusing

**Status:** `APPROVED` — owner decision 2026-08-19 (Plan J batch 1, `docs/superpowers/plans/2026-08-19-batch-1-foundations.md` section A).

Seven catalogue tables (`purchased_items`, `base_ingredients`, `semi_products`, `products`, `item_categories`, `units`, `suppliers`) each enforce their own name uniqueness, scoped **within the table only, never across tables** — a purchased item and the ingredient it becomes legitimately share a name (e.g. `SPM-005`/`ING-001`, both "Đá viên"). Uniqueness is scoped to `ACTIVE` rows: retiring a row (mark-inactive, never delete — `CLAUDE.md` section 2) makes its name reusable.

**Two levels, found by asking what stripping diacritics actually costs, not by principle.** The owner asked for "Ca phe" to be caught as a duplicate of "Cà phê." Stripping diacritics does that — and also collapses "Dứa" and "Dừa" (pineapple vs coconut) into one word; this catalogue already holds "Thạch dừa" (`NNL-009`), so a blanket strip would one day refuse "Thạch dứa" on a drinks menu with no way to say "that is a real, different item."

| Level | Trigger | Behaviour |
|---|---|---|
| **1 — refuse** | Name matches an existing live row after normalising (non-breaking space → space, Unicode NFC, trim, whitespace collapse, case-fold — diacritics **not** stripped) | Blocked outright, both as a database partial unique expression index (unbypassable) and an application check naming the row |
| **2 — warn** | Only the **diacritic-stripped** forms match | Shown the existing row, asked *"đây có phải là một mặt hàng khác không?"*, proceeds only on confirmation |

**Level 2 lives in the application only** — it needs a human answer, so it cannot be an index. The confirmation is recorded as a field (`duplicate_warning_confirmed`, `_by`, `_at`), not a note — same reasoning as `Không nhớ` (Plan J section 9.3): "which items were created despite a warning" has to be answerable by a query.

**đ/Đ (U+0111/U+0110) do not decompose under NFD**, unlike ordinary Vietnamese diacritics — verified directly (`đ.normalize("NFD")` stays one codepoint; `á` splits into `a` + a combining acute). The diacritic strip replaces `đ`/`Đ` explicitly before the NFD step; missing this would make "Da vien" silently fail to warn against "Đá viên."

**Level 2 is wired into five of the seven tables**: `base_ingredients` (`0066_duplicate_name_warning_confirmation.sql`), plus `purchased_items`, `semi_products`, `products`, `suppliers` (Batch 1 follow-up, 2026-08-20, `0067_duplicate_name_warning_confirmation_more_tables.sql`). The level-2 comparison logic (`findDiacriticStrippedMatch`, `lib/duplicate-name-guard.ts`) is table-agnostic; each of these five tables carries its own `duplicate_warning_confirmed`/`_by`/`_at` columns.

**`units` and `item_categories` carry level 1 only, deliberately.** Neither accumulates its own stock or purchase history — they are labels referenced by other rows, not things bought, counted, or sold, so a near-duplicate there is cosmetic dropdown confusion, not the split-ledger harm level 2 exists to catch. Both populations are also small and do not grow under shelf-pressure (`item_categories` has held exactly 3 rows since 2026-06-28; a new unit is a rare, deliberate, admin-time event). Level 1 already covers the only collision risk either table has ever actually produced.

### BR-CATALOG-002 — The purchased-item catalogue has one tier, not two

**Status:** `APPROVED` — owner decision 2026-09-01 (`docs/superpowers/plans/2026-09-01-delete-tier-2-ingredient-groups.md`), reversing an earlier reading of the owner's 2026-08-27 words that had this table staying on as a reporting-only label. Asked again directly 2026-09-01; his answer: *"Xóa trước, sau này cần thì dựng lại sau cho đúng chuẩn logic từ bây giờ trở đi."*

**One tier: Nguyên liệu (RAW) / Vật tư tiêu hao (CONSUMABLE) / Dụng cụ (EQUIPMENT)** — `item_categories`, referenced directly by every `purchased_items` row. There is no tier below it grouping several purchased items under one label for report roll-up. `base_ingredients` (`BR-CATALOG-001`'s "seven catalogue tables" is now six) was that lower tier — 46 rows, 52 of 146 purchased items linked to one — and it is gone by owner decision, not merged into `item_categories` or replaced by anything else.

**What this costs, accepted knowingly:** grouped purchase reporting ("tổng chi cho Sữa tươi across every brand of it") and the stocktake close's per-group variance summary (`apply_stocktake_session_atomic`'s aggregation loop) both go away. Neither fed a real money figure — `count_variance` on each counted line, which does drive `stock_issues`, is computed independently of this grouping and is unaffected.

**Not reversible by re-reading old data.** The owner declined a backup of the 46 groups or the 52-item mapping before deletion (his own words, same session): *"Anh sẽ tự nối lại và tự định nghĩa lại vào lúc đó, em không cần phải sao lưu lại dữ liệu trong NHÓM NGUYÊN LIỆU."* A future re-introduction of grouping is a new design, built fresh, not a restore.

**Sequenced in two steps, only the first written as of 2026-09-01.** Step 1 drops the `base_ingredients` table itself (migration written, not yet applied — code deploys first, per the `0076` lesson, `CLAUDE.md` section 2). Step 2, separately approved, drops `purchased_items.base_ingredient_id` — orphaned by step 1, still present on 52 rows, read by no screen after step 1 but still read by four server functions, two of them on the issue-slip cost path. Until step 2 lands, `BR-CATALOG-001`'s uniqueness table above still describes `base_ingredients` as live in the schema; it is not live in any application code path as of this rule.

