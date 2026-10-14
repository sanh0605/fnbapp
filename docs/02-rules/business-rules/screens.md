# Screen rules: one look across the whole system

Owner decisions on how screens look and read. Earlier display rules stay where they were first written: dates `BR-DATA-006`, no popups `BR-DATA-007`, sorting `BR-DATA-008` (`docs/02-rules/business-rules/data-integrity.md`). Every page change also ships its computer and phone layouts (`.claude/rules/ui-devices.md`).

Source of every rule below: the owner's notes typed with the preview's "Góp ý" tool and in chat on 2026-10-06, while checking Phiếu nhập and Phiếu xuất. The work is ordered in `docs/superpowers/plans/2026-10-06-ke-hoach-chung.md`.

### BR-UI-001 — Every word on screen is Vietnamese

**Status:** `APPROVED` — owner 2026-10-06: *"100% hệ thống phải sử dụng tiếng Việt. Không hiện theo kiểu 'Tiếng Việt (Tiếng Anh)' hoặc tương đồng như thế."*

- No label carries an English twin in brackets: "Lưu nháp", not "Lưu Nháp (Draft)"; "Quản lý", not "Quản lý (MANAGER)". Counted 2026-10-06: 25 such labels in 12 files, removed in wave 8a-2. A full read of every screen for other English words is part of the uniform-look pass.
- Loanwords the owner uses himself stay: Topping, Voucher.
- One spelling per word (2026-10-14): the tone mark sits on the second vowel — huỷ, hoá, xoá, tuỳ, khoá — because measured that day the screens wrote it so about 500 times against 47. Guard: `components/ui/spelling.guard.test.ts`. The POS keeps its own text until its own wave; Intl's weekday names ("Chủ Nhật") are not written in the source.
- Stored values (`STAFF`, `RAW`, `COMPLETED`) are not shown; the screen shows their Vietnamese name.

### BR-UI-002 — A button that creates a new record reads "Tạo"

**Status:** `APPROVED` — owner 2026-10-06: *"Các nút tạo phiếu hay tạo thêm dữ liệu mới đều chỉ hiện là 'Tạo'"*, typed on the Phiếu nhập list. Applied to every list page in wave 8a-2.

- The list's title already says what is created, so "Tạo phiếu nhập" next to the title "Phiếu nhập" repeats it.

### BR-UI-003 — List rows all look the same

**Status:** `APPROVED` — owner 2026-10-06: *"Đối với các trang danh sách, các dòng đều viết thường và có cùng một format, không tự ý viết bold hay bất kỳ một kiểu đặc biệt nào hết. Nếu có phát sinh thêm anh sẽ cung cấp thông tin về quyết định mới nhất của anh sau."* Built: computer rows in wave K2–K6 (2026-10-08, `components/ui/template.guard.test.ts` keeps `<td>` plain); phone cards on 2026-10-14 on the branch `feat/no-popups` (`components/ui/list-rows.guard.test.ts`). Summary boxes above a list (Tổng thu, Tổng chi, opening and closing balance, the order counter) are not rows and keep their weight.

- Every cell in a list row uses the same weight and size; no bold code, no bold amount, no coloured text beyond the status badge. Exceptions only when the owner names one.

### BR-UI-004 — A column that can be added up shows its total under the header

**Status:** `APPROVED` — owner 2026-10-06: *"Các cột có thể thống kê thì nên hiện một dòng số nhỏ bên dưới tiêu đề cột tương ứng cho thấy tổng của tất cả dòng theo bộ lọc."* Built 2026-10-14 on the branch `feat/no-popups` (list below).

- The total covers every row the current filter matches, not only the page on screen. Rounding follows `BR-DATA-005`: the rounded exact total.
- Cancelled rows are left out, as `BR-ACCESS-003` already says for every total; drafts are left out too, since nothing was bought or sold yet (Opus 2026-10-14). The label names what is left out. Only money columns are added up; quantities in different units never are. The shared list draws the total under the header on a computer and as a card on a phone. Built 2026-10-14 on the branch `feat/no-popups`:
  - Đơn hàng: Khách trả, "Tổng (không tính huỷ)"; old versions of an edited order are left out too.
  - Phiếu nhập: Tổng tiền, "Tổng (không tính huỷ, nháp)".
  - Phiếu xuất: Giá trị xuất, "Tổng (không tính huỷ)".
  - Sổ thu chi: the amount column mixes money in and out, so it shows "Thu … · Chi …", "Tổng (không tính huỷ, chuyển tiền)"; a transfer only moves the shop's own money between places.
  - Tài sản: Giá trị còn lại, "Tổng (không tính đã thanh lý hết)".

### BR-UI-005 — One template per screen part

**Status:** `APPROVED` — owner 2026-10-06, on an issue slip's page: *"Đồng nhất tất cả các nút về cùng một kiểu… audit lại tất cả các điểm có thể đồng nhất… nên có một khung mẫu cho từng thành phần."* Templates built in wave K2 on 2026-10-08 in `components/ui/`: `Button`, `NumberInput` (with `MoneyInput` on top), `TextInput`, `Select`, `Field`, the `Table` set and `MoneySummary`. `DataList` already uses the new header and row look. Screens move onto the templates in waves K3–K6, and `components/ui/template.guard.test.ts` lists the files still to move. Wave K3 moved the Kho screens (Đơn vị, Nhóm hàng, Thời hạn khấu hao, Hàng hoá, Quy đổi, Nhà cung cấp, Tài sản, Kiểm kê, Phiếu xuất, Phiếu nhập) on 2026-10-08. Wave K4 moved the Bán hàng screens (Đơn hàng, Món, Nhóm món, Topping & tuỳ chọn, Khuyến mãi) the same day; the order list lost its row "Hủy đơn" button, an order is cancelled from its own page. Wave K5 moved Tài chính (Sổ thu chi, Chuyển tiền, Danh mục thu chi, Tài khoản ngân hàng) and Báo cáo with Tổng quan the same day: a report table's total row sits under its header, revenue is no longer green, and the P&L keeps the look approved 2026-09-11 through the `Table` set's statement props (`look`, `stick`, `tone`, `TableRowHeader`). The guard holds no K5 debt. Wave K6 moved the rest the same day (Nhân sự, Thương hiệu, Điểm bán, Nhật ký, Đơn cần chú ý, Xóa bộ nhớ đệm, Đổi mật khẩu, the outlet picker's buttons); the guard's lists now hold only `app/admin/products/components/ToppingsManager.tsx`, which nothing imports.

- Buttons, inputs, number inputs, tables, money boxes, page headers and back links each have one shared component in `components/ui/`; a page does not style its own button.
- **Number inputs** (owner 2026-10-06, in chat): audit every one; the quantity box on the issue-slip create page is the model he likes (numeric keypad on a phone, decimals allowed, typed text kept, the converted amount shown beside it). It used a comma for decimals then; `BR-UI-008` makes that a dot.
- **The six templates are approved** — owner 2026-10-07, *"Đồng ý"*, after seeing a sample page with each template next to the styles in use today. Design: `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md`. In short:
  - Buttons: one brown main button per screen. Delete buttons have a red outline; the final confirm step is solid red.
    - Opus ruling, wave K2 (2026-10-08): the stocktake "Áp dụng" button, red until then, became the brown main button, because applying the count is that screen's main action, not a delete. "Xóa bộ lọc" on the order list only clears filters, so it is a Phụ button.
  - Number boxes: the box adds the thousands marks itself, no up/down arrows, the mouse wheel never changes the number, and a mistake shows in red under the box. Which mark is which: `BR-UI-008`.
  - Table headers are plain grey text, not capitals. Every row cell has the same weight.
  - Totals boxes are white with a thin border.
- **Money boxes everywhere now, not after the financial reports** — owner 2026-10-07, *"Đúng"*, replacing the 2026-09-11 order that put the remaining money boxes after the financial reports.
- **The POS keeps its own look:** it is used by touch.

### BR-UI-006 — Words that are too long get a short form the owner keeps

**Status:** `APPROVED` direction — owner 2026-10-06: *"Cần bổ sung thêm danh sách viết ngắn gọn của các cụm từ dài. Ví dụ 'Hình thức thanh toán' là 'HTTT'… cần có nơi để anh có thể tự do thêm/sửa/xoá thay vì hardcode."* Not built yet; a new table and screen, so it gets the full four steps.

### BR-UI-007 — Date filters work like Looker Studio's

**Status:** `APPROVED` direction — owner 2026-10-06: *"Các bộ lọc thời gian hiện tại chưa đồng nhất. Anh muốn bộ lọc phải có cách lọc như của Looker hoặc Data Studio."* Owner chose every point on 2026-10-09 (below); built on the branch `feat/no-popups` 2026-10-09, not yet pushed. Design: `docs/superpowers/specs/2026-10-09-bo-loc-thoi-gian-design.md`. Whole days only, as `BR-DATA-006` already says.

Owner choices on 2026-10-09, after trying a clickable sample (two styles, computer and phone):
- **Looker style.** The filter is one button naming the range in use, for example "Tháng này · 01/10/2026 – 31/10/2026". He passed over the Sổ thu chi dropdown in favour of this; he said *"Máy tính đang hiện tốt"*.
- **On a computer** the button opens a panel under it. On the left are all 16 ranges of `lib/shared/date-range-presets.ts`; on the right, two day boxes and two months of calendar. Asked whether the computer should drop ranges as the phone does, he chose *"2a"*: keep all 16.
- **On a phone it fits one screen** (*"điện thoại có được gói gọn trong 1 màn hình không ? Có lẽ nên giảm bớt các lựa chọn nhanh như 'X ngày qua'"*, then *"1a"*). Opening it shows nine large buttons, three by three: Hôm nay, Hôm qua, Tuần này, Tuần trước, Tháng này, Tháng trước, Quý này, Năm nay, Tuỳ chọn. Tuỳ chọn swaps them for two day boxes and one month of calendar. Every other range is reached through Tuỳ chọn.
- **The two devices share names and arithmetic.** "Tháng trước" is 01/09–30/09 on both. A range set on a computer that the phone has no button for, such as 7 ngày qua, still filters on the phone, and the button still names it.
- **A ready range filters at once.** Days picked on the calendar or typed filter only after "Áp dụng".
- **The lists open on Tháng này** (owner 2026-10-09, *"1a"*, replacing his first answer *"1b"*, which was to keep showing everything). This covers Đơn hàng, Phiếu nhập, Phiếu xuất and Nhật ký hoạt động, which until now opened with both day boxes empty and showed every record.
- **A typed code searches every day, whatever range is in use** (owner 2026-10-09: *"Anh nghĩ nên đổi lại thành 2a luôn đi nhỉ ? thế sẽ tiện hơn"*). This replaces his earlier *"2b"*, which searched only inside the range. He changed it after being told that 2b with Tháng này as the default leaves a code from August unfindable. While a code is typed, only the day range is set aside: the list says it is searching every day, and the other filters still apply. Clearing the box brings the range back.
  - **Anything typed searches every day, not only a code** (owner 2026-10-09, *"1a"*). He was told that the search boxes on Phiếu nhập, Phiếu xuất and Nhật ký also match names (an ingredient, a supplier, an invoice number), and was offered keeping a name search inside the range. He chose one rule: while the search box holds text, the day range is set aside. Newest records still come first. To see one supplier inside the month, he picks it from the Nhà cung cấp list with the search box empty; that stays inside the range.
- **No "Tất cả" range is added to the lists.** It was offered to close the gap above, and 2a closes it.
- **Reports** (owner 2026-10-09, *"1a 2a, tuy nhiên, anh nghĩ báo cáo ngày có lẽ nên xoá luôn vì không còn phù hợp, anh có thể xem được báo cáo ngày bằng báo cáo doanh số. Còn báo cáo lãi lỗ vẫn dùng bộ lọc đồng nhất của hệ thống nhưng mặc định là năm nay"*):
  - Tổng quan and Doanh số take the shared filter and open on Tháng này. Tổng quan's own eight buttons and Doanh số's three buttons and two day boxes go.
  - **Báo cáo ngày is removed.** Doanh số filtered to Hôm nay gives the same day's figures. What only the daily report had: "so hôm qua" and "so cùng thứ tuần trước", which live on as Doanh số's compare lines on Hôm nay (below); and the "Cần đặt hàng sớm" box, which is switched off until the first stocktake.
  - Lãi lỗ takes the shared filter and opens on Năm nay. **Only whole months** (owner 2026-10-09, *"1a"*). He was told that a range cutting a month would load a month's rent into a week and split depreciation by days. So on Lãi lỗ the filter offers only Tháng này, Tháng trước, Quý này, Quý trước, Năm nay, Năm trước and Từ đầu năm đến nay, and its Tuỳ chọn picks a first and last month, not days. One column per month, as now.
  - Giá trị xuất kho keeps its own tabs.
- **Compare with the period before** (owner 2026-10-09, *"1a 2a 3a"*):
  - **Same number of days, cut at the same point.** On 09/10/2026, Tháng này compares with 01/09–09/09, not with all of September. Tổng quan already did this.
  - **One day compares two ways:** with the day before, and with the same weekday a week earlier. For Friday 09/10 that is Thursday 08/10 and Friday 02/10. Both lines of the removed Báo cáo ngày live on here.
  - **Only Tổng quan and Doanh số compare.** Lãi lỗ does not, because its months already stand side by side.
  - **Tổng quan loses its figure boxes, its filter and its comparison when the new Tổng quan is built** (owner 2026-10-14: *"Mấy ô số đó anh thấy khá vô nghĩa nên làm gì khác cho nó có nghĩa hơn, nếu chưa thì ưu tiên làm trước các cảnh báo, báo động"*). Alerts take the top of the page. After that only Doanh số compares. Design: `docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md`.

### BR-UI-008 — A comma separates thousands, a dot marks decimals, everywhere

**Status:** `APPROVED` — owner 2026-10-07, in chat:
- *"dấu phẩy sẽ là dấu phân cách hàng nghìn, dấu này sẽ không cho phép nhập để không nhầm lẫn với dấu phân cách số thập phân. Dấu chấm là dấu duy nhất được nhập để phân biệt số thập phân."*
- Asked where to apply it, he chose every place: *"Đổi cách viết số ở mọi chỗ"*.
- He asked that it be one shared function and a rule every new feature showing a number must follow.

Built for every screen in wave K1 on 2026-10-08: every number on screen, the POS included, goes through `lib/shared/format.ts`, and the issue-slip quantity box takes a dot for decimals. The boxes still lack the commas inserted while typing and the worked example; both come with the shared number box in wave K2 (`docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md`).

- **Every number on every screen** is written this way: admin screens, reports, charts and the POS. Examples: 1,250.5 ml; 1,250,000đ; 18.13%; 100.12k.
- It replaces the Vietnamese style used until 2026-10-07 (1.250.000, 1.250,5, "18,13%"). The examples in `BR-DATA-005` and `BR-CASH-005` keep their old marks as written history; read them with the marks swapped.
- **In a number box** the user types digits and a dot only.
  - The box adds the commas itself as he types. A comma typed or pasted is refused.
  - A box for whole numbers, money included, refuses the dot as well.
  - **A box that takes decimals says so when a comma is typed** — owner 2026-10-08, *"Đồng ý"*, after being told that staff used to typing `1,5` would get 15: the comma is still dropped, and a red line under the box reads "Số lẻ dùng dấu chấm, ví dụ 1.5". Comes with the shared number box in wave K2. Money boxes stay silent (`BR-CASH-005`).
- **Every number box shows a worked example as its grey hint** before anything is typed, in the box's own unit and decimals: "Ví dụ: 1,250.5" for a quantity, "Ví dụ: 150,000" for money.
- **One shared formatter** writes every number on screen, and one shared box takes every number typed. A screen does not format a number itself. A guard test fails when new code formats a number another way, so the rule binds every future feature.
- **No setting to change the marks** — owner 2026-10-07, *"a"*: the style lives in that one shared place and changes only through Opus. Why: if the marks could flip from a settings screen mid-shift, the same keystrokes would mean a different number to staff typing at that moment.

### BR-UI-009 — An empty box shows only a worked example

**Status:** `APPROVED` — owner 2026-10-08, in chat: *"các ô nhập liệu nói chung khi chưa nhập gì thì sẽ chỉ hiển thị ví dụ dưới dạng placeholder"*. Shown the Phiếu nhập line (Số lượng prefilled with 1, Ghi chú reading "Ghi chú thêm…"), he chose *"a"*: every box starts empty with a grey "Ví dụ: …", gone as he types. He was told first that an item bought once then needs its 1 typed, and that an empty required box says "Cần nhập số." under it on save. Built in wave K3 on 2026-10-08; `components/ui/placeholder.guard.test.ts` keeps every new grey text a "Ví dụ: …".

- **Every box he types into** (numbers, money, text, notes, search boxes) starts empty on a new entry and shows "Ví dụ: …" in grey. No prefilled 1 or 0; no grey wording that is not an example ("Ghi chú thêm…", "Tên hoặc mã…", "Không bắt buộc", "VD: …" become "Ví dụ: …"). Measured that day: 2 typed boxes prefilled with 1 (the Phiếu nhập line's Số lượng and the asset disposal's quantity), about 50 grey texts not in that form. The sales-order edit's quantity is a −/+ counter, not a typed box, and keeps starting at 1.
- **Not covered:** lists to pick from ("-- Chọn --": picking, not typing), password boxes, and a saved record opened again (its boxes show what was saved).
- **Date and time boxes keep filling in now / today** (owner 2026-10-08, *"a"*): a date is a real value, not an example, and most entries are made at that moment; a typed time is easy to get wrong, as `ISL-00053`, `ISL-00054` and `ISL-00088` were once stored 12 hours off. On Phiếu xuất that time also drives the "Tồn hiện tại" column. He was offered "empty, chosen each time".

### BR-UI-010 — A long name in a pick list is shown whole

**Status:** `APPROVED` — owner 2026-10-08, in chat: *"trong các dropdown, khi anh muốn tìm sản phẩm nào đó, nhưng anh không thể đọc được hết tên của sản phẩm đó, anh cần cách tối ưu hơn"*. How, decided by Opus and reported to him the same day: in the searchable pick list (`components/ui/SearchableSelect.tsx`, used by 6 screens) a long name wraps onto more lines instead of being cut with "…"; on a computer the open list may be wider than the box; the chosen name in the closed box shows up to two lines. Built in wave K3 on 2026-10-08.

### BR-UI-011 — Column titles are bold and sit on the left

**Status:** `APPROVED` — owner 2026-10-10, in chat: *"Tên tiêu đề của mỗi table phải in đậm và luôn align left"*. Every table's column titles are bold and left-aligned, on every screen. Built on the branch 2026-10-10: the shared title cell (`components/ui/Table.tsx`) and the shared list (`components/ui/list/DataList.tsx`) draw every title bold and left, so a title cell no longer takes a right alignment; tests in `components/ui/Table.test.tsx` and `components/ui/list/DataList.test.tsx`.

- **A column of amounts: title on the left, figures stay on the right** (owner 2026-10-10, *"Làm theo em khuyến nghị"*, option A). He was told that moving the figures left too would stop the thousands lining up for comparing (`BR-UI-008`); he kept them right.

### BR-UI-012 — Every page has the same width: at most 1,280 px, centred

**Status:** `APPROVED` — owner 2026-10-11, in chat, after asking why pages cover the screen differently: *"Anh nghĩ có lẽ nên dùng cách b để màn laptop cũng xài được"*, option b of three (a: every page as wide as the screen; b: every page at most 1,280 px, centred; c: lists wide, other pages 1,280). The frame was built on the branch `feat/no-popups` 2026-10-11 (`app/admin/layout.tsx`, guard `components/ui/page-width.guard.test.ts`); 2026-10-14 every page that kept a narrower box of its own was opened up and its form laid in columns (guards `components/ui/page-width.guard.test.ts`, `components/ui/form-columns.guard.test.ts`).

- **Measured 2026-10-11 on 8386** at the owner's 1,920 px screen (1,584 px beside the menu): four widths in use — about 1,584 (every list, Tổng quan, Doanh số, a Phiếu nhập's and a Phiếu xuất's page, Sửa đơn hàng), 1,280 centred (most detail and edit pages, Tạo phiếu nhập, Tạo phiếu xuất, Lãi lỗ), 896 on the left (Thêm món, Tạo khuyến mãi), 672 (Thêm thương hiệu, điểm bán, nhân sự, thu chi, nhóm món, tuỳ chọn; a sales order's page; Hàng đã xuất). Each wave had set its own; no rule existed.
- **On a laptop nothing narrows:** at 1,440 px wide the space beside the menu is about 1,100 px, under the cap, so every page fills it. Measured that day at 1,440: every page fits except Lãi lỗ (14 px too wide) and Doanh số (its table 1,120 px in 1,039), which scroll sideways inside their table.
- **A phone is unchanged:** pages there already take the whole width.
- Every page — list, detail, create, edit, report — uses the whole frame; no page keeps a narrower box of its own. A form with few boxes lays them in columns rather than stretching one box across the frame.

### BR-UI-013 — Page titles: a capital only on the first word, and a create page says "Tạo …"

**Status:** `APPROVED` — owner 2026-10-11, in chat, *"Có"*, to: titles capitalise only the first word ("Tạo đơn vị tính", not "Thêm Đơn Vị Mới"), and a page that creates a record is titled "Tạo" plus what it creates, matching the button (`BR-UI-002`). Built on the branch `feat/no-popups` 2026-10-11: 16 titles renamed, guard `components/ui/page-title.guard.test.ts`.

- Counted 2026-10-11: 19 create pages. 7 capitalise every word ("Tạo Phân Loại Hàng Hoá", "Thêm Quy Đổi Mới", "Thêm Hàng Hóa Mua Vào", "Thêm Đơn Vị Mới", "Thêm Danh Mục Mới", "Thêm Tùy Chọn Mới", "Thêm Món Mới"); 13 start with "Thêm", 4 with "Tạo", and 2 use their own verb ("Ghi khoản thu chi", "Chuyển tiền").
- Names keep their own capitals (Topping, Voucher, a supplier's name).

### BR-UI-014 — Compact on a computer, thumb-sized on a phone

**Status:** `APPROVED` — owner 2026-10-11 asked for pages that look neat, with readable text, boxes neither too tall nor crammed (*"các ô không bị quá cao hay cũng không bị dồn quá nhiều thông tin"*); a trial went on 8386 that day, and on 2026-10-14 he kept it: *"Làm theo em khuyến nghị và tiếp tục"*. Built on the branch `feat/no-popups` 2026-10-11 (shared button, text box, select, number box and list).

- **On a computer** a box or button is 40 px tall (was 44) and a list row about 45 px (was 53–73). A row with a delete button is no taller than one without.
- **On a phone** a box or button stays 44 px, a thumb's width.
- Text size is unchanged: 14 px.
- A form with few boxes puts them two to a row on a computer and one per row on a phone (`BR-UI-012`).
