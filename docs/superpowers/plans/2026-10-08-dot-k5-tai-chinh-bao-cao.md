# Đợt K5 — các màn Tài chính và Báo cáo mặc khuôn dùng chung (BR-UI-005)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sổ thu chi, Chuyển tiền, Danh mục thu chi, Tài khoản ngân hàng, các trang báo cáo và trang Tổng quan dùng khuôn trong `components/ui/`; phép kiểm canh không còn dòng nợ nào gắn K5.

**Architecture:** Bộ `Table` nhận thêm vài thuộc tính để vẽ được bảng lãi lỗ đúng như mẫu chủ quán duyệt 2026-09-11 (cột đứng yên, dòng tổng phụ tô nền, số âm đỏ); các bảng báo cáo khác dùng bộ `Table` như bảng danh sách. Ô số tài khoản là mã, không phải số: `TextInput` nhận bàn phím số qua thuộc tính của khuôn. Màn hình do Gemini sửa; Opus viết test trước, soát, viết tài liệu.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-07-khuon-thanh-phan-design.md` (mục 2.4 bảng, 2.5 hộp tổng, 3 phép kiểm canh, 4 đợt K5).

## Hiện trạng

Đo 2026-10-08 trên các file `.tsx` trong `app/admin/finance`, `app/admin/reports`, `app/admin/page.tsx`, không tính test. Phép kiểm canh `components/ui/template.guard.test.ts` có 34 dòng nợ gắn K5 trên 22 file.

1. **Trạng thái.** Không áp dụng cho dữ liệu, vì đợt này không thêm bảng hay trạng thái nào. Ô nhập có ba trạng thái hiển thị như K2.
2. **Nút.** 9 file tự tô nút nâu hoặc đỏ đặc (danh sách và chi tiết của Danh mục, Tài khoản, phiếu thu chi, phiếu chuyển tiền, trang Sổ thu chi, bộ lọc báo cáo bán hàng, báo cáo xuất kho). Sau đợt này mọi nút là `Button`, mỗi màn nhiều nhất một nút Chính. Ba nút chọn nhanh "Hôm nay / 7 ngày / 30 ngày" của bộ lọc báo cáo là `Button` Phụ. Không nút nào bị ẩn hay hiện thêm.
3. **Danh sách.** Sổ thu chi, Danh mục, Tài khoản đã dùng `DataList`; chỉ đổi ô lọc và nút. Năm bảng báo cáo tự vẽ `<table>`: bảng lãi lỗ (`PnlTableView`), bảng theo món (`ProductTable`), theo điểm bán (`OutletBreakdownSection`), báo cáo bán hàng (`sales/page.tsx`, hai bảng), báo cáo ngày (`daily/page.tsx`, hai bảng). Chuyển sang bộ `Table`. Theo spec 2.4: mọi ô dòng cùng độ đậm thường, cùng màu chữ; **dòng tổng nằm ngay dưới tiêu đề** nền `primary-soft` (hôm nay hai bảng để dòng tổng ở cuối); số doanh thu không còn tô xanh. **Bảng lãi lỗ giữ nguyên hình chủ quán duyệt 2026-09-11**: cột "Khoản" bên trái, "Tổng" và "% doanh thu" bên phải đứng yên khi cuộn ngang; dòng lợi nhuận gộp và lợi nhuận ròng tô nền, chữ đậm; dòng chi tiết chữ nhỏ xám; số âm chữ đỏ; bấm ô tháng mở phần giải thích. Để bộ `Table` vẽ được hình đó, khuôn nhận thêm (Task 1): `TableRow` thuộc tính `look` (`"subtotal"` nền `surface-secondary` chữ đậm, `"strong"` chữ đậm vừa, `"detail"` chữ 12.5px xám); `TableRowHeader` (ô `<th scope="row">` đầu dòng); `TableCell` và `TableHeaderCell` thuộc tính `stick` (`"left"`, `"right"`, `"right-2"`) và `TableCell` thuộc tính `tone="negative"` (chữ đỏ). Không màn nào ngoài lãi lỗ dùng `stick` hay `look`.
4. **Ô nhập.** Không có ô `type="number"`. Ô tiền của phiếu thu chi và phiếu chuyển tiền đã là `MoneyInput` (đợt K2), không đổi. Ô "Số tài khoản" (`BankAccountForm.tsx`) tự đặt `inputMode="numeric"`: đó là **mã**, không phải số, nên không thành `NumberInput` (sẽ chèn dấu phẩy và mất số 0 đầu: `0071001234567`). Nó thành `TextInput` với thuộc tính khuôn mới `keypad="digits"` (bàn phím số trên điện thoại, giữ nguyên chữ gõ vào). Ô chữ, ô chọn tự tô chuyển sang `TextInput`, `Select`, `Field`. Hai ô ngày của bộ lọc báo cáo bán hàng giữ `CustomDatePicker` (lịch chọn, không phải ô gõ tự tô), để không đổi cách lọc đang chạy; ô chọn thương hiệu, nhân viên, nhóm món thành `Select`.
5. **Phục vụ gì, cố ý không phục vụ gì.** Phục vụ Sổ thu chi, Chuyển tiền, Danh mục thu chi, Tài khoản, báo cáo bán hàng, báo cáo ngày, báo cáo xuất kho, báo cáo lãi lỗ, Tổng quan. Cố ý không đụng: máy chủ, server action, `lib/`, cách tính số báo cáo; bộ lọc thời gian kiểu Looker (`BR-UI-007`) và dòng tổng theo bộ lọc (`BR-UI-004`), hai việc riêng ở phần 1b kế hoạch chung; biểu đồ. Không đổi chữ hiển thị, trừ nhãn viết hoa từng từ ("Tổng Doanh Thu", "Tổng Số Đơn", "Tổng Giảm giá", "TB Ly" thành "Tổng doanh thu", "Tổng số đơn", "Tổng giảm giá", "TB ly") và chữ tiếng Anh trong ngoặc.

Câu hỏi riêng của việc này:

6. **Chủ quán thấy gì khác?** Nút, ô, bảng theo trang mẫu đã duyệt. Bảng báo cáo theo món và theo điểm bán: dòng "Tổng cộng" lên ngay dưới tiêu đề, nền nâu nhạt; số doanh thu chữ đen thường thay cho xanh đậm. Bảng lãi lỗ trông như cũ.
7. **Có làm máy bán hàng ngừng nhận đơn không?** Không. Không file nào trong `app/pos` hay `lib` bị đụng.
8. **Số tài khoản có số 0 đầu** (`0071001234567`) hiện và lưu y như gõ, không dấu phẩy.
9. **Bộ lọc báo cáo bán hàng** giữ cách lọc hôm nay: chọn rồi bấm "Lọc"; tham số trên địa chỉ trang không đổi tên. Bài học đợt K4: không gắn `FilterCard` (Enter trong khung lọc chạy trước khi ô kịp lưu giá trị mới).
10. **Ví dụ bằng số thật.** Không áp dụng, vì đợt này không đọc hay ghi dữ liệu thật; số trong test là số giả.

Đã xem: spec mục 2.4, 3, 4; `components/ui/Table.tsx`, `TextInput` props; danh sách nợ K5 trong phép kiểm canh; thân `PnlTableView.tsx`, `pnl-display.tsx` (`cellTone`); các bảng trong `daily/page.tsx`, `sales/page.tsx`, `OutletBreakdownSection.tsx`, `ProductTable.tsx` (chỗ bảng, dòng tổng, chữ đậm, màu); bộ lọc `SalesFilter.tsx`; ô số tài khoản; đầu trang Tổng quan.
Chưa xem: thân từng file Tài chính ngoài số đếm ô, nút (Gemini đọc khi làm, Opus đọc khi soát); test hiện có của từng màn báo cáo ngoài `PnlTableView.test.tsx`.

## Global Constraints

- Templates (K2, `components/ui/`): `Button` (`primary` | `secondary` | `delete` | `danger`, `href`), `NumberInput`, `MoneyInput`, `TextInput`, `Select`, `Field`, `Table` set (`Table`, `TableHead`, `TableHeaderCell`, `TableBody`, `TableRow`, `TableCell`, `TableTotalRow`, `TotalCard`), `MoneySummary`, `list/DataList`, `list/ListPageHeader`, `list/FilterCard`, `detail/DetailHeader`, `PageHeader`, `BackLink`, `Badge`, `DayInput`, `SearchableSelect`.
- Trang không tự đặt màu, cỡ, viền, độ đậm cho thứ khuôn đã lo (spec 2); `className` trên khuôn chỉ để bố cục.
- No popups (`BR-DATA-007`); no new server action; values sent to the server identical to today.
- Every control 44px tall; desktop table plus phone cards for every list (`.claude/rules/ui-devices.md`).
- One brown main button visible per screen at any moment.
- All visible text Vietnamese; labels in sentence case except units, Topping, MR.PHIN, PO.
- Never delete a test; a test changed because markup moved to a template says so in the commit.
- The guard's debt lists may only shrink.

## Review Focus

1. Bảng lãi lỗ: cột "Khoản", "Tổng", "% doanh thu" đứng yên khi cuộn ngang; dòng lợi nhuận gộp, lợi nhuận ròng tô nền chữ đậm; số âm đỏ (trừ dòng chi phí, theo `cellTone`); bấm ô tháng vẫn mở phần giải thích. Pinned in Task 3.
2. Số tài khoản `0071001234567`: ô hiện đúng chuỗi đó, `inputmode="numeric"`, gửi đi đúng chuỗi đó. Pinned in Task 2.
3. Bảng theo món và theo điểm bán: dòng tổng nằm trước các dòng món, số tổng bằng tổng các dòng như hôm nay. Pinned in Task 3.
4. Phiếu thu chi, phiếu chuyển tiền: số tiền gửi đi y như hôm nay (ô `MoneyInput` không đổi). Pinned by their existing tests.
5. Bộ lọc báo cáo bán hàng: chọn thương hiệu rồi bấm "Lọc" đưa đúng tham số lên địa chỉ trang như hôm nay. Pinned in Task 3.

---

### Task 1: Bộ `Table` và `TextInput` nhận thêm thuộc tính (Gemini, khuôn)

**Files:** `components/ui/Table.tsx`, `components/ui/TextInput.tsx`; tests `components/ui/Table.test.tsx`, `components/ui/TextInput.test.tsx`.

**Produces:** `TableRow({ look?: "subtotal" | "strong" | "detail" })`; `TableRowHeader({ children, stick?, className? })` → `<th scope="row">` with `[font-weight:inherit]`, left aligned; `TableCell({ stick?: "left" | "right" | "right-2", tone?: "negative" })`; `TableHeaderCell({ stick?, "aria-label"? })`; sticky cells take the row's background (`bg-surface-card`, or `bg-surface-secondary` on a `subtotal` row); `TextInput({ keypad?: "digits" })` → `inputMode="numeric"` inside the template.

- [ ] Step 1 (Opus): tests in `Table.test.tsx` and `TextInput.test.tsx` for each prop (class names from the PnlTableView classes listed in Hiện trạng 3). Run. Expected: FAIL (prop ignored → class missing).
- [ ] Step 2 (Gemini): implement. Step 3 (Opus): run `npx vitest run components/ui` and `npx tsc --noEmit`. Expected: PASS.
- [ ] Step 4: commit `feat(ui): the Table set draws a statement (sticky columns, subtotal rows, negative tone); TextInput takes a digit keypad (BR-UI-005, wave K5)`.

### Task 2: Tài chính (Gemini)

**Files:** every `app/admin/finance` file on a K5 debt line.
**Consumes:** `TextInput keypad="digits"` from Task 1.

- [ ] Step 1 (Opus): remove the finance K5 lines from the guard; test `BankAccountForm`: label "Số tài khoản" box shows `0071001234567` seeded, `inputmode` numeric, posts `account_number=0071001234567`. Run. Expected: FAIL (guard names the files; the box test passes today → it pins, the guard is the red).
- [ ] Step 2 (Gemini): brief. Step 3 (Opus): `npx vitest run app/admin/finance components/ui/template.guard.test.ts`, tsc, read diff (no server action, same values sent).
- [ ] Step 4: commit `feat(ui): Sổ thu chi, Chuyển tiền, Danh mục, Tài khoản wear the shared templates (BR-UI-005, wave K5)`.

### Task 3: Báo cáo và Tổng quan (Gemini)

**Files:** every `app/admin/reports` file and `app/admin/page.tsx` on a K5 debt line.
**Consumes:** Task 1's props (only `PnlTableView` uses `stick`, `look`, `tone`, `TableRowHeader`).

- [ ] Step 1 (Opus): remove the remaining K5 lines from the guard; tests: `ProductTable` and `OutletBreakdownSection` put the total row before the first item row and its numbers equal today's; `PnlTableView` keeps sticky label/Tổng/% cells, subtotal and net rows drawn by `look="subtotal"`, a negative profit cell red, a click still opens the detail; `SalesFilter` choosing a brand then "Lọc" pushes the same `brand` param. Run. Expected: FAIL where markup moves (total row order, template classes), pass where behaviour is pinned.
- [ ] Step 2 (Gemini): brief. Step 3 (Opus): `npx vitest run app/admin/reports app/admin/page components/ui/template.guard.test.ts`, tsc, read diff.
- [ ] Step 4: commit `feat(ui): báo cáo và Tổng quan wear the shared templates; report totals sit under the header (BR-UI-005, wave K5)`.

### Task 4: Tài liệu, năm lệnh kiểm, soát (Opus)

- [ ] `docs/02-rules/business-rules/screens.md` BR-UI-005 status: K5 on its date. Master plan 1b line; spec status line.
- [ ] Five gates; build in a throwaway worktree.
- [ ] Fresh reviewer on the most capable model with the Review Focus verbatim; one fix pass.
- [ ] Danh sách cho chủ quán bấm thử (giữ tới lần đẩy).
