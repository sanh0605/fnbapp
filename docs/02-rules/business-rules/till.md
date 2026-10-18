# Till

How a cashier rings a dish and takes payment at the till (`/pos`). The order and payment rules behind it are in `docs/02-rules/business-rules/sales.md`.

### BR-SALE-019 — A dish is chosen in full before it goes into the cart

**Status:** `APPROVED` — owner 2026-10-17, after trying the till redo that put a dish into the cart on one tap of a size: *"Logic phải là 1. Chạm vào Cà phê đá 2. Chọn size, độ ngọt, đá và toppings 3. Chọn số lượng rồi thêm vào giỏ"*. Reverses the one-tap size buttons of the 2026-10-17 redo (mockup A), which were pushed the same day. Pushed 2026-10-18 (`d2778cb0`).

- Tapping a dish opens its choices. Nothing goes into the cart until the cashier taps Thêm.
- **Exception, owner 2026-10-18:** a dish with one size and no option to choose goes into the cart on one tap, quantity 1, with no window. Tapping its cart line opens the window to change the quantity or give a dish discount. A dish with any choice to make still opens its window first. Asked on the live till: tapping Trứng luộc 5,000 opened a window showing only "Cỡ: 1 trái", and the egg reached the bill only after a second tap on "Thêm vào đơn · 5,000"; the owner chose *"Theo em khuyến nghị"* (one tap). Built 2026-10-18 (`openProductModal` in `app/pos/components/POSScreen.tsx`; tests in `app/pos/components/POSScreen.test.tsx`, "Task 3a"), not pushed yet.
- The cashier picks the size, then every option group linked to the dish (sweetness, ice, toppings, …), then the quantity, then taps Thêm.
- Two adds of the same dish and size with any option different give two cart lines. Owner: *"Nếu anh chọn cà phê đá cùng size nhưng khác nhau các lựa chọn trước khi thêm vào giỏ thì trong giỏ phải hiện ra 2 dòng"*.
- Two adds with every choice the same give one line with the quantities added. Owner chose *"Gộp 1 dòng, số lượng 2"* on 2026-10-17.
- Example: 2 × Cà phê đá 360ml · Ít ngọt · Ít đá · Kem muối, then 1 × Cà phê đá 360ml · Không đường · Ít đá · Kem muối, is two lines. Adding one more of the first makes that line 3 ×.
- Sweetness (Độ ngọt) and ice (Đá) are option groups the owner edits in Nhóm tuỳ chọn, not fixed in code. On 2026-10-17 only "Thêm Topping" exists; the owner chose *"Em tạo sẵn, anh duyệt"*: the two groups are written only after the owner approves the list. Written 2026-10-18 right after the push, with the owner's approval (*"Duyệt, đủ 35 món"*): Độ ngọt with 3 options and Đá with 4, each on the 35 dishes that carry Thêm topping (spelled Thêm Topping until 2026-10-18).

**How the choices look (owner 2026-10-17, after comparing four phone mockups and two layouts):**
- Phone: the choices slide up from the bottom over the dish list (mockup "Điện thoại 1"). Each option is its own row, chosen by tapping the whole row. Owner chose *"Tấm chọn từ đáy nhưng các lựa chọn nên xếp các lựa chọn thành mỗi hàng 1 lựa chọn"*, then kiểu A over one row per group.
- Each group (cỡ ly, độ ngọt, đá, topping) is set apart clearly enough that the cashier sees at once that the next rows belong to another group. Owner: *"cần dễ phân biệt hơn khi chọn nhóm khác vì khi sang nhóm khác thì người dùng biết ngay"*.
- The till's text is larger than in the mockups of 2026-10-17, on the computer and on the phone. Owner: *"kích cỡ chữ vẫn còn nhỏ trên màn hình máy tính lẫn điện thoại"*.

### BR-SALE-020 — One Thanh toán button, then the payment method

**Status:** `APPROVED` — owner 2026-10-17, chose mockup B for the computer till and *"Theo đúng B, một nút"* over keeping the two pay buttons. Changes `BR-SALE-018`: TIỀN MẶT no longer sends from the cart in one tap. Pushed 2026-10-18 (`d2778cb0`).

- The cart has one Thanh toán button. It opens the step where the cashier picks tiền mặt or chuyển khoản.
- Picking tiền mặt in that step sends the order; no amount handed over is asked and no change is shown (`BR-SALE-018` keeps that part).
- Cost accepted by the owner: every cash order takes one more tap than before.
