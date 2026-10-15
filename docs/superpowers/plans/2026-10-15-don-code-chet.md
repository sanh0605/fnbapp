# Nền tảng bước 2: xoá code chết

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** xoá code không còn ai gọi; chủ quán không thấy gì đổi.

**Spec:** `docs/superpowers/specs/2026-10-15-nen-tang-de-xuat.md` mục 2 và Kế hoạch A bước 2 (chủ quán chốt thứ tự A 2026-10-15).

**Thiết kế rút gọn:** sửa thứ đã có, không thêm bảng, không thêm trang. Mỗi thứ xoá phải có một lệnh grep trả 0 chỗ dùng ngoài chính nó và test của nó. Test của code bị xoá thì xoá theo, ghi lý do trong commit.

## Global Constraints

- Không đổi chữ, nút, số liệu nào chủ quán nhìn thấy.
- Không migration, không ghi dữ liệu.
- Năm cửa kiểm xanh: `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- Ponytail: chỉ xoá, không viết lại, không gộp lặp (gộp lặp làm trong lúc vẽ lại từng mảng, đề xuất mục 2).

## Hiện trạng

1. **Trạng thái:** không áp dụng, vì bước này không thêm hay đổi trạng thái nào; chỉ xoá code không được gọi.
2. **Nút:** không áp dụng, vì không thêm, bớt hay đổi nút nào chủ quán thấy. `LoadingButton` và hai hộp `FormModal`, `DeleteConfirmModal` không còn màn hình nào dùng (luật không popup `BR-DATA-007`).
3. **Danh sách những gì xoá:** chứa đúng những thứ grep 0 chỗ dùng (đo 2026-10-15, dưới đây). Loại ra: `lib/shared/money-digits.ts` (đề xuất ghi chết, đo lại thì còn 3 nơi dùng: `NumberInput`, hai trang phiếu xuất; chỉ xoá hàm bên trong không ai gọi), `ModalPortal` (còn `Dialog`, `SearchableSelect` dùng), file trong `tests/migrations/` còn canh một bảng hay hàm đang sống.
4. **Ô nhập:** không áp dụng, vì không có ô nhập nào đổi.
5. **Dữ liệu:** không phục vụ dữ liệu nào; không đọc, không ghi máy chủ.

Thêm cho việc này:

6. **Gỡ một thứ thì ai đọc kết quả của nó?** Với hàm: grep cả tên hàm lẫn đường dẫn file; với file test migration: grep tên bảng/hàm nó canh trong `supabase/migrations/` bản mới nhất và trong `information_schema` nếu còn nghi.
7. **Phép kiểm canh tên:** `app/admin/no-popups.test.ts`, `components/ui/DateRangeButton.test.tsx` chỉ nhắc `FormModal` trong chuỗi cấm, không import; giữ nguyên chuỗi cấm (nó vẫn có ích khi ai đó viết lại hộp).

Đã xem: grep tên từng thứ trong `app lib components tests scripts`, `ModalPortal`, số dòng. Chưa xem: từng file trong `tests/migrations/` (Sonnet đo), hàm nào trong `money-digits.ts` không ai gọi (Sonnet đo).

## Đo trước (2026-10-15, nhánh `chore/next-16` sau khi đẩy `6d286c96`)

- 129.503 dòng `*.ts` + `*.tsx` theo `git ls-files`.
- `tests/migrations/`: 65 file, 3.964 dòng.
- Lint: 98 vấn đề (78 lỗi, 20 cảnh báo).

## Phiếu S2 (Sonnet)

- [x] Xoá `components/ui/DeleteConfirmModal.tsx` (51 dòng), `components/ui/FormModal.tsx` (146), `components/ui/LoadingButton.tsx` (45); sửa chú thích nhắc tên chúng nếu chú thích thành sai (`app/admin/no-popups.test.ts:7`, `PurchasedItemForm.test.tsx:95`).
- [x] Xoá `getCashEntries` (`app/admin/finance/actions.ts`; giữ `getCashEntriesThrough` đang dùng) và test của nó; xoá `summariseEntries` (`lib/finance/cash-entry-rules.ts`) nếu ngoài test chỉ còn chú thích nhắc; sửa chú thích `actions.ts:151`.
- [x] Xoá `getPromotionPerformanceV2` (`app/admin/reports/engagement-actions.ts`) và test của nó.
- [x] Trong `lib/shared/money-digits.ts`: xoá hàm export không ai import (kể cả qua `number-edit.ts`), cùng test của hàm đó.
- [x] `tests/migrations/`: mỗi file, ghi một dòng "canh gì — còn sống / đã gỡ ở migration nào". Xoá file canh thứ đã gỡ hẳn. Bảng kết quả để trong báo cáo.
- [x] Năm cửa kiểm; đo lại số dòng và lint; một commit `chore(cleanup): …` kèm số trước/sau.

Kết quả S2 (2026-10-15, `2b0db1ee`): 129.503 → 128.328 dòng (−1.175); `tests/migrations` 65 → 49 file, 3.964 → 3.307 dòng (16 file canh thứ đã gỡ, đối chiếu máy chủ: 0 dòng trên 24 đối tượng đã bỏ); lint 98 → 97; vitest 477 file, 3.697 test xanh. `money-digits.ts` chỉ bỏ `toMoneyDigits`, `toMoneyDigitsUncapped`.

## O3 (Opus)

- [x] Soát diff: mỗi thứ xoá có grep 0; không chữ nào chủ quán thấy bị đổi.
- [ ] Ghi số trước/sau vào kế hoạch chung; hỏi chủ quán duyệt đẩy.
