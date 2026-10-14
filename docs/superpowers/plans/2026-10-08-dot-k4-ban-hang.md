# Đợt K4 — các màn Bán hàng mặc khuôn dùng chung (BR-UI-005), gộp đợt 8c và ô tiền ở giá món, tuỳ chọn, khuyến mãi

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Who does which task is fixed by `CLAUDE.md` ("Ai viết code"): screens (`.tsx` under `app/`) → Gemini via `agy`; guard edits, screen tests written before the screen changes, docs, review → Opus; `lib/` (none planned) → Sonnet.

**Goal:** Every screen under Bán hàng in the menu except Thương hiệu and Điểm bán (K6) — Đơn hàng, Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi — uses the K2 templates: no `type="number"` box, no hand-painted solid button, no hand-drawn `<table>`, no bold row cell, no hand-styled text box, select or `<h1>`. The money boxes for a dish's price, an option's price and a promotion's values group thousands as they are typed, which closes the `it.todo` in `components/ui/MoneyInput.test.tsx`.

**Architecture:** No new component and no server change. Each task takes its files off the guard's debt lists first (the guard goes red naming them), writes the screen tests for each number box that changes (red on the old `type="number"` box), then hands the screens to Gemini with a brief, then runs the tests and the type check. Number boxes keep the page's own state shape and convert at the boundary, so server actions and posted values stay identical.

**Tech Stack:** TypeScript, Next.js App Router, React 18, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (sections 2.1–2.6, 3, 4 row K4, 5). Shared list/detail pieces: `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` section 5. Rules: `BR-UI-001`, `BR-UI-003`, `BR-UI-005`, `BR-UI-008`, `BR-UI-009`, `BR-UI-010` in `docs/02-rules/business-rules/screens.md`; `BR-CASH-005`; `BR-DATA-007` (no popups; orders cancelled one at a time from their own page).

Kế hoạch này xoá khi chủ quán nhận đợt K4.

## Hiện trạng

Đo 2026-10-08 trên các file `.tsx` trong `app/admin/orders`, `app/admin/products`, `app/admin/promotions`, không tính test.

1. **Trạng thái.** Không áp dụng cho dữ liệu, vì đợt này không thêm bảng hay trạng thái nào. Ô nhập có ba trạng thái hiển thị như K2: bình thường, đang chọn, sai (chữ đỏ dưới ô).
2. **Nút.** 12 file Bán hàng tự tô nút nâu hoặc đỏ đặc. Sau đợt này mọi nút là `Button`: Chính (nâu) cho việc chính của màn, Phụ cho lọc, sửa, bỏ; Xoá (viền đỏ) cho mở việc xoá, huỷ đơn, ngừng dùng; Xác nhận xoá (đỏ đặc) chỉ ở bước cuối. Mỗi màn hiện nhiều nhất một nút Chính. **Nút "Huỷ" trên từng dòng của danh sách Đơn hàng bỏ đi**: chủ quán chốt 2026-10-05 đơn huỷ từng cái ở trang chi tiết của nó (`BR-DATA-007`), trang chi tiết đã có nút này. Không nút nào khác bị ẩn hay hiện thêm.
3. **Danh sách.** Đơn hàng (`OrderTable.tsx`, 493 dòng) tự vẽ bảng trên máy tính và thẻ trên điện thoại; chuyển sang bộ `Table` (máy tính) và thẻ của khuôn (điện thoại), giữ cột, bộ lọc, phân trang, `returnTo`. Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi đã dùng `DataList`; chỉ đổi nút và ô lọc. Bảng trong trang chi tiết (size của món, món của nhóm, món được giảm của khuyến mãi, dòng của đơn) dùng bộ `Table`. Mọi ô dòng cùng độ đậm thường.
4. **Ô nhập.** 7 ô `type="number"` ở 5 file chuyển sang `NumberInput`. Dữ liệu đo 2026-10-08, chỉ đọc: 60 giá size món (cao nhất 35.000đ, không cái nào 0đ), 9 giá tuỳ chọn (không cái nào 0đ), 2 khuyến mãi (đồng giá 15.000đ cho 31 size, giảm 10.000đ cho 14 size; không cái nào theo phần trăm), 142 trên 3.356 đơn có giảm tay. Mọi giá trị đang lưu là số nguyên; cột giá và giá trị giảm của khuyến mãi là `bigint`.

   | Ô | Chữ số lẻ | Giới hạn | Ví dụ mờ |
   |---|---|---|---|
   | Món: giá bán từng size | 0, `đ` | từ 0, bắt buộc | 25,000 |
   | Topping & tuỳ chọn: giá thêm | 0, `đ` | từ 0 (0đ hợp lệ, ví dụ "Chọn Đá") | 5,000 |
   | Khuyến mãi: giá trị giảm, kiểu % | 0, `%` | lớn hơn 0, không quá 100 (máy chủ đang chặn như vậy, cột `bigint`) | 10 |
   | Khuyến mãi: giá trị giảm, kiểu tiền hoặc đồng giá | 0, `đ` | lớn hơn 0 | 20,000 / 15,000 |
   | Khuyến mãi: đơn tối thiểu | 0, `đ` | từ 0, không bắt buộc | 50,000 |
   | Khuyến mãi: giảm riêng từng size | như ô giá trị giảm | để trống thì lấy giá trị chung (như hôm nay) | giá trị chung |
   | Sửa đơn: giảm giá cả đơn, giảm giá một món | kiểu tiền 0, `đ`; kiểu % 2, `%`, không quá 100 | từ 0 | 10,000 / 10 |

   Ô chữ, ô chọn thường, ô ngày tự tô chuyển sang `TextInput`, `Select`, `DayInput`/`SaigonDateTimeInput`; nhãn và gợi ý theo `Field`. Danh sách chọn món giữ `SearchableSelect`.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ Đơn hàng, Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi. Cố ý không đụng: máy chủ, server action, dữ liệu, cách tính; Thương hiệu, Điểm bán (K6); Lịch sử giá món và trang `/admin/products/toppings` (phần 2 kế hoạch chung); máy bán hàng. `app/admin/products/components/ToppingsManager.tsx` là code chết (không file nào nhập nó, đã báo ở kế hoạch chung phần 6): không sửa, vẫn nằm trong danh sách nợ, ghi chú lý do. Không đổi chữ hiển thị, trừ nhãn viết hoa từng từ hoặc in hoa ("Tên Size", "Giá bán (VNĐ)", "Tên Tùy Chọn" thành "Tên size", "Giá bán", "Tên tuỳ chọn"; đơn vị `đ` nằm trong ô) và chữ tiếng Anh trong ngoặc (`BR-UI-001`).

Câu hỏi riêng của việc này:

6. **Chủ quán thấy gì khác?** Nút, ô, bảng của năm màn theo trang mẫu đã duyệt. Giá món, giá tuỳ chọn, giá trị khuyến mãi tự chèn dấu phẩy khi gõ (`25000` thành `25,000`), không còn mũi tên tăng giảm, lăn chuột không đổi số. Danh sách Đơn hàng không còn nút "Huỷ" ở từng dòng: bấm vào đơn rồi huỷ ở trang chi tiết.
7. **Có làm máy bán hàng ngừng nhận đơn không?** Không. Không file nào trong `app/pos` hay `lib` bị đụng. Giá món lưu ra vẫn là số nguyên như cũ, nên máy bán hàng đọc như cũ.
8. **Ô giá món của size gắn với topping** đang khoá (giá đặt ở màn Topping & tuỳ chọn): ô mới vẫn khoá, hiện số có dấu phẩy, câu gợi ý giữ nguyên.
9. **Khuyến mãi đổi kiểu từ tiền sang %** khi ô đã có `15000`: ô báo "Nhập số không quá 100." ngay dưới ô, như máy chủ đang từ chối. Hôm nay phải bấm lưu mới thấy lỗi.
10. **Ví dụ bằng số thật.** Không áp dụng, vì đợt này không đọc hay ghi dữ liệu thật ngoài phép đo ở câu 4; ví dụ gõ phím nằm trong test từng task.

Đã xem: spec 2026-10-07 mục 1–6; kế hoạch K3 (khuôn công việc); `components/ui/template.guard.test.ts` các dòng gắn K4; `app/admin/no-popups.test.ts`; mọi ô `type="number"` và `inputMode` trong năm màn; cách khuyến mãi lưu giá trị từng size (`applicable_products_json`) và cách máy chủ kiểm giá trị giảm (`app/admin/promotions/actions.ts`); `NumberInput` props; số dòng từng file.
Chưa xem: thân từng file màn hình (Gemini đọc khi làm, Opus đọc khi soát); `lib/sales/order-cart.ts` ngoài chữ ký giảm tay (không đổi).

## Global Constraints

- Templates (K2, `components/ui/`): `Button` (`primary` | `secondary` | `delete` | `danger`, `href`, className for layout only), `NumberInput`, `MoneyInput`, `TextInput`, `Select`, `Field`, `Table` set, `MoneySummary`, `list/DataList`, `list/ListPageHeader`, `list/FilterCard`, `list/ListPagination`, `detail/DetailHeader`, `detail/DetailFrame`, `detail/FieldList`, `PageHeader`, `BackLink`, `Badge`, `DayInput`, `SaigonDateTimeInput`, `SearchableSelect`.
- A page-held money box is `NumberInput` with `decimals={0}` and `unit="đ"`; `MoneyInput` only where the form posts by `name`. A box where 0 means 0 (an option's price) does not pass `zeroIsEmpty`.
- A `NumberInput` inside a `Field`: give the hint and the error to `NumberInput`, not to `Field`.
- Copy (spec 2.2, verbatim): "Cần nhập số." · "Nhập số lớn hơn 0." · "Nhập số từ {min} trở lên." · "Nhập số không quá {max}." · placeholder "Ví dụ: …".
- All visible text Vietnamese; labels in sentence case except Topping, MR.PHIN, PO and units.
- No popups (`BR-DATA-007`); no new server action; values sent to the server identical to today (`25000`, `12.5`).
- Every control 44px tall; desktop table plus phone cards for every list (`.claude/rules/ui-devices.md`).
- One brown main button visible per screen at any moment.
- Never delete a test; a test changed because a box is no longer `type="number"` says so in the commit.
- The guard's debt lists may only shrink.

## Review Focus

1. A size linked to a topping: the price box is locked, shows `15,000`, and saving the dish sends the same price as today. Pinned in Task 2.
2. An option priced 0đ: the box shows `0`, never empties itself, and saving sends 0. Pinned in Task 1.
3. A promotion switched from "Số tiền giảm cố định" to "Phần trăm" with `15000` typed: the box says "Nhập số không quá 100." at once; the per-size box left empty still takes the shared value. Pinned in Task 3.
4. Editing an order with a 12.5% discount: the box takes `12.5`, the totals match what they show today, and the saved discount is the same. Pinned in Task 4.
5. Đơn hàng list: a filter in the URL survives opening an order and coming back; the phone shows cards; no row carries a "Huỷ" button. Pinned in Task 4.

---

### Tasks 1–4: one Gemini run per group of screens

Each task has the same five steps; only the files, the number boxes and the tests differ.

- [ ] **Step 1 (Opus): take the task's files off every debt list** in `components/ui/template.guard.test.ts`. Run the guard. Expected: FAIL naming exactly those files (wrong value).
- [ ] **Step 2 (Opus): write the task's screen tests** (listed per task). Run them. Expected: FAIL on wrong values (the box is still `type="number"`, the button still hand-painted).
- [ ] **Step 3 (Gemini): brief in the scratchpad**, starting "IMPORTANT: this run has NO command tool…", naming the files, the templates, this task's rows of the number-box table, the copy rules, desktop and phone. Run `agy --model <newest strongest Gemini from agy models> --mode accept-edits -p "$(cat brief)"`.
- [ ] **Step 4 (Opus): run** `npx vitest run <task dirs> components/ui/template.guard.test.ts` and `npx tsc --noEmit`. Expected: PASS, tsc clean. Read the diff: no server action, no sent value, no visible text changed beyond the rules.
- [ ] **Step 5: Commit** `feat(ui): <group> wears the shared templates (BR-UI-005, wave K4)`.

#### Task 1: Nhóm món, Topping & tuỳ chọn

Files: every file under `app/admin/products/categories` and `app/admin/products/modifiers` on a debt list. `ToppingsManager.tsx` stays on its lists with the comment "dead code, nothing imports it (master plan part 6)".
Tests to write first:
- `ModifierForm.test.tsx`: "Giá thêm" is a text box with `inputMode="numeric"`, placeholder "Ví dụ: 5,000", unit `đ`; typing `5000` shows `5,000`; an option seeded at 0 shows `0`; saving sends `5000` / `0` as today (Review Focus 2).

#### Task 2: Món

Files: `app/admin/products/ProductsClient.tsx`, `app/admin/products/[id]/components/ProductDetailView.tsx`, `app/admin/products/components/ProductForm.tsx`.
Tests to write first:
- `ProductForm.test.tsx`: each size's "Giá bán" is a text box with `inputMode="numeric"`, unit `đ`, placeholder "Ví dụ: 25,000"; typing `25000` shows `25,000`; empty on save says "Cần nhập số."; a size linked to a topping shows its price grouped and cannot be typed into; the saved variants carry the same price numbers as today (Review Focus 1).

#### Task 3: Khuyến mãi

Files: `app/admin/promotions/components/PromotionsClient.tsx`, `app/admin/promotions/[id]/components/PromotionDetailView.tsx`, `app/admin/promotions/components/PromotionForm.tsx`.
Tests to write first:
- `PromotionForm.test.tsx`: "Giá trị giảm giá" with "Phần trăm" has unit `%`, `150` says "Nhập số không quá 100."; with "Số tiền giảm cố định" unit `đ`, `20000` shows `20,000`; "Đơn tối thiểu" `50000` shows `50,000` and empty sends 0; a per-size box left empty sends the shared value, one typed `12000` sends 12000 (Review Focus 3).

#### Task 4: Đơn hàng (with 8c)

Files: `app/admin/orders/OrderTable.tsx`, `app/admin/orders/[id]/components/OrderDetailView.tsx`, `app/admin/orders/[id]/edit/components/OrderEditForm.tsx`, `app/admin/orders/components/DiscountEditor.tsx`, `app/admin/orders/components/LineItemEditor.tsx`. The list's row "Huỷ" button is removed (Hiện trạng câu 2); `VoidOrderButton` stays on the detail page.
Tests to write first:
- `DiscountEditor.test.tsx` (new) and `LineItemEditor` test: the discount box is a text box; in đ mode `10000` shows `10,000` and reports 10000; in % mode `12.5` reports 12.5 and `120` says "Nhập số không quá 100." (Review Focus 4).
- `OrderTable.test.tsx`: header cells not uppercase; no row has a "Huỷ" button; a row opens `/admin/orders/<id>?returnTo=` carrying the active filter; phone cards render (Review Focus 5).

### Task 5: Money-box todo, docs, gates, review (Opus)

- [ ] Turn the `it.todo` in `components/ui/MoneyInput.test.tsx` into a green test: the price boxes of `ProductForm`, `ModifierForm` and `PromotionForm` group thousands as typed (reuse the Task 1–3 tests' render helpers or assert on their source using `NumberInput` with `unit="đ"`). Regenerate `docs/04-operations/OPEN-ITEMS.md` with `npx vite-node scripts/doc-checks/open-items.ts`.
- [ ] `docs/02-rules/business-rules/screens.md` BR-UI-005 status: Bán hàng moved in K4 on its date. Master plan 1b, 8c and part 5 lines; spec status line.
- [ ] Five gates, build in a throwaway worktree.
- [ ] Whole-wave review by a fresh reviewer on the most capable model with this Review Focus verbatim; one fix pass, each fix red then green.
- [ ] Owner checklist for the push.
