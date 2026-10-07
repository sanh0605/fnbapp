# Screen rules: one look across the whole system

Owner decisions on how screens look and read. Earlier display rules stay where they were first written: dates `BR-DATA-006`, no popups `BR-DATA-007`, sorting `BR-DATA-008` (`docs/02-rules/business-rules/data-integrity.md`). Every page change also ships its computer and phone layouts (`.claude/rules/ui-devices.md`).

Source of every rule below: the owner's notes typed with the preview's "Góp ý" tool and in chat on 2026-10-06, while checking Phiếu nhập and Phiếu xuất. The work is ordered in `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`.

### BR-UI-001 — Every word on screen is Vietnamese

**Status:** `APPROVED` — owner 2026-10-06: *"100% hệ thống phải sử dụng tiếng Việt. Không hiện theo kiểu 'Tiếng Việt (Tiếng Anh)' hoặc tương đồng như thế."*

- No label carries an English twin in brackets: "Lưu nháp", not "Lưu Nháp (Draft)"; "Quản lý", not "Quản lý (MANAGER)". Counted 2026-10-06: 25 such labels in 12 files, removed in wave 8a-2. A full read of every screen for other English words is part of the uniform-look pass.
- Loanwords the owner uses himself stay: Topping, Voucher.
- Stored values (`STAFF`, `RAW`, `COMPLETED`) are not shown; the screen shows their Vietnamese name.

### BR-UI-002 — A button that creates a new record reads "Tạo"

**Status:** `APPROVED` — owner 2026-10-06: *"Các nút tạo phiếu hay tạo thêm dữ liệu mới đều chỉ hiện là 'Tạo'"*, typed on the Phiếu nhập list. Applied to every list page in wave 8a-2.

- The list's title already says what is created, so "Tạo phiếu nhập" next to the title "Phiếu nhập" repeats it.

### BR-UI-003 — List rows all look the same

**Status:** `APPROVED` — owner 2026-10-06: *"Đối với các trang danh sách, các dòng đều viết thường và có cùng một format, không tự ý viết bold hay bất kỳ một kiểu đặc biệt nào hết. Nếu có phát sinh thêm anh sẽ cung cấp thông tin về quyết định mới nhất của anh sau."* Not built yet; part of the uniform-look pass.

- Every cell in a list row uses the same weight and size; no bold code, no bold amount, no coloured text beyond the status badge. Exceptions only when the owner names one.

### BR-UI-004 — A column that can be added up shows its total under the header

**Status:** `APPROVED` — owner 2026-10-06: *"Các cột có thể thống kê thì nên hiện một dòng số nhỏ bên dưới tiêu đề cột tương ứng cho thấy tổng của tất cả dòng theo bộ lọc."* Not built yet; needs its own short design (which columns count as summable, phone layout).

- The total covers every row the current filter matches, not only the page on screen. Rounding follows `BR-DATA-005`: the rounded exact total.

### BR-UI-005 — One template per screen part

**Status:** `APPROVED` — owner 2026-10-06, on an issue slip's page: *"Đồng nhất tất cả các nút về cùng một kiểu… audit lại tất cả các điểm có thể đồng nhất… nên có một khung mẫu cho từng thành phần."* Not built yet.

- Buttons, inputs, number inputs, tables, money boxes, page headers and back links each have one shared component in `components/ui/`; a page does not style its own button.
- **Number inputs** (owner 2026-10-06, in chat): audit every one; the quantity box on the issue-slip create page is the model he likes (numeric keypad on a phone, decimals allowed, typed text kept, the converted amount shown beside it). It used a comma for decimals then; `BR-UI-008` makes that a dot.
- **The six templates are approved** — owner 2026-10-07, *"Đồng ý"*, after seeing a sample page with each template next to the styles in use today. Design: `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md`. In short:
  - Buttons: one brown main button per screen. Delete buttons have a red outline; the final confirm step is solid red.
  - Number boxes: the box adds the thousands marks itself, no up/down arrows, the mouse wheel never changes the number, and a mistake shows in red under the box. Which mark is which: `BR-UI-008`.
  - Table headers are plain grey text, not capitals. Every row cell has the same weight.
  - Totals boxes are white with a thin border.
- **Money boxes everywhere now, not after the financial reports** — owner 2026-10-07, *"Đúng"*, replacing the 2026-09-11 order that put the remaining money boxes after the financial reports.
- **The POS keeps its own look:** it is used by touch.

### BR-UI-006 — Words that are too long get a short form the owner keeps

**Status:** `APPROVED` direction — owner 2026-10-06: *"Cần bổ sung thêm danh sách viết ngắn gọn của các cụm từ dài. Ví dụ 'Hình thức thanh toán' là 'HTTT'… cần có nơi để anh có thể tự do thêm/sửa/xoá thay vì hardcode."* Not built yet; a new table and screen, so it gets the full four steps.

### BR-UI-007 — Date filters work like Looker Studio's

**Status:** `APPROVED` direction — owner 2026-10-06: *"Các bộ lọc thời gian hiện tại chưa đồng nhất. Anh muốn bộ lọc phải có cách lọc như của Looker hoặc Data Studio."* Not built yet; needs a design shown to the owner first. Whole days only, as `BR-DATA-006` already says.

### BR-UI-008 — A comma separates thousands, a dot marks decimals, everywhere

**Status:** `APPROVED` — owner 2026-10-07, in chat:
- *"dấu phẩy sẽ là dấu phân cách hàng nghìn, dấu này sẽ không cho phép nhập để không nhầm lẫn với dấu phân cách số thập phân. Dấu chấm là dấu duy nhất được nhập để phân biệt số thập phân."*
- Asked where to apply it, he chose every place: *"Đổi cách viết số ở mọi chỗ"*.
- He asked that it be one shared function and a rule every new feature showing a number must follow.

Not built yet; part of the template work (`docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md`).

- **Every number on every screen** is written this way: admin screens, reports, charts and the POS. Examples: 1,250.5 ml; 1,250,000đ; 18.13%; 100.12k.
- It replaces the Vietnamese style used until 2026-10-07 (1.250.000, 1.250,5, "18,13%"). The examples in `BR-DATA-005` and `BR-CASH-005` keep their old marks as written history; read them with the marks swapped.
- **In a number box** the user types digits and a dot only.
  - The box adds the commas itself as he types. A comma typed or pasted is refused.
  - A box for whole numbers, money included, refuses the dot as well.
- **Every number box shows a worked example as its grey hint** before anything is typed, in the box's own unit and decimals: "Ví dụ: 1,250.5" for a quantity, "Ví dụ: 150,000" for money.
- **One shared formatter** writes every number on screen, and one shared box takes every number typed. A screen does not format a number itself. A guard test fails when new code formats a number another way, so the rule binds every future feature.
- **No setting to change the marks** — owner 2026-10-07, *"a"*: the style lives in that one shared place and changes only through Opus. Why: if the marks could flip from a settings screen mid-shift, the same keystrokes would mean a different number to staff typing at that moment.
