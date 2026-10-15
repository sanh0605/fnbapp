# C10: một hàm tính tiền cho máy bán và máy chủ, hai khuyến mãi một đơn

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** máy bán và máy chủ ra cùng một con số cho mọi đơn; khuyến mãi cả hoá đơn, đơn tối thiểu, mã, "Dùng chung" được máy chủ tính và kiểm; đơn lệch giá bị từ chối (`BR-SALE-008` đến `BR-SALE-011`).

**Spec:** `docs/superpowers/specs/2026-10-15-tinh-khuyen-mai-design.md` (đọc hết trước khi làm; mục 4 là thiết kế, mục 7 là ví dụ số). Luật: `docs/02-rules/business-rules/sales.md` `BR-SALE-008` đến `-011`.

## Global Constraints

- Bốn bước theo spec mục 6; mỗi lần đẩy và migration chủ quán duyệt riêng, gộp hỏi. Đẩy bước 2 và bước 4 **ngoài giờ mở cửa**: máy bán và máy chủ phải đổi cùng lúc.
- `priceCart` là hàm thuần, không import gì của máy chủ (`server-only`, `@/lib/db`), để máy bán import được.
- Làm tròn `Math.round` trong `priceCart`, không nơi nào khác tự làm tròn.
- Ponytail: không viết thừa code. Năm cửa kiểm xanh. Test viết trước, nêu đỏ vì giá trị sai hay thiếu hàm.
- Mọi phiếu: không commit, không chạy migration, không ghi dữ liệu thật.

## Hiện trạng

Đo 2026-10-15 trên máy chủ và mã nguồn (spec mục 1–2).

1. **Trạng thái.** Khuyến mãi có `ACTIVE`/`INACTIVE` và khoảng ngày; hai khuyến mãi từng có đều đã hết hạn nhưng vẫn `ACTIVE` (không sao: ngày quyết định). Đơn: `COMPLETED`, `SUPERSEDED`, `VOIDED`, không đổi. Mới: ô "Dùng chung" có/không trên từng khuyến mãi, đặt ở form khuyến mãi; mặc định "không".
2. **Nút.** Máy bán: ô mã giữ nguyên; thêm một hàng nút chọn bộ khuyến mãi, **chỉ hiện khi** có hai bộ trở lên không cộng được với nhau. Form khuyến mãi: thêm ô "Dùng chung với khuyến mãi khác"; "Đồng giá" ẩn khi chọn loại "Đơn hàng (Tổng bill)". Không thêm nút nào ở trang đơn.
3. **Danh sách.** Máy bán liệt kê khuyến mãi đủ điều kiện: `ACTIVE`, trong ngày, đúng thương hiệu, giỏ có món nó áp, đạt tối thiểu, có mã thì đã gõ mã. Loại thứ không đủ điều kiện vì máy chủ sẽ từ chối. Trang đơn liệt kê mọi khuyến mãi đã áp (từ bảng `order_promotions`, sau bước 3).
4. **Ô nhập.** Ô mã: chữ, so không phân biệt hoa thường như hôm nay. Giảm tay: như hôm nay. Máy chủ nhận thêm `shown_total` (số nguyên đồng ≥ 0) và `promotion_ids` (mảng mã); lệch thì từ chối "Giá hoặc khuyến mãi đã thay đổi. Tải lại trang rồi bấm lại.". Máy chủ **không còn nhận** `unit_price_snapshot`, `modifier_price_snapshot`, `promo_discount_snapshot` (bỏ khỏi kiểu và khỏi code; gửi lên thì bị lờ).
5. **Phục vụ dữ liệu nào.** Đơn bán từ máy bán (`submitOrderV2`), cả đơn gửi trễ. Khuyến mãi theo món (đồng giá, %, giảm X đ, theo size) và cả hoá đơn (%, giảm X đ). Cố ý không: mua X tặng Y, khung giờ, khách riêng; đơn cũ không bị tính lại (chỉ đối chiếu).

Thêm cho việc này:

6. **Ai đọc thứ bị gỡ/đổi?** `applied_promotion_id`, `applied_promotion_snapshot_json`: `app/admin/orders/actions.ts`, `order-detail-actions.ts`, `order-helpers.ts`, `OrderDetailView.tsx`, `lib/sales/order-edit-transaction.ts`, `lib/db/backup-restore.ts`, `lib/db/tables.ts`, `scripts/verify-revenue-core.ts`, `scripts/restore-order-seller-promo-core.ts`, `scripts/erase-never-sold-deleted.ts`, hàm `create_pos_order_atomic_unvalidated_0025` (0121). Bước 3–4 giữ hai cột (vẫn ghi khuyến mãi đầu tiên) để không ai vỡ; bỏ cột thuộc đợt cấu trúc. Báo cáo chỉ đọc `promo_discount_total` và `promo_discount` của dòng: không đổi, vì khuyến mãi cả đơn được chia vào `promo_discount` từng dòng.
7. **Đơn gửi trễ.** Giá món và tuỳ chọn lấy theo lúc nhận đơn từ `product_price_history`; khuyến mãi lấy như lúc đơn tới (chủ quán chốt 15/10). Đo: 2/1.696 đơn tới trễ quá 1 phút, chậm nhất 12 phút.
8. **Máy bán ngừng nhận đơn?** Có, nếu bước 2 đẩy mà máy bán còn mở trang cũ: trang cũ gửi giỏ kiểu cũ, máy chủ vẫn nhận (chưa bật từ chối ở bước 2). Bước 4 bật từ chối: trang cũ không gửi `shown_total` → máy chủ từ chối mọi đơn cho tới khi tải lại. Vì vậy bước 4 đẩy ngoài giờ và báo chủ quán tải lại máy bán sáng hôm sau.

Ví dụ (spec mục 7): đơn `260714002013`, Trà dâu (dòng `ol-0c1c3c48…`) và Trà xoài (dòng `ol-e2f4dcaa…`), khuyến mãi "202607 - GIẢM 10K": mỗi dòng 27.000 − 10.000 = 17.000, đơn 34.000. Phép đối chiếu bước 1 phải ra đúng bốn số đó.

Đã xem: `lib/sales/order-cart.ts` (toàn bộ phần tính tiền), `POSScreen.tsx` 296–640, cột ba bảng trên máy chủ, số đơn và khuyến mãi, lịch sử giá, độ trễ đồng bộ. Chưa xem: thân đủ của `create_pos_order_atomic_unvalidated_0025`, `CartPanel.tsx` và `ItemConfigModal.tsx` ngoài các dòng tính tiền, trang Đơn lỗi đồng bộ.

## Phiếu S6 (Sonnet) — bước 1 và phần máy chủ của bước 2

**Interfaces — Produces** (`lib/sales/price-cart.ts`):

```ts
export interface PriceCartItem { variant_id: string; qty: number; modifiers: { modifier_id: string; modifier_qty: number }[]; manual_item_discount: { value: number; type: "VND" | "PERCENT" } }
export interface PriceCartCatalog { variants: { id: string; price: number }[]; modifiers: { id: string; price: number }[] }
export interface PricePromotion { id: string; code: string; type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT"; discount_type: "PERCENT" | "FLAT_VND" | "FLAT_PRICE"; discount_value: number; applicable_products_json: string; min_order_value: number; stackable: boolean }
export interface PricedLine { gross: number; promo: number; manualItem: number; orderPromo: number; orderManual: number; net: number }
export interface PriceCartResult { lines: PricedLine[]; applied: { promotionId: string; amount: number }[]; total: number }
export function priceCart(items: PriceCartItem[], catalog: PriceCartCatalog, promotions: PricePromotion[], manualOrderDiscount: { value: number; type: "VND" | "PERCENT" } | null): PriceCartResult;
// promotions = the set to apply, already chosen and checked for eligibility (dates, brand, code) by the caller.
// orderPromo is booked into the line's promo_discount by the caller (spec 4.1 step 5); kept apart here so the replay can compare.
export function eligiblePromotionSets(...): ... // bước 4, chưa làm ở phiếu này
```

`stackable` chưa có cột ở bước 1–2: người gọi truyền `false`.

- [ ] Test trước `lib/sales/price-cart.test.ts`, đỏ vì thiếu hàm. Mỗi luật một test, số lấy từ luật:
  - `BR-SALE-009`: Bạc xỉu 29.000 + Cà phê sữa 25.000, giảm tay 4.000 Bạc xỉu, giảm tay 10% cả đơn → tổng 45.000;
  - `BR-SALE-010`: đơn 100.000, khuyến mãi cả đơn 10%, giảm tay cả đơn 5.000 → 85.000;
  - `BR-SALE-011` tối thiểu: Bạc xỉu ×4 = 116.000, khuyến mãi món giảm 5.000/ly, khuyến mãi cả đơn tối thiểu 100.000 → khuyến mãi cả đơn không áp, tổng 96.000;
  - đồng giá giữ giá tuỳ chọn: Trà dâu 27.000 + Trân châu trắng 5.000, đồng giá 15.000 → dòng 20.000;
  - % theo size dùng giá trị theo size, không dùng giá trị chung;
  - ví dụ hai khuyến mãi spec mục 7 → 26.010, hai dòng 13.005, khuyến mãi 20.000 và 5.100.
- [ ] Viết `priceCart` đúng spec mục 4.1. Dùng lại `allocateOrderDiscount` (`lib/sales/order-math.ts`).
- [ ] Script `scripts/verify-price-cart.ts` + lõi `scripts/verify-price-cart-core.ts` (cùng kiểu `verify-revenue`), chỉ đọc: chạy `priceCart` trên mọi đơn (mọi trạng thái), dữ liệu lấy từ chính đơn (giá dòng, tuỳ chọn trong `modifiers_snapshot_json`, số lượng, giảm tay dòng tính bằng đồng từ `manual_item_discount`, giảm tay cả đơn bằng đồng từ `manual_order_discount`, khuyến mãi từ `applied_promotion_snapshot_json`). So `promo_discount`, `manual_item_discount`, `order_discount_allocation`, `net_line_total` từng dòng. In "N lệch trên M dòng (K đơn)" và mã đơn từng lệch. Mong đợi: chỉ `260618001003` lệch. Test lõi với hai đơn giả (một khớp, một lệch).
- [ ] Chạy script (chỉ đọc, được chạy) và dán kết quả vào báo cáo. Lệch ngoài `260618001003`: dừng, báo Opus, không sửa hàm cho khớp mù.
- [ ] `buildOrderFromCart` gọi `priceCart` thay cho `computePromoForLine`, `estimatePromoDiscount`, `computeOrderDiscountVnd` và đoạn chia; gỡ các hàm cũ. Khuyến mãi cả đơn được tính (hết lỗ hổng 1). Máy chủ kiểm tối thiểu và mã: `resolvePromotion` chỉ nhận khuyến mãi gửi kèm `promo_code` khớp nếu có mã; không còn tự chọn "lớn nhất" cho khuyến mãi có mã. Giữ một khuyến mãi một đơn.
- [ ] Bỏ `unit_price_snapshot`, `modifier_price_snapshot`, `promo_discount_snapshot` khỏi `CartItemInput`, `order-snapshot.ts` và chỗ đọc. Test: gửi `unit_price_snapshot: 1` vẫn ra giá danh mục.
- [ ] Test `app/pos/actions.test.ts`: đổi `it.todo` của `BR-SALE-009` và `BR-SALE-010` thành test xanh (máy chủ ra đúng số máy bán hiện). Các `it.todo` khác để bước 4.
- [ ] `npx tsc --noEmit`, `npx vitest run`. Báo danh sách file, test, kết quả đối chiếu.

**Kết quả S6 (2026-10-15, chưa commit):** đối chiếu chỉ đọc `scripts/verify-price-cart.ts`: **0 lệch trên 4.870 dòng (3.507 đơn)**. `260618001003` không lệch: cột `applied_promotion_id` trống nhưng bản chụp giữ `PRM-003`. 296 đơn chuyển từ hệ cũ không có bản chụp khuyến mãi: đối chiếu lấy khuyến mãi hiện tại (`PRM-003`/`PRM-004`). Máy chủ đã đổi sang `priceCart`. Quyết định của Sonnet, Opus giữ:
- tối thiểu kiểm trong `priceCart`;
- giá trị theo size bằng 0 thì lấy giá trị chung, như cũ;
- khuyến mãi không giảm đồng nào thì `applied_promotion_id` để trống;
- "%" cả đơn tính sau giảm món (test cũ 3.500 → 2.500).

Hôm nay chỉ có hai khuyến mãi, cả hai hết hạn, không có mã (đo 2026-10-15): đổi này chưa chạm đơn nào. Không đẩy S6 một mình: máy bán bỏ gửi mã thì máy chủ bỏ khuyến mãi có mã; đẩy cùng G6.

## Phiếu G6 (Gemini) — phần máy bán của bước 2

Chạy sau S6 (cần `priceCart`).

- [ ] `POSScreen.tsx`, `CartPanel.tsx`, `ItemConfigModal.tsx`: mọi con số tiền (giá khuyến mãi trên thẻ món, giảm từng dòng, tổng) lấy từ `priceCart`; xoá các bản tính riêng (`calcPromoDiscount`, `itemPromoDiscounts`, `calculateTotalAmount` hai nơi, đoạn 81–94 của hộp chọn món). Giảm tay cả đơn **cộng** với khuyến mãi cả đơn, không thay thế (`BR-SALE-010`).
- [ ] Chọn khuyến mãi giữ như hôm nay (một khuyến mãi; có mã thì theo mã, không thì cái giảm nhiều nhất), nhưng tối thiểu so với tổng sau giảm món (`BR-SALE-011`). Khi áp khuyến mãi có mã, gửi thêm `promo_code` cùng `applied_promotion_id` (máy chủ sau S6 đòi mã khớp).
- [ ] Không đổi bố cục. Test giao diện hiện có xanh; thêm test: giỏ ví dụ `BR-SALE-010` hiện 85.000.

## Phiếu S7 (Sonnet) — bước 3 và phần máy chủ của bước 4

- [ ] Migration `supabase/migrations/NNNN_order_promotions.sql` (NNNN = số trống kế tiếp lúc viết; Thu chi cũng lấy số sau `0125`): bảng `order_promotions` đúng spec 4.3 (khoá ngoại `RESTRICT`, unique `(order_id, promotion_id)`, bật RLS và thu quyền như các bảng đơn — chép từ migration tạo `order_payments`); `promotions.stackable boolean not null default false`; điền lại 831 đơn từ `applied_promotion_id` (`insert … where not exists`, chạy lại vô hại); hàm ghi đơn ghi thêm `order_promotions` từ `p_order->'promotions'`, không có thì từ `applied_promotion_id` (cầu tạm). Test chữ migration trong `tests/migrations/`.
- [ ] `eligiblePromotionSets(promotions, items, catalog, at, brandId, code)` trong `price-cart.ts`: trả các bộ hợp lệ (spec 4.2) kèm số tiền, xếp giảm nhiều nhất trước. Test: hai khuyến mãi cùng "Dùng chung" → một bộ hai cái; một bên không → hai bộ; khuyến mãi có mã không vào khi chưa gõ mã.
- [ ] `submitOrderV2` nhận `promotion_ids`, `promo_code`, `shown_total`; từ chối theo spec 4.2 ba trường hợp, câu "Giá hoặc khuyến mãi đã thay đổi. Tải lại trang rồi bấm lại."; giá đơn trễ theo `product_price_history`. Ghi `order_promotions` qua `p_order.promotions`. `assertOrderInvariants` thêm: tổng `amount` = `promo_discount_total`.
- [ ] Đổi bốn `it.todo` còn lại của `app/pos/actions.test.ts` thành test xanh.
- [ ] Form khuyến mãi (máy chủ): `stackable` đọc/ghi; từ chối "Đồng giá" với loại cả hoá đơn.
- [ ] Trang đơn đọc `order_promotions` (hàm đọc ở `order-detail-actions.ts`).

## Phiếu G7 (Gemini) — giao diện bước 4

- [ ] Máy bán: tóm tắt giỏ liệt kê từng khuyến mãi đã áp với số tiền; có từ hai bộ trở lên thì một hàng nút, mỗi nút "tên: −số tiền", bộ đầu được chọn sẵn; gửi `promotion_ids`, `promo_code`, `shown_total`. Lỗi từ chối hiện đúng câu máy chủ trả.
- [ ] Form và trang chi tiết khuyến mãi: ô "Dùng chung với khuyến mãi khác" (có/không); ẩn "Đồng giá" khi loại là cả hoá đơn.
- [ ] Trang đơn: mỗi khuyến mãi một dòng.
- [ ] Máy tính và điện thoại; test giao diện đi kèm.

## O6 (Opus)

- [ ] Sau S6: soát (tìm cả chỗ thừa), đọc kết quả đối chiếu; sau G6: xem máy bán trên 8386 bằng mắt (không bấm thanh toán), tắt máy chủ; năm cửa kiểm; commit; ghi `BR-SALE-009`, `-010` "Built"; gộp hỏi đẩy bước 2 (ngoài giờ).
- [ ] Sau S7, G7: soát; năm cửa kiểm; commit; ghi `BR-SALE-008`, `-011` "Built"; gộp hỏi: migration `order_promotions` → đẩy bước 4 (ngoài giờ) → nhắc tải lại máy bán.
