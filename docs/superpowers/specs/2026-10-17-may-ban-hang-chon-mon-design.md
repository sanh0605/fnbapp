# Máy bán hàng: chọn đủ món rồi mới vào giỏ — thiết kế

Ngày 2026-10-17. Người viết: Opus (phiên chính). Luật gốc: `BR-SALE-019`, `BR-SALE-020` trong `docs/02-rules/business-rules/till.md`.

The owner approved two mockups on 2026-10-17 (*"Đúng, làm theo hai bản này"*). Both are on the design canvas at https://claude.ai/artifact/DEbZg7kdYiKDwc2rvWKaNW:
- board BF is the computer layout;
- board PF is the phone layout;
- board B2 is the payment step.

On 2026-10-17 the owner also said to keep working and to take the recommendation on open points. He reviews every self-decided point at the end (section 9).

## 1. Hiện trạng (code đo 2026-10-17)

Đã xem: `app/pos/components/POSScreen.tsx`, `ItemConfigModal.tsx`, `CartPanel.tsx` (vùng thanh toán, thanh dưới điện thoại), `cart-pricing.ts`, `components/ui/OptionGroupPicker.tsx`, `lib/sales/option-groups.ts`, `lib/reports/report-v2-allocators.ts`, `app/admin/reports/sales-actions.ts:180-232`, `lib/sales/order-math.ts:95-125`. Bản dò của Haiku về mọi chỗ đọc `modifiers_snapshot_json`, Opus kiểm lại ba chỗ chính.
Chưa xem: `ProductGrid.tsx`, `ProductCard.tsx`, `CartItemRow.tsx`, phần giữa của `CartPanel.tsx` (khuyến mãi, giảm giá đơn), `DraftsModal.tsx`; các trang đơn hàng quản trị chỉ xem qua bản dò.

1. **States.**
   - Today a dish card has two parts. Tapping a size button puts one cup straight into the cart (`addQuickLine`). Tapping the name opens a popup (`ItemConfigModal`).
   - The cart then has one of four states: empty, has lines, sending (`isCheckingOut`), or send failed (`lastCheckoutError`, "Gửi lại").
2. **Buttons.**
   - The cart has three pay controls: TIỀN MẶT sends at once, CHUYỂN KHOẢN sends at once, and "Nhiều hình thức" opens the split popup. All three are hidden or disabled when the till is offline or the cart is empty.
   - Pressing Enter asks "Xác nhận thanh toán TIỀN MẶT…" and then sends as cash.
3. **Lists.**
   - The dish grid shows the dishes of the chosen category or of "Bán chạy".
   - The cart shows every line, with its options under the dish name.
   - In option groups, the default choice is never stored (`pickOne`): a line with "Bình thường" sweetness carries no sweetness at all.
4. **Inputs.**
   - The per-dish "Chiết khấu" field is always open in the popup. It is a `type="number"` box, so it shows spinner arrows, and its placeholder reads "Ví dụ: 2".
   - The order discount box is in the cart.
5. **Data.**
   - In option groups (Nhóm lựa chọn) there is only "Thêm Topping": 9 toppings, all priced 3.000–10.000đ, linked to 35 drinks.
   - Of the 4.960 order lines, 328 carry an option.
   - Out of scope: Độ ngọt and Đá do not exist yet (section 6).

Thêm câu riêng cho việc này:

6. **Same choices made in a different order.** Example: Kem muối then Caramel, versus Caramel then Kem muối. These are the same line. The comparison ignores the order of choices.
7. **A dish with nothing to choose** (Trứng luộc, Khoai lang: one size, no groups). See section 3.
8. **Editing a line from the cart** until it equals another line. See section 4.

## 2. Luồng bán (cả hai thiết bị)

1. Chạm tên món. Không có gì vào giỏ.
2. Khung chọn mở ra:
   - nhóm **1 Cỡ ly** (size rẻ nhất sáng sẵn); món thuộc loại không phải đồ uống thì nhóm này tên **Cỡ** (2026-10-18, sửa sau đợt soát 4);
   - rồi từng nhóm lựa chọn gắn với món, theo thứ tự của nhóm (lựa chọn mặc định sáng sẵn).
3. Chọn số lượng (bắt đầu 1), bấm **Thêm vào đơn · <tiền>**. Tiền là tổng của dòng sau khuyến mãi, như ô THÊM hôm nay.
4. Khung đóng lại; giỏ hiện dòng mới hoặc dòng gộp.

Chạm món khác khi khung đang mở: khung đổi sang món đó, lựa chọn trở về mặc định. Bấm **Bỏ** (máy tính), ✕ hoặc vùng tối (điện thoại), hoặc Esc: đóng khung, giỏ không đổi.

## 3. Món không có gì để chọn

Every dish takes the same path, Trứng luộc and Khoai lang included (one size, no group). The window opens showing only the size group, already lit, plus the quantity. The cashier sets the quantity and taps Thêm.

Why: step 3 of the owner's flow is choosing the quantity, and one path means no special case in the code. Cost: an egg takes two taps instead of one. This is self-decided (section 9, point 1).

## 4. Gộp dòng giống hệt

Hai dòng **giống hệt** khi trùng cả bốn thứ:
1. cùng size (`variant_id`);
2. cùng giá ly (a draft restored with an old price does not merge into a line at today's price);
3. cùng bộ lựa chọn, không kể thứ tự chọn (so theo danh sách mã đã sắp xếp, tính cả số phần);
4. cả hai dòng đều không có giảm giá món.

**A line with an item discount never merges.** A VND item discount is an amount for the whole line, not per cup (`lib/sales/price-cart.ts:105`). Two cups on two lines with 2.000đ off each come to 4.000đ off. Merged into one line of 2 cups they would come to 2.000đ off. Keeping them apart keeps the money right. This is self-decided (section 9, point 6).

- **Thêm mới:** if an identical line exists, its quantity increases. Otherwise a new line goes to the end of the cart.
- **Sửa một dòng** (chạm dòng trong giỏ → khung mở với lựa chọn của dòng đó, nút đổi thành **Cập nhật**): the line is replaced where it stands and is not merged, even if it now equals another line. Why: the line the cashier is editing would vanish from under their finger. This is self-decided (section 9, point 2).
- Lựa chọn trên dòng giỏ được xếp theo thứ tự nhóm rồi thứ tự lựa chọn trong nhóm, không theo thứ tự bấm: "360ml · Ít ngọt · Ít đá · Kem muối". The sort happens once, when Thêm or Cập nhật is tapped: the window knows the groups, while a stored choice does not know which group it came from. The cart, the draft and the stored order line keep the sorted order.

Ví dụ số thật (giá ngày 2026-10-17):
- Cà phê đá 360ml 15.000đ, Kem muối 4.000đ.
- Thêm 2 ly "360ml · Ít ngọt · Ít đá · Kem muối" gives one line of 2 × 19.000 = 38.000đ.
- Thêm 1 ly "360ml · Không đường · Ít đá · Kem muối" gives a second line of 19.000đ.
- Thêm 1 ly giống dòng đầu: dòng đầu thành 3 × 19.000 = 57.000đ, giỏ vẫn 2 dòng.

## 5. Bố cục

**Máy tính và máy tính bảng, từ 768 px trở lên (bản BF):**
- Từ 1024 px: ba cột.
  - Cột trái: nhóm món, rộng 132 px.
  - Cột giữa: lưới món 3 cột. Thẻ cao 90 px, tên 18 px, giá 17 px; món đang chọn có viền đậm.
  - Cột phải: giỏ, rộng 380 px.
- Từ 768 đến 1023 px (máy tính bảng):
  - Không có cột nhóm món. Nhóm món là hàng thẻ ngang trên lưới, như hôm nay.
  - Giỏ rộng 320 px.
  - Cột giữa còn khoảng 448 px.
- Khung chọn nằm **trong cột giữa, dưới lưới món**, không phải cửa sổ nổi. Lưới món phía trên vẫn cuộn được.
- Các nhóm nằm cạnh nhau. Cột tự xuống hàng khi hẹp, mỗi cột tối thiểu 170 px:
  - 1280 px: 4 cột;
  - 1024 px: 2 cột;
  - 768 px: 2 cột.
- Mỗi nhóm là một khung riêng:
  - đầu khung có dải màu nền và vòng tròn số thứ tự (1, 2, 3, 4);
  - mỗi lựa chọn một hàng cao 46 px, chữ 16 px;
  - nhóm chọn một dùng nút tròn, nhóm chọn nhiều dùng ô vuông;
  - nhóm dài thì cuộn trong khung.
- Chân khung: bộ đếm số lượng (52 px), Bỏ, "Thêm vào đơn · 38,000".
- Giỏ:
  - mỗi dòng có ô số lượng, tên 17 px, dòng lựa chọn 15 px và tiền;
  - tổng 26 px;
  - một nút **Thanh toán** cao 64 px.

**Điện thoại, dưới 768 px (bản PF):**
- Danh sách món: dòng cao 64 px, tên 18 px.
- Thanh dưới: "<số món> · <tổng> · Thanh toán ›".
- Chạm món: tấm chọn trượt từ đáy, cao tới gần đỉnh màn hình.
  - Mỗi nhóm là một thẻ, có dải đầu thẻ, vòng tròn số và "✓ <đang chọn>" ở bên phải.
  - Mỗi lựa chọn một hàng: cao 54 px, chữ 18 px, nút tròn hoặc ô vuông 26 px, chạm cả hàng để chọn.
  - Chân tấm: bộ đếm 60 px và "Thêm vào đơn · 38,000".

**Cả hai:**
- **Giảm giá món** không còn mở sẵn. Nó là một dòng gập "Giảm giá món" ở chân khung, bấm mới mở ra.
- Ô nhập ở đó là ô số không có mũi tên tăng giảm (`inputMode="numeric"`), gợi ý "Ví dụ: 2" (luật `BR-UI-009`: ô trống chỉ hiện ví dụ).
- Size xếp từ rẻ đến đắt.

## 6. Thanh toán (bản B2, `BR-SALE-020`)

- Giỏ có một nút **Thanh toán**. Bấm vào thì cột giỏ (máy tính) hoặc tấm giỏ (điện thoại) chuyển sang bước "Khách trả bằng gì?".
- Bước đó có bốn nút:
  - **Tiền mặt** (nút đậm): gửi đơn ngay;
  - **Chuyển khoản**: gửi đơn ngay;
  - **Chia tiền mặt + chuyển khoản**: mở khung chia tiền đang có;
  - **‹ Quay lại đơn**.
- **Enter** (bàn phím máy tính) làm đúng việc của nút Thanh toán: mở bước chọn cách trả. When the step opens, the cursor is on Tiền mặt, so a second Enter pays cash. A cash sale from the keyboard is Enter, Enter. The "Xác nhận thanh toán TIỀN MẶT" box is gone. This is self-decided (section 9, point 3).
- On the phone, the bottom bar "Thanh toán ›" opens the cart sheet at the order view, so the cashier sees the lines. The Thanh toán button in the sheet then goes to the method step.
- Offline, the cart empty, or an order sending: Thanh toán is disabled, as the pay buttons are today. The "Gửi lại" message still shows when a send fails.
- The step closes and the cart goes back to the order view when sending starts (the cart empties at once, as today, and the existing "Đang gửi…" panel shows), when the cart is cleared, or when the cart changes in any other way (a dish added, a draft loaded). If the send fails, the cart comes back in the order view with "Gửi lại", as today.

## 7. Độ ngọt và Đá: dữ liệu, chưa ghi

These are written by a script that does a dry run by default and writes only with `--apply`, after the owner approves the printed list.
- One SQL transaction writes all three tables (group, options, dish links), so either everything is written or nothing is. A dry run runs the same SQL and ends with `rollback`.
- IDs follow the existing pattern: groups MG-002 and MG-003, options from MOD-011 up. MOD-007 is never reused.
- Thêm Topping keeps its sort order of 50. Độ ngọt gets 10 and Đá gets 20, so no existing row changes.
- The three tables carry only `updated_at` triggers (checked 2026-10-17).
- Nhóm **Độ ngọt** (chọn một): Bình thường (mặc định), Ít ngọt, Không đường.
- Nhóm **Đá** (chọn một): Bình thường (mặc định), Ít đá, Không đá, Đá riêng.
- Giá 0đ. Thứ tự: Độ ngọt, Đá, rồi Thêm Topping.
- Gắn với 35 món đang gắn Thêm Topping:
  - Cà phê 8, kể cả món tên "Test11";
  - Giải trí 13;
  - Trà 10;
  - Yogurt 4.
- Mặc định không được lưu vào dòng đơn (`pickOne` hiện có). Vì vậy dòng giỏ, hoá đơn và trang đơn chỉ hiện chỗ khác mặc định, như "Ít ngọt · Ít đá", không bao giờ hiện "Bình thường · Bình thường".
- The till works the same whether or not these two groups exist yet: it shows whichever groups the dish is linked to.

## 8. Ảnh hưởng chéo đã kiểm

- **Báo cáo "Topping bán chạy"** (`app/admin/reports/sales-actions.ts:186-205`) and the **Lãi lỗ topping rows** (`app/admin/reports/pnl-actions.ts`):
  - Both read every stored option, through `breakdownRevenueByProduct` (`lib/reports/report-v2-allocators.ts:55-70`). Neither filters by group or by price.
  - "Ít đá" would then show up as a topping with a count and 0đ.
  - Fix: `breakdownRevenueByProduct` skips options priced 0đ.
  - Revenue does not change, because a 0đ option carries no revenue share (`lib/sales/order-math.ts:103-119`).
  - Limit: a free topping, if the owner ever creates one, would not appear in the topping chart. No such topping exists today: all 9 toppings cost 3.000–10.000đ.
  - Example: line `ol-migrated-f1af7463-6986-4c86-a6f3-7ef07fa7f3a4` is Cà phê đá 500ml at 21.000đ plus 20ml cốt cà phê at 3.000đ = 24.000đ. If it also carried "Ít đá" 0đ, revenue would stay 24.000đ and the topping chart would still show only 20ml cốt cà phê.
- **Đơn hàng quản trị** (danh sách, chi tiết, huỷ, sửa) hiện thêm "Ít ngọt, Ít đá". Đó là điều muốn có, không sửa.
- **Cờ "đã bán"** (`find_sold_modifier_ids`): Ít ngọt, Ít đá… thành "đã bán" sau đơn đầu tiên, nên không xoá hẳn được, chỉ ngừng dùng. Đúng luật dữ liệu.
- **Giá vốn, tồn kho:** không đọc lựa chọn (máy bán hàng không trừ kho, `app/pos/CLAUDE.md`).
- **Đơn nháp:** lưu nguyên dòng giỏ. Nháp cũ mở ra vẫn đúng vì dòng giỏ không đổi dạng.

## 9. Điểm tự quyết, chủ quán duyệt cuối đợt

1. Món không có gì để chọn (Trứng luộc, Khoai lang) cũng mở khung để chọn số lượng: hai chạm thay vì một (mục 3).
2. Sửa một dòng không tự gộp với dòng khác (mục 4).
3. Enter mở bước chọn cách trả; Enter lần nữa là tiền mặt; bỏ hộp hỏi tiền mặt (mục 6). Giữ phím Enter không gửi đơn: chỉ lần nhấn đầu được tính.
4. Giảm giá món gập lại; ô nhập gợi ý "Ví dụ: 2" theo luật `BR-UI-009` (mục 5).
5. Báo cáo topping bỏ qua lựa chọn 0đ (mục 8).
6. Dòng có giảm giá món không bao giờ gộp (mục 4).
7. Đang sửa một dòng mà dòng đó bị xoá khỏi giỏ: khung chọn tự đóng, giỏ không đổi.
8. Đang ở bước chọn cách trả mà giỏ thay đổi (thêm món, nạp nháp): quay về màn đơn.
9. Số lượng một lần thêm: từ 1 đến 99; sửa một dòng đã gộp quá 99 thì giữ nguyên số đó.
10. Topping: chạm một dòng topping đã chọn là thêm một phần nữa (hiện "×2"), nút "−" bớt một phần. Cả 9 topping hiện không giới hạn số phần (đo 2026-10-17).
11. Nút chia tiền ghi "Chia tiền mặt + chuyển khoản"; dòng báo lỗi dùng cùng chữ đó thay cho "Nhiều hình thức".
12. Cần chủ quán chốt khi duyệt dữ liệu: Yogurt và nhóm Giải trí (cacao, matcha, sữa dâu) có cần Độ ngọt và Đá không; món "Test11" có gắn không.

## 10. Phân việc

- **Backend (Sonnet, `backend-coder`):**
  - hàm so dòng giống hệt và gộp dòng, thay `addQuickLine` trong `app/pos/components/cart-pricing.ts`;
  - bỏ lựa chọn 0đ trong `lib/reports/report-v2-allocators.ts`;
  - script tạo hai nhóm (chạy thử mặc định).
- **Giao diện (Gemini qua `agy`, Argon vì làm lại cả trang):**
  - cột nhóm món;
  - lưới món mới;
  - khung chọn trong cột giữa và tấm chọn từ đáy (thay `ItemConfigModal`, viết lại `OptionGroupPicker` thành hàng);
  - giỏ với một nút Thanh toán và bước chọn cách trả;
  - phím Enter.
- **Test phải đổi:** test của nút size một chạm (`ProductCard`, `ProductGrid`, `POSScreen`), test hai nút trả tiền (`CartPanel`, `POSScreen.checkoutToast`, `POSScreen.offline`), test phím Enter (`POSScreen.test.tsx`), test `addQuickLine`.
- **Tài liệu:**
  - `docs/superpowers/specs/2026-10-14-nhom-tuy-chon-design.md:49` ("one tap") ghi lại theo `BR-SALE-019`;
  - kế hoạch cũ của lần làm lại máy bán hàng (bản A) đã xoá khi kế hoạch này xong; `notices.md` nay trích luật `BR-UI-020`.
