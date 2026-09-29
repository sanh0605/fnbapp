# Phiếu xuất: danh sách, chi tiết có chỉnh sửa, trang tạo phiếu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bấm "Phiếu xuất" mở một danh sách theo khuôn Phiếu nhập; mở một phiếu thì xem được, sửa được (xoá dòng, đổi số lượng theo đơn vị, thêm dòng), huỷ được; trang tạo phiếu dời sang `/new`.

**Architecture:** Mọi phép tính (giá trị từng dòng, trạng thái phiếu, khoá do kiểm kê, trang danh sách, chi tiết, đơn vị, phần khác nhau khi sửa) là hàm thuần trong `lib/`, có test. Server action chỉ đọc bảng rồi gọi các hàm đó. Việc ghi khi sửa phiếu đi qua một hàm Postgres mới (`edit_issue_slip_atomic`, migration `0106`) để trả về kho, ghi dòng mới và kiểm chặn trong một giao dịch. Giao diện do Gemini dựng trên các kiểu dữ liệu đã chốt ở đây.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres (plpgsql), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-phieu-xuat-danh-sach-design.md` (chủ quán duyệt thiết kế và bản mẫu 2026-09-29). Luật: `BR-INV-013`, `BR-INV-012`, `BR-INV-009`, `BR-DATA-006`, `BR-COGS-007`. Bản mẫu: https://claude.ai/artifact/HmAZxsamW6S6NwoDq6WBxe

## Global Constraints

- Code và chú thích tiếng Anh; chữ hiển thị tiếng Việt.
- Import cùng thư mục viết `./TenFile`; khác thư mục viết `@/...`. Gốc `lib/` không chứa file.
- Tiền hiển thị làm tròn bằng `displayMoney` (`lib/reports/display-rounding.ts`); không tự làm tròn chỗ khác.
- Ngày giờ hiển thị bằng `formatDateTimeFull` / `formatDate` (`lib/shared/datetime.ts`), giờ Asia/Saigon.
- Mỗi trang 20 dòng (`ISSUE_SLIPS_PER_PAGE = 20`).
- Máy chỉ lưu số lượng gốc (g, ml, cái…); đơn vị chọn trên màn hình không lưu.
- Ai được sửa, huỷ: `requireAdmin()` (chủ quán và quản lý), như hiện nay.
- Test mới phải chạy đỏ trước; báo đỏ vì thiếu hàm hay vì giá trị sai.
- Migration `0106` lên máy chủ cùng lúc với code đọc nó; chủ quán duyệt riêng, không chạy trước.
- Không đụng `lib/stock/stocktake-package-lines.ts` (máy kiểm kê cũng dùng).
- Không đổi cách tính của `lib/costing/issue-costing.ts`.

## Review Focus

1. **Sửa phiếu cũ làm kho âm ở một lúc sau đó.** Ghi thêm dòng vào ngày của phiếu mà giữa ngày đó và hôm nay kho từng xuống thấp: máy phải từ chối và nói còn bao nhiêu, không để báo cáo Hàng đã xuất và Lãi lỗ sập vì "issue exceeds quantity on hand". Test: Task 4 (chữ migration dùng `issue_stock_headroom`), Task 5 (`headroom` sai thì báo lỗi rõ).
2. **Phiếu đã huỷ mà vẫn bấm Sửa từ trang cũ còn mở.** Máy chủ phải từ chối (phiếu không còn dòng nào đang hiệu lực). Test: Task 4 (hàm SQL từ chối dòng đã trả về kho).
3. **Số lượng lẻ và đổi đơn vị.** 0,5 Túi của Túi 500 g phải gửi đi đúng 250; số lẻ không được làm tròn trước khi gửi. Test: Task 3 (`toBaseQuantity`).
4. **Hai dòng cùng mặt hàng trong một lần sửa.** Thêm 2 dòng Sữa đặc La rosee: kiểm tồn phải cộng dồn. Test: Task 4 (chữ migration có cộng dồn theo mặt hàng).
5. **Lần kiểm kê bị hoàn tác.** STK ở trạng thái `REVERSED` thì dòng STK biến khỏi danh sách và phiếu trước nó mở khoá lại. Test: Task 2 (`stocktakeLock`, `listIssueSlipsPage`).

---

## Hiện trạng

1. **Có mấy trạng thái, đặt mỗi trạng thái bằng cách nào?**
   - Bảng `issue_slips` không có cột trạng thái (cột: `id, issued_at, note, created_by_id, created_by_name, created_at`).
   - Một dòng (`stock_issues`) bị trả về kho khi có dòng khác trỏ về nó qua `reverses_issue_id`. Dòng trả về không mang `issue_slip_id` (đo: 4 dòng trả về, 0 dòng có mã phiếu).
   - Máy suy ra: phiếu **còn hiệu lực** khi còn ít nhất 1 dòng chưa bị trả; **đã huỷ** khi mọi dòng đã bị trả. Lý do huỷ đọc từ ghi chú dòng trả về, dạng `Đảo phiếu ISS-00119 (ghi nhầm) -- Huỷ cả phiếu ISL-00041 -- Test`.
   - **Khoá do kiểm kê:** phiếu có ngày xuất ≤ ngày xác nhận của lần kiểm kê `CONFIRMED` gần nhất. Hoàn tác kiểm kê đặt trạng thái `REVERSED`, nên hết khoá.
   - Dòng Kiểm kê trong danh sách: một lần kiểm kê `CONFIRMED` có ít nhất 1 dòng thiếu (`base_quantity > 0`).
2. **Có những nút nào, mỗi nút làm gì, nút nào không nên hiện khi nào?**
   - Danh sách: "Tạo phiếu xuất" (mở `/new`), Lọc, Xoá lọc (chỉ hiện khi có lọc), trước/sau/số trang.
   - Chi tiết: "Chỉnh sửa", "Huỷ phiếu". Ẩn cả hai khi phiếu đã huỷ (thay bằng nhãn Đã huỷ, lý do, ngày huỷ) hoặc bị khoá do kiểm kê (thay bằng câu giải thích).
   - Chế độ sửa: ô đánh dấu từng dòng và "chọn tất cả"; một nút chính đổi giữa "Xoá N dòng đã chọn" / "Lưu thay đổi" (mờ khi chưa đổi gì hoặc không còn dòng nào); "Bỏ thay đổi" luôn hiện; dòng "+ Thêm dòng" ở cuối bảng.
   - Hộp huỷ: nút xác nhận mờ khi lý do trống.
3. **Danh sách chứa gì, loại cái gì ra, vì lý do gì?**
   - Chứa: phiếu xuất tay còn hiệu lực; dòng Kiểm kê cho mỗi lần `CONFIRMED` có thiếu hàng.
   - Loại khỏi "Tất cả": phiếu đã huỷ (chỉ hiện khi Loại = Đã huỷ), dòng trả về kho (không phải phiếu), lần kiểm kê chỉ có hàng thừa ("2A"), lần kiểm kê `OPEN`/`REVERSED`.
   - Đo 2026-09-29: 78 phiếu, 4 đã huỷ (ISL-00041, ISL-00042, ISL-00050, ISL-00053), 1 lần kiểm kê có thiếu (STK-001). "Tất cả" = 74 + 1 = **75 dòng**. Spec mục 3 ghi "79" là đếm trước khi chốt ẩn phiếu huỷ; sửa lại trong Task 10.
4. **Mỗi ô nhập nhận giá trị nào, nhập ngoài khoảng thì sao?**
   - Ô tìm: chữ bất kỳ, cắt còn 100 ký tự, không phân biệt hoa thường; tìm trong mã phiếu và tên mặt hàng của mọi dòng gốc của phiếu (kể cả phiếu huỷ).
   - Loại: `ALL`, `SLIP`, `STOCKTAKE`, `CANCELLED`; giá trị lạ coi như `ALL`.
   - Người ghi: `ALL` hoặc đúng một tên trong danh sách; tên lạ cho ra 0 dòng.
   - Từ ngày / Đến ngày: `YYYY-MM-DD`; sai dạng thì bỏ qua ô đó; từ > đến thì `rangeError` và không lọc ngày.
   - Trang: số nguyên ≥ 1; lớn hơn số trang thì về trang cuối; khác thì trang 1.
   - Số lượng khi sửa: số > 0, cho phép lẻ; 0, âm, trống, chữ → lỗi "Dòng N: số lượng phải lớn hơn 0". Máy chủ kiểm lần cuối: không vượt tồn từ ngày của phiếu tới nay.
   - Lý do huỷ: bắt buộc, cắt khoảng trắng; trống → "Lý do huỷ phiếu là bắt buộc".
5. **Phục vụ loại dữ liệu nào, cố ý không phục vụ loại nào?**
   - Phục vụ: phiếu xuất tay (`issue_slips` + dòng `MANUAL`), phần thiếu của kiểm kê (dòng `STOCKTAKE` dương).
   - Cố ý không: đơn bán (không trừ kho từ 2026-08-07); thiết bị và hàng mua dùng ngay (`selectCostedIssues` loại, giá trị dòng = 0; đo 0 dòng như vậy trên phiếu); dòng `MANUAL` không có phiếu (chỉ là 4 dòng trả về).

**Câu hỏi thêm cho việc này:**

6. **Giá trị một dòng tính thế nào mà khớp báo cáo "Hàng đã xuất"?** Máy tính giá vốn chỉ trả tổng theo mặt hàng. Cách lấy từng dòng: với mỗi mặt hàng, chạy lại máy tính trên các dòng tính tới dòng đó, lấy phần chênh. Đo 2026-09-29: tổng mọi dòng = tổng máy tính = 53.936.297,115332 trên 196 dòng, lệch 0. Tổng dòng của ISL-00076, ISL-00075, ISL-00077 và STK-001 khớp đúng con số tab "Theo lần xuất".
7. **Ghi thêm dòng vào ngày cũ có làm kho âm ở giữa không?** Có thể. Hàm tạo phiếu hiện tại (`0094`) chỉ kiểm tồn đúng lúc của phiếu, không kiểm các lúc sau. Nếu kho âm ở giữa, máy tính giá vốn ném lỗi và cả báo cáo lẫn danh sách này sập. Kế hoạch thêm hàm `issue_stock_headroom` (tồn thấp nhất từ lúc đó tới nay) và dùng cho cả sửa lẫn tạo phiếu. Đây là quyết định kỹ thuật, báo lại chủ quán.
8. **Sửa số lượng tăng lên bị chặn oan không?** Có, trong một trường hợp hẹp. Tăng Bột sữa B One trên ISL-00076 từ 1.000 g lên 1.500 g: máy trả 1.000 g về kho *hôm nay*, rồi xuất 1.500 g *ngày 28/09*. Từ 28/09 tới nay tồn thấp nhất là 1.000 g, nên 1.500 g bị từ chối, dù nhìn thì "chỉ cần thêm 500 g". Thêm một dòng Bột sữa B One 500 g thì được. Chủ quán chốt A (2026-09-29, "theo khuyến nghị"): từ chối, báo rõ còn bao nhiêu và gợi ý thêm dòng. Ghi ở `BR-INV-013`. **Đã thay (2026-09-29, chủ quán chọn "1" sau khi soát Task 4 thấy cả giảm số cũng bị chặn):** đổi số lượng thì dòng cũ trả về kho *đúng ngày của phiếu*, không phải hôm nay. Ví dụ trên chỉ cần tồn ≥ 500 g. Xoá dòng và huỷ phiếu vẫn ghi hôm nay. Ghi ở `BR-INV-013`.
9. **Tạo phiếu mới lùi ngày về trước lần kiểm kê có bị chặn không?** Hiện không. Spec chỉ chặn sửa và huỷ. Chủ quán chốt A (2026-09-29): chặn luôn, cùng một phép kiểm. Ghi ở `BR-INV-013`.

**Đã xem:** spec và bản mẫu; `app/admin/inventory/issue-slips/{page.tsx, actions.ts}`; `lib/stock/manual-issue-transaction.ts`; `lib/stock/stocktake-package-lines.ts`; migration `0063`, `0093`, `0094`; `lib/costing/issue-costing.ts` (`computeIssueCosting`), `lib/costing/issue-costing-inputs.ts`; `lib/reports/issued-value-report.ts`; `app/admin/reports/issued/actions.ts`; `lib/purchasing/purchase-order-list.ts`; `app/admin/inventory/purchase-orders/{page.tsx, [id]/page.tsx, actions.ts}`; `app/admin/inventory/stocktake/actions.ts` (`getLastConfirmedStocktakeSession`); `app/admin/nav-items.ts`, `app/admin/nav-allowlist.ts`, `app/admin/page-headings.test.ts`, `lib/shared/nav-completeness.ts`; `supabase/CLAUDE.md`; dữ liệu thật đo 2026-09-29.

**Chưa xem:** thân `IssueSlipClient.tsx` ngoài phần lý do (Gemini đọc khi dời trang); `lib/shared/use-filter-form.ts` và `components/ui/DayInput.tsx` (Gemini dùng lại như Phiếu nhập); trang kiểm kê khi có hơn một lần kiểm kê đã xác nhận; trigger trên `stock_issues` và `issue_slips` (Task 4 liệt kê từ chữ migration). Ghi chú lệch tài liệu: `inventory.md` dòng 166 nói ISL-00075..88 đã xoá bởi `0104`, nhưng ISL-00075..78 đang có (tạo lại 29/09 với cùng số, `created_at` 29/09). Không sửa trong kế hoạch này; Task 10 thêm một câu ghi nhận.

## Ví dụ tính sẵn bằng số thật (đo 2026-09-29, đọc-không-ghi, bằng JavaScript qua `vite-node`)

**ISL-00076**, 28/09/2026 18:20, tuyen2612, lý do "Khác":

| Dòng | Mặt hàng | Số lượng gốc | Hiện | Giá trị chính xác | Hiện |
|---|---|---|---|---|---|
| ISS-00190 | Bột cà phê MR.PHIN Robusta Dak Mil | 500 g | 1 Túi (500 g) | 123.593,1343 | 123.593đ |
| ISS-00191 | Bột cà phê truyền thống Phin Đậm | 500 g | 1 Túi (500 g) | 73.668,0556 | 73.668đ |
| ISS-00192 | Sữa yến mạch Oatside | 2.000 ml | 2 Hộp (2.000 ml) | 73.606,1633 | 73.606đ |
| ISS-00193 | Bột sữa B One | 1.000 g | 1 Túi (1.000 g) | 74.400,0000 | 74.400đ |
| ISS-00194 | Sữa đặc La rosee | 1.000 g | 1 Lon (1.000 g) | 42.493,2898 | 42.493đ |
| ISS-00195 | Sữa tươi Mlekovita | 1.000 ml | 1 Hộp (1.000 ml) | 27.099,9471 | 27.100đ |
| ISS-00196 | Giấy lót chống tràn | 1 Xấp | 1 Xấp | 36.404,6000 | 36.405đ |
| | **Tổng** | | | 451.265,1900 | **451.265đ** |

Bản mẫu ghi 610.000đ là số minh hoạ; số thật là 451.265đ.

**Sửa thử ISL-00076 (ví dụ spec mục 4):** bỏ Giấy lót chống tràn (ISS-00196), đổi Sữa yến mạch Oatside 2 Hộp → 1 Hộp.
- Máy gửi: `removeIssueIds = [ISS-00196]`, `replaceIssueIds = [ISS-00192]`, `addLines = [{ SPM-038, 1000 }]`.
- Kiểm tồn Oatside: dòng trả −2.000 ml ghi trước, nên tồn thấp nhất từ 28/09 18:20 tới nay = 36.000 + 2.000 = 38.000 ml ≥ 1.000 → cho qua.
- Ghi: trả Giấy lót về kho ngày bấm (−1 Xấp); trả Oatside về kho ngày 28/09 18:20 (−2.000 ml); một dòng mới 1.000 ml ngày 28/09 18:20 thuộc ISL-00076.
- Giá trị dòng mới = 73.606,1633 ÷ 2 = 36.803,08 (giá bình quân không đổi khi xuất). Tổng phiếu mới = 451.265,19 − 36.404,60 − 73.606,16 + 36.803,08 = 378.057,51 → **378.058đ**, 6 dòng.

**Tồn thấp nhất từ 28/09 18:20 tới nay** (sau khi đã trừ ISL-00076): MR.PHIN 1.500 g · Phin Đậm 6.000 g · Oatside 36.000 ml · Bột sữa B One 1.000 g · La rosee 48.000 g · Mlekovita 46.000 ml · Giấy lót 4 Xấp.

**ISL-00041** (09/07/2026 21:49, admin, "Hao hụt / hư hỏng", ISS-00119 Baking Soda Caster 454 g): đã huỷ lúc 02/09/2026 02:25 (dòng trả ISS-00122), lý do "Test". Danh sách: chỉ hiện khi Loại = Đã huỷ, giá trị 0đ. Chi tiết: nhãn Đã huỷ, lý do "Test", không có nút sửa, huỷ.

**STK-001** (xác nhận bởi admin 09/08/2026 22:02; 49 dòng thiếu, 0 dòng thừa): giá trị 34.864.626,8322 → **34.864.627đ**.

**Khoá do kiểm kê:** chỉ ISL-00041 nằm trước STK-001, mà nó đã huỷ. Hôm nay không phiếu còn hiệu lực nào bị khoá, nên câu "Phiếu nằm trước lần kiểm kê…" chưa thấy được trên dữ liệu thật; test ở Task 2, Task 3 và Task 4 giữ nó.

**Trang 1, Loại = Tất cả:** STK-001 đứng sau mọi phiếu tháng 9; chân bảng "1–20 trên 75 phiếu".

---

## Cấu trúc file

| File | Việc | Ai |
|---|---|---|
| `lib/costing/issue-line-values.ts` (+ test) | Giá trị từng dòng xuất, cùng máy tính giá vốn | Sonnet |
| `lib/stock/issue-slip-status.ts` (+ test) | Dòng còn hiệu lực, phiếu đã huỷ + lý do, khoá do kiểm kê | Sonnet |
| `lib/stock/issue-slip-list.ts` (+ test) | Một trang danh sách, lọc, người ghi | Sonnet |
| `lib/stock/issue-slip-detail.ts` (+ test) | Dữ liệu một phiếu | Sonnet |
| `lib/stock/issue-unit-options.ts` (+ test) | Đơn vị chọn được cho một mặt hàng, quy ra số gốc | Sonnet |
| `lib/stock/issue-slip-edit-diff.ts` (+ test) | Từ bản nháp sửa ra việc cần ghi | Sonnet |
| `supabase/migrations/0106_issue_slip_edit.sql`, `tests/migrations/issue-slip-edit-migration.test.ts` | Hàm sửa phiếu, tồn thấp nhất, chặn trước kiểm kê | Sonnet |
| `lib/stock/manual-issue-transaction.ts` (+ test) | Thêm `editIssueSlipAtomic` | Sonnet |
| `app/admin/inventory/issue-slips/actions.ts` (+ test) | Thêm `getIssueSlipsPage`, `getIssueSlipDetail`, `editIssueSlip`; bỏ `getRecentIssueSlips`, `reverseIssueSlip` ở Task 9 | Sonnet |
| `app/admin/inventory/issue-slips/{page.tsx, loading.tsx, components/IssueSlipsClient.tsx}` | Trang danh sách | Gemini |
| `app/admin/inventory/issue-slips/[id]/{page.tsx, loading.tsx}`, `components/IssueSlipDetailClient.tsx` | Chi tiết + chế độ sửa + hộp huỷ | Gemini |
| `app/admin/inventory/issue-slips/new/{page.tsx, loading.tsx}`, `components/IssueSlipClient.tsx` | Trang tạo phiếu | Gemini |
| `app/admin/nav-allowlist.ts` | Thêm `/admin/inventory/issue-slips/new` | Gemini (Task 8) |
| Tài liệu, cửa kiểm | | Opus |

---

### Task 1: Giá trị từng dòng xuất

**Files:**
- Create: `lib/costing/issue-line-values.ts`
- Test: `lib/costing/issue-line-values.test.ts`

**Interfaces:**
- Consumes: `computeIssueCosting`, `Purchase`, `Issue` từ `@/lib/costing/issue-costing`.
- Produces: `export type IdentifiedIssue = Issue & { id: string }`; `export function computeIssueLineValues(purchases: Purchase[], issues: IdentifiedIssue[]): Map<string, number>` — giá trị chính xác (chưa làm tròn) theo `id`; dòng âm (trả về kho, hàng thừa) cho giá trị âm.

- [ ] **Step 1: Viết test đỏ**

```ts
import { describe, expect, it } from "vitest";
import { computeIssueCosting, type Purchase } from "@/lib/costing/issue-costing";
import { computeIssueLineValues, type IdentifiedIssue } from "./issue-line-values";

const purchases: Purchase[] = [
  { purchased_item_id: "A", at: "2026-09-01T00:00:00Z", base_quantity: 1000, subtotal: 100000 },
  { purchased_item_id: "A", at: "2026-09-03T00:00:00Z", base_quantity: 1000, subtotal: 200000 },
  { purchased_item_id: "B", at: "2026-09-01T00:00:00Z", base_quantity: 10, subtotal: 50000 },
];
const issues: IdentifiedIssue[] = [
  { id: "I1", purchased_item_id: "A", at: "2026-09-02T00:00:00Z", base_quantity: 500, source: "MANUAL" },
  { id: "I2", purchased_item_id: "A", at: "2026-09-04T00:00:00Z", base_quantity: 500, source: "MANUAL" },
  { id: "I3", purchased_item_id: "B", at: "2026-09-02T00:00:00Z", base_quantity: 4, source: "MANUAL" },
  // I1 returned to stock later, at the then-current average (BR-INV-009).
  { id: "R1", purchased_item_id: "A", at: "2026-09-05T00:00:00Z", base_quantity: -500, source: "MANUAL" },
];

describe("computeIssueLineValues", () => {
  it("prices each line at the weighted average of its own moment", () => {
    const v = computeIssueLineValues(purchases, issues);
    expect(v.get("I1")).toBeCloseTo(50000, 6);
    // pool after I1: 500 @ 50.000 + 1000 @ 200.000 = 250.000 / 1500
    expect(v.get("I2")).toBeCloseTo(500 * 250000 / 1500, 6);
    expect(v.get("I3")).toBeCloseTo(20000, 6);
  });

  it("gives a return-to-stock row a negative value and leaves earlier lines unchanged", () => {
    const v = computeIssueLineValues(purchases, issues);
    expect(v.get("R1")!).toBeLessThan(0);
    expect(v.get("I1")).toBeCloseTo(50000, 6);
  });

  it("sums to exactly what computeIssueCosting reports", () => {
    const v = computeIssueLineValues(purchases, issues);
    const lineSum = [...v.values()].reduce((s, x) => s + x, 0);
    const engine = computeIssueCosting(purchases, issues).reduce((s, r) => s + r.issued_value, 0);
    expect(lineSum).toBeCloseTo(engine, 6);
  });

  it("keeps input order for two lines at the same instant", () => {
    const same: IdentifiedIssue[] = [
      { id: "S1", purchased_item_id: "B", at: "2026-09-02T00:00:00Z", base_quantity: 2, source: "MANUAL" },
      { id: "S2", purchased_item_id: "B", at: "2026-09-02T00:00:00Z", base_quantity: 3, source: "MANUAL" },
    ];
    const v = computeIssueLineValues(purchases, same);
    expect(v.get("S1")).toBeCloseTo(10000, 6);
    expect(v.get("S2")).toBeCloseTo(15000, 6);
  });
});
```

- [ ] **Step 2: Chạy, xác nhận đỏ vì thiếu module**

Run: `npx vitest run lib/costing/issue-line-values.test.ts`
Expected: FAIL, "Failed to resolve import ./issue-line-values" (đỏ vì thiếu hàm).

- [ ] **Step 3: Viết code**

```ts
import { computeIssueCosting, type Issue, type Purchase } from "@/lib/costing/issue-costing";

export type IdentifiedIssue = Issue & { id: string };

// computeIssueCosting returns one cumulative total per item, not a value per
// issue row. A row's value is the change in its item's total when the row is
// added to that item's replay -- the same prefix-subtraction idea as
// computeIssuedEventFigures (lib/reports/issued-value-report.ts), done per
// item so no second cost definition exists. Items are independent in the
// engine, so replaying one item's purchases and issues alone is exact.
// Order within an item matches the engine: time, then input order.
// Cost is O(k^2) per item; the busiest item has well under 50 rows.
export function computeIssueLineValues(purchases: Purchase[], issues: IdentifiedIssue[]): Map<string, number> {
  const purchasesByItem = new Map<string, Purchase[]>();
  for (const p of purchases) {
    const list = purchasesByItem.get(p.purchased_item_id) ?? [];
    list.push(p);
    purchasesByItem.set(p.purchased_item_id, list);
  }
  const issuesByItem = new Map<string, { issue: IdentifiedIssue; seq: number }[]>();
  issues.forEach((issue, seq) => {
    const list = issuesByItem.get(issue.purchased_item_id) ?? [];
    list.push({ issue, seq });
    issuesByItem.set(issue.purchased_item_id, list);
  });

  const values = new Map<string, number>();
  for (const [itemId, list] of issuesByItem) {
    list.sort((a, b) => new Date(a.issue.at).getTime() - new Date(b.issue.at).getTime() || a.seq - b.seq);
    const itemPurchases = purchasesByItem.get(itemId) ?? [];
    const prefix: Issue[] = [];
    let previous = 0;
    for (const { issue } of list) {
      prefix.push({ purchased_item_id: issue.purchased_item_id, at: issue.at, base_quantity: issue.base_quantity, source: issue.source });
      const total = computeIssueCosting(itemPurchases, prefix).reduce((s, r) => s + r.issued_value, 0);
      values.set(issue.id, total - previous);
      previous = total;
    }
  }
  return values;
}
```

- [ ] **Step 4: Chạy, xác nhận xanh**

Run: `npx vitest run lib/costing/issue-line-values.test.ts` — Expected: 4 passed.

- [ ] **Step 5: Commit** `feat(costing): per-line issue values from the same weighted-average engine`

---

### Task 2: Trạng thái phiếu và trang danh sách

**Files:**
- Create: `lib/stock/issue-slip-status.ts`, `lib/stock/issue-slip-list.ts`
- Test: `lib/stock/issue-slip-status.test.ts`, `lib/stock/issue-slip-list.test.ts`

**Interfaces:**
- Consumes: `displayMoney` (`@/lib/reports/display-rounding`), `formatDateTimeFull`, `formatDate` (`@/lib/shared/datetime`), `toSaigonUtcRange` (`@/lib/shared/report-time`).
- Produces (`issue-slip-status.ts`):

```ts
export interface IssueRowRecord {
  id: string; purchased_item_id: string; issued_at: string; base_quantity: number | string;
  source: string; session_id: string | null; note: string | null; created_at?: string | null;
  reverses_issue_id: string | null; issue_slip_id: string | null;
}
export interface IssueSlipRecord {
  id: string; issued_at: string; note: string | null; created_by_id: string | null;
  created_by_name: string | null; created_at: string | null;
}
export interface StocktakeSessionRecord {
  id: string; status: string; confirmed_at: string | null; confirmed_by_name: string | null;
}
export interface SlipCancellation { at: string; reason: string }
export interface StocktakeLock { sessionId: string; confirmedAt: string }
export function reversedIssueIds(issues: IssueRowRecord[]): Set<string>;
export function slipLines(slipId: string, issues: IssueRowRecord[]): IssueRowRecord[];           // every original line
export function activeSlipLines(slipId: string, issues: IssueRowRecord[], reversed: Set<string>): IssueRowRecord[];
export function parseCancelReason(note: string | null): string;
export function slipCancellation(slipId: string, issues: IssueRowRecord[], reversed: Set<string>): SlipCancellation | null;
export function stocktakeLock(issuedAt: string, sessions: StocktakeSessionRecord[]): StocktakeLock | null;
```

- Produces (`issue-slip-list.ts`):

```ts
export const ISSUE_SLIPS_PER_PAGE = 20;
export type IssueSlipKind = "SLIP" | "STOCKTAKE" | "CANCELLED";
export interface IssueSlipListFilters { q?: string; kind?: string; person?: string; from?: string; to?: string; page?: string }
export interface IssueSlipListRow {
  id: string; href: string; kind: IssueSlipKind; reason: string; dateText: string;
  createdByName: string; value: number;
}
export interface IssueSlipListPage {
  rows: IssueSlipListRow[]; total: number; page: number; pageCount: number;
  firstIndex: number; lastIndex: number; rangeError: boolean; people: string[];
}
export function listIssueSlipsPage(input: {
  slips: IssueSlipRecord[]; issues: IssueRowRecord[]; sessions: StocktakeSessionRecord[];
  items: { id: string; name: string }[]; lineValues: Map<string, number>; filters: IssueSlipListFilters;
}): IssueSlipListPage;
```

Luật:
- `parseCancelReason`: khớp `/Huỷ cả phiếu ISL-\d+ -- ([\s\S]*)$/` (chuẩn hoá NFC trước khi so), trả nhóm 1 đã `trim`; không khớp trả `""`.
- `slipCancellation`: `null` nếu phiếu không có dòng nào hoặc còn dòng hiệu lực; nếu không, `at` = `issued_at` muộn nhất của các dòng trả về trỏ vào dòng của phiếu, `reason` = `parseCancelReason` của dòng trả về đó.
- `stocktakeLock`: lấy lần `status === "CONFIRMED"` có `confirmed_at` muộn nhất; khoá khi `issuedAt ≤ confirmed_at` (so theo mili giây); không có lần nào → `null`.
- Dòng phiếu: `kind` = `CANCELLED` nếu `slipCancellation` khác null, ngược lại `SLIP`; `reason` = `note` đã trim (trống thì `""`, không tự điền); `value` = `displayMoney(tổng lineValues của dòng còn hiệu lực)`, phiếu huỷ = 0; `href` = `/admin/inventory/issue-slips/${id}`; ngày = `issued_at`; người ghi = `created_by_name ?? "—"`.
- Dòng kiểm kê: mỗi lần `CONFIRMED` có ≥ 1 dòng `source === "STOCKTAKE"`, cùng `session_id`, `base_quantity > 0`. `value` = `displayMoney(tổng lineValues các dòng dương)`; ngày = `confirmed_at`; người ghi = `confirmed_by_name ?? "—"`; `href` = `/admin/inventory/stocktake`; `reason` = `""`.
- Lọc loại: `SLIP`, `STOCKTAKE`, `CANCELLED` đúng loại; còn lại (kể cả `ALL`, trống, lạ) = mọi dòng trừ `CANCELLED`.
- Người ghi: `person` trống hoặc `ALL` thì bỏ qua; khác thì so đúng tên. `people` = mọi tên người ghi phiếu và người xác nhận của các dòng kiểm kê, bỏ trùng, bỏ "—", sắp theo `localeCompare(…, "vi")`; tính trên toàn bộ, không theo lọc.
- Tìm, ngày, trang: y như `listPurchaseOrdersPage` (cắt 100 ký tự, `DAY_ONLY`, `toSaigonUtcRange`, `rangeError`). Chữ tìm gồm mã phiếu (hoặc mã kiểm kê) và tên mặt hàng của mọi dòng gốc (phiếu) hoặc dòng dương (kiểm kê).
- Thứ tự: ngày mới trước; bằng nhau thì `created_at` mới trước (kiểm kê dùng `confirmed_at`); rồi `id` giảm dần.

- [ ] **Step 1: Viết test đỏ cho `issue-slip-status.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  activeSlipLines, parseCancelReason, reversedIssueIds, slipCancellation, stocktakeLock,
  type IssueRowRecord, type StocktakeSessionRecord,
} from "./issue-slip-status";

const row = (over: Partial<IssueRowRecord>): IssueRowRecord => ({
  id: "X", purchased_item_id: "SPM-067", issued_at: "2026-07-09T14:49:00Z", base_quantity: 454,
  source: "MANUAL", session_id: null, note: null, created_at: null, reverses_issue_id: null, issue_slip_id: null, ...over,
});
// Real shape of ISL-00041, measured 2026-09-29.
const isl41 = [
  row({ id: "ISS-00119", issue_slip_id: "ISL-00041", note: "Hao hụt / hư hỏng" }),
  row({ id: "ISS-00122", issued_at: "2026-09-01T19:25:45.301036+00:00", base_quantity: -454, reverses_issue_id: "ISS-00119",
    note: "Đảo phiếu ISS-00119 (ghi nhầm) -- Huỷ cả phiếu ISL-00041 -- Test" }),
];
const stk001: StocktakeSessionRecord = { id: "STK-001", status: "CONFIRMED", confirmed_at: "2026-08-09T15:02:00Z", confirmed_by_name: "admin" };

describe("issue slip status", () => {
  it("reads the cancel reason written by cancel_issue_slip_atomic", () => {
    expect(parseCancelReason(isl41[1].note)).toBe("Test");
    expect(parseCancelReason("Đảo phiếu ISS-00001 (ghi nhầm)")).toBe("");
    expect(parseCancelReason(null)).toBe("");
  });

  it("a slip with every line returned is cancelled, dated by its return", () => {
    const reversed = reversedIssueIds(isl41);
    expect(activeSlipLines("ISL-00041", isl41, reversed)).toEqual([]);
    expect(slipCancellation("ISL-00041", isl41, reversed)).toEqual({ at: "2026-09-01T19:25:45.301036+00:00", reason: "Test" });
  });

  it("a slip with one line still active is not cancelled", () => {
    const rows = [...isl41, row({ id: "ISS-00200", issue_slip_id: "ISL-00041" })];
    expect(slipCancellation("ISL-00041", rows, reversedIssueIds(rows))).toBeNull();
  });

  it("locks a slip dated on or before the latest confirmed stocktake", () => {
    expect(stocktakeLock("2026-07-09T14:49:00Z", [stk001])).toEqual({ sessionId: "STK-001", confirmedAt: "2026-08-09T15:02:00Z" });
    expect(stocktakeLock("2026-08-09T15:02:00Z", [stk001])).not.toBeNull();
    expect(stocktakeLock("2026-09-28T11:20:00Z", [stk001])).toBeNull();
  });

  it("an undone stocktake locks nothing", () => {
    expect(stocktakeLock("2026-07-09T14:49:00Z", [{ ...stk001, status: "REVERSED" }])).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy, xác nhận đỏ vì thiếu module** — `npx vitest run lib/stock/issue-slip-status.test.ts`.

- [ ] **Step 3: Viết `issue-slip-status.ts`** theo Interfaces và Luật ở trên. Mỗi hàm là vòng lọc đơn giản trên mảng; `parseCancelReason` gọi `note.normalize("NFC")` trước khi khớp, và mẫu regex cũng viết ở dạng NFC.

- [ ] **Step 4: Chạy xanh.**

- [ ] **Step 5: Viết test đỏ cho `issue-slip-list.ts`**

```ts
import { describe, expect, it } from "vitest";
import { listIssueSlipsPage } from "./issue-slip-list";
import type { IssueRowRecord, IssueSlipRecord, StocktakeSessionRecord } from "./issue-slip-status";

const line = (id: string, slip: string | null, item: string, qty: number, at: string, over: Partial<IssueRowRecord> = {}): IssueRowRecord => ({
  id, purchased_item_id: item, issued_at: at, base_quantity: qty, source: "MANUAL", session_id: null,
  note: null, created_at: null, reverses_issue_id: null, issue_slip_id: slip, ...over,
});
const slips: IssueSlipRecord[] = [
  { id: "ISL-00076", issued_at: "2026-09-28T11:20:00Z", note: "Khác", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:21:58Z" },
  { id: "ISL-00077", issued_at: "2026-09-29T03:22:00Z", note: "Khác", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:22:25Z" },
  { id: "ISL-00041", issued_at: "2026-07-09T14:49:00Z", note: "Hao hụt / hư hỏng", created_by_id: "USR-001", created_by_name: "admin", created_at: "2026-09-01T14:49:57Z" },
];
const issues: IssueRowRecord[] = [
  line("ISS-00192", "ISL-00076", "SPM-038", 2000, "2026-09-28T11:20:00Z"),
  line("ISS-00196", "ISL-00076", "SPM-070", 1, "2026-09-28T11:20:00Z"),
  line("ISS-00197", "ISL-00077", "SPM-012", 1000, "2026-09-29T03:22:00Z"),
  line("ISS-00119", "ISL-00041", "SPM-067", 454, "2026-07-09T14:49:00Z"),
  line("ISS-00122", null, "SPM-067", -454, "2026-09-01T19:25:45Z", { reverses_issue_id: "ISS-00119", note: "Đảo phiếu ISS-00119 (ghi nhầm) -- Huỷ cả phiếu ISL-00041 -- Test" }),
  line("ISS-00001", null, "SPM-002", 500, "2026-08-09T15:02:00Z", { source: "STOCKTAKE", session_id: "STK-001" }),
  line("ISS-00002", null, "SPM-003", -20, "2026-08-09T15:02:00Z", { source: "STOCKTAKE", session_id: "STK-001" }),
];
const sessions: StocktakeSessionRecord[] = [{ id: "STK-001", status: "CONFIRMED", confirmed_at: "2026-08-09T15:02:00Z", confirmed_by_name: "admin" }];
const items = [
  { id: "SPM-038", name: "Sữa yến mạch Oatside" }, { id: "SPM-070", name: "Giấy lót chống tràn" },
  { id: "SPM-012", name: "Sữa đặc La rosee" }, { id: "SPM-067", name: "Baking Soda Caster" },
  { id: "SPM-002", name: "Sữa tươi Mlekovita" }, { id: "SPM-003", name: "Bột cà phê MR.PHIN Robusta Dak Mil" },
];
const lineValues = new Map<string, number>([
  ["ISS-00192", 73606.1633], ["ISS-00196", 36404.6], ["ISS-00197", 42493.2898],
  ["ISS-00119", 48600], ["ISS-00122", -48600], ["ISS-00001", 13550], ["ISS-00002", -2000],
]);
const page = (filters = {}) => listIssueSlipsPage({ slips, issues, sessions, items, lineValues, filters });

describe("listIssueSlipsPage", () => {
  it("Tất cả hides cancelled slips and lists the stocktake, newest first", () => {
    const p = page();
    expect(p.rows.map(r => r.id)).toEqual(["ISL-00077", "ISL-00076", "STK-001"]);
    expect(p.total).toBe(3);
  });

  it("slip value is the sum of its active lines, rounded for display", () => {
    expect(page().rows.find(r => r.id === "ISL-00076")!.value).toBe(110011);
  });

  it("stocktake value counts the shortfall only (3A) and links to the stocktake screen", () => {
    const stk = page().rows.find(r => r.id === "STK-001")!;
    expect(stk).toMatchObject({ kind: "STOCKTAKE", value: 13550, createdByName: "admin", href: "/admin/inventory/stocktake" });
  });

  it("Đã huỷ shows only cancelled slips, at 0đ", () => {
    expect(page({ kind: "CANCELLED" }).rows).toEqual([expect.objectContaining({ id: "ISL-00041", kind: "CANCELLED", value: 0 })]);
  });

  it("a surplus-only stocktake is not listed (2A); an undone one is not listed (1A)", () => {
    const surplusOnly = listIssueSlipsPage({ slips: [], issues: issues.filter(i => i.id === "ISS-00002"), sessions, items, lineValues, filters: {} });
    expect(surplusOnly.rows).toEqual([]);
    const undone = listIssueSlipsPage({ slips: [], issues, sessions: [{ ...sessions[0], status: "REVERSED" }], items, lineValues, filters: {} });
    expect(undone.rows).toEqual([]);
  });

  it("searches item names, including a cancelled slip's lines", () => {
    expect(page({ q: "oatside" }).rows.map(r => r.id)).toEqual(["ISL-00076"]);
    expect(page({ q: "baking", kind: "CANCELLED" }).rows.map(r => r.id)).toEqual(["ISL-00041"]);
  });

  it("filters by person and lists every person once", () => {
    expect(page({ person: "admin" }).rows.map(r => r.id)).toEqual(["STK-001"]);
    expect(page().people).toEqual(["admin", "tuyen2612"]);
  });

  it("a from-date after the to-date is an error and does not filter", () => {
    const p = page({ from: "2026-09-29", to: "2026-09-01" });
    expect(p.rangeError).toBe(true);
    expect(p.total).toBe(3);
  });

  it("pages 20 rows and clamps an out-of-range page", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ ...slips[0], id: `ISL-9${String(i).padStart(4, "0")}` }));
    const manyLines = many.map((s, i) => line(`ISS-9${i}`, s.id, "SPM-038", 1, s.issued_at));
    const p = listIssueSlipsPage({ slips: many, issues: manyLines, sessions: [], items, lineValues: new Map(), filters: { page: "9" } });
    expect(p).toMatchObject({ page: 3, pageCount: 3, firstIndex: 41, lastIndex: 45, total: 45 });
  });
});
```

- [ ] **Step 6: Chạy đỏ vì thiếu module**, rồi viết `issue-slip-list.ts` theo Luật (lấy khung `listPurchaseOrdersPage` làm mẫu), chạy xanh.

- [ ] **Step 7: Commit** `feat(stock): issue-slip status and list page with stocktake rows (BR-INV-012, BR-INV-013)`

---

### Task 3: Chi tiết một phiếu, đơn vị chọn được, phần khác khi sửa

**Files:**
- Create: `lib/stock/issue-slip-detail.ts`, `lib/stock/issue-unit-options.ts`, `lib/stock/issue-slip-edit-diff.ts`
- Test: cùng tên `.test.ts`

**Interfaces:**
- Consumes: Task 2 (`IssueRowRecord`, `IssueSlipRecord`, `StocktakeSessionRecord`, `reversedIssueIds`, `activeSlipLines`, `slipCancellation`, `stocktakeLock`); `PackageLine` từ `@/lib/stock/stocktake-package-lines`; `formatNumber` (`@/lib/shared/format`, dùng `{ withDecimals: true }`).
- Produces:

```ts
// issue-unit-options.ts
export interface IssueUnitOption { key: string; label: string; factor: number; unitName: string }
export const LOOSE_UNIT_KEY = "BASE";
export function buildIssueUnitOptions(baseUnitName: string, packageLines: PackageLine[]): IssueUnitOption[];
export function initialUnitQuantity(baseQuantity: number, options: IssueUnitOption[]): { key: string; quantity: number };
export function toBaseQuantity(quantity: number, option: IssueUnitOption): number;
export function describeQuantity(baseQuantity: number, baseUnitName: string, options: IssueUnitOption[]): string;

// issue-slip-detail.ts
export interface IssueSlipDetailLine {
  issueId: string; purchasedItemId: string; name: string; baseQuantity: number; baseUnitName: string;
  quantityText: string; value: number; unitOptions: IssueUnitOption[];
}
export interface IssueSlipDetail {
  id: string; issuedAt: string; dateText: string; note: string; createdByName: string;
  lines: IssueSlipDetailLine[]; totalValue: number;
  cancellation: { at: string; dateText: string; reason: string } | null;
  lock: { sessionId: string; confirmedAt: string; dateText: string } | null;
  canEdit: boolean;
}
export function buildIssueSlipDetail(input: {
  slip: IssueSlipRecord; issues: IssueRowRecord[]; sessions: StocktakeSessionRecord[];
  items: { id: string; name: string }[]; baseUnitNameByItem: Map<string, string>;
  packageLinesByItem: Map<string, PackageLine[]>; lineValues: Map<string, number>;
}): IssueSlipDetail;

// issue-slip-edit-diff.ts
export interface EditOriginalLine { issueId: string; purchasedItemId: string; baseQuantity: number }
export interface EditDraftLine { issueId: string | null; purchasedItemId: string; baseQuantity: number; removed: boolean }
export type EditDiff =
  | { ok: true; removeIssueIds: string[]; replaceIssueIds: string[]; addLines: { purchasedItemId: string; baseQuantity: number }[] }
  | { ok: false; error: string };
export function diffIssueSlipEdit(original: EditOriginalLine[], draft: EditDraftLine[]): EditDiff;
```

Luật:
- `buildIssueUnitOptions`: mỗi `PackageLine` thành `{ key: conversionId, label: sizeLabel, factor: conversionRate, unitName: purchasedUnitName }`, giữ thứ tự đầu vào; rồi thêm `{ key: "BASE", label: \`${baseUnitName} (lẻ)\`, factor: 1, unitName: baseUnitName }`, **trừ khi** đã có một quy cách `conversionRate === 1` và `purchasedUnitName === baseUnitName` (khi đó quy cách đó chính là đơn vị lẻ, chỉ một lựa chọn). Không có quy cách nào thì chỉ có đơn vị lẻ.
- `initialUnitQuantity`: lựa chọn đầu tiên, `quantity = baseQuantity / factor` (không làm tròn).
- `toBaseQuantity`: `quantity * factor`, làm tròn 6 chữ số thập phân để 0,1 × 3 không thành 0,30000000000000004.
- `describeQuantity`: lựa chọn đầu là quy cách có `factor !== 1` → `"2 Hộp (2.000 ml)"` (tên đơn vị lấy từ `unitName`; số viết bằng `formatNumber(…, { withDecimals: true })`); còn lại → `"1 Xấp"` / `"250 g"`.
- `buildIssueSlipDetail`: dòng = `activeSlipLines`, giữ thứ tự `id`; `value` = `displayMoney(lineValues.get(id) ?? 0)`; `totalValue` = `displayMoney(tổng chính xác)`; `canEdit = !cancellation && !lock`; `lock.dateText` dùng `formatDate` (chỉ ngày), `dateText` và `cancellation.dateText` dùng `formatDateTimeFull`; phiếu đã huỷ trả `lines: []`, `totalValue: 0`.
- `diffIssueSlipEdit`, theo thứ tự:
  1. Dòng nháp có `issueId` không thuộc `original` → `{ ok: false, error: "Dòng không thuộc phiếu này. Tải lại trang rồi sửa lại." }`.
  2. Bỏ qua dòng mới (`issueId === null`) chưa chọn mặt hàng hoặc đã `removed`.
  3. Dòng chưa `removed` có số lượng không hữu hạn hoặc ≤ 0 → `"Dòng N: số lượng phải lớn hơn 0"` (N đếm từ 1 theo thứ tự nháp).
  4. Dòng cũ `removed` → `removeIssueIds`. Dòng cũ đổi số lượng (lệch > 1e-9) → vào `replaceIssueIds` và `addLines` với số mới (sửa 2026-09-29, `BR-INV-013`: dòng cũ trả về kho đúng ngày của phiếu). Dòng mới → `addLines`.
  5. Không còn dòng nào chưa `removed` → `"Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết."`.
  6. Không có gì trong `removeIssueIds`, `replaceIssueIds` lẫn `addLines` → `"Chưa có thay đổi nào."`.

- [ ] **Step 1: Viết test đỏ** (ba file, số thật ISL-00076)

```ts
// issue-unit-options.test.ts
import { describe, expect, it } from "vitest";
import { buildIssueUnitOptions, describeQuantity, initialUnitQuantity, toBaseQuantity } from "./issue-unit-options";
import type { PackageLine } from "@/lib/stock/stocktake-package-lines";

const pkg = (conversionId: string, purchasedUnitName: string, rate: number, base: string): PackageLine => ({
  conversionId, purchasedItemId: "X", purchasedItemName: "X", sizeLabel: `${purchasedUnitName} ${rate.toLocaleString("vi-VN")} ${base}`,
  conversionRate: rate, baseUnitName: base, purchasedUnitName,
});

describe("issue unit options", () => {
  it("Oatside: Hộp 1.000 ml plus loose ml", () => {
    const o = buildIssueUnitOptions("ml", [pkg("QD-044", "Hộp", 1000, "ml")]);
    expect(o).toEqual([
      { key: "QD-044", label: "Hộp 1.000 ml", factor: 1000, unitName: "Hộp" },
      { key: "BASE", label: "ml (lẻ)", factor: 1, unitName: "ml" },
    ]);
    expect(initialUnitQuantity(2000, o)).toEqual({ key: "QD-044", quantity: 2 });
    expect(describeQuantity(2000, "ml", o)).toBe("2 Hộp (2.000 ml)");
  });

  it("Giấy lót chống tràn: Xấp = 1 Xấp is a single option", () => {
    const o = buildIssueUnitOptions("Xấp", [pkg("QD-080", "Xấp", 1, "Xấp")]);
    expect(o).toHaveLength(1);
    expect(describeQuantity(1, "Xấp", o)).toBe("1 Xấp");
  });

  it("half a Túi 500 g of Phin Đậm, typed as 0,5 Túi or as 250 g loose, both send 250", () => {
    const o = buildIssueUnitOptions("g", [pkg("QD-006", "Túi", 500, "g")]);
    expect(toBaseQuantity(0.5, o[0])).toBe(250);
    expect(toBaseQuantity(250, o[1])).toBe(250);
    expect(toBaseQuantity(0.1 * 3, o[1])).toBe(0.3);
  });
});
```

```ts
// issue-slip-edit-diff.test.ts
import { describe, expect, it } from "vitest";
import { diffIssueSlipEdit } from "./issue-slip-edit-diff";

const original = [
  { issueId: "ISS-00192", purchasedItemId: "SPM-038", baseQuantity: 2000 },
  { issueId: "ISS-00196", purchasedItemId: "SPM-070", baseQuantity: 1 },
];
const keep = original.map(l => ({ ...l, removed: false }));

describe("diffIssueSlipEdit", () => {
  it("spec example: drop Giấy lót, Oatside 2000 → 1000", () => {
    expect(diffIssueSlipEdit(original, [
      { ...keep[0], baseQuantity: 1000 }, { ...keep[1], removed: true },
    ])).toEqual({ ok: true, removeIssueIds: ["ISS-00196"], replaceIssueIds: ["ISS-00192"], addLines: [{ purchasedItemId: "SPM-038", baseQuantity: 1000 }] });
  });

  it("adds a new line and ignores an empty added row", () => {
    const d = diffIssueSlipEdit(original, [...keep,
      { issueId: null, purchasedItemId: "SPM-012", baseQuantity: 1000, removed: false },
      { issueId: null, purchasedItemId: "", baseQuantity: 0, removed: false }]);
    expect(d).toEqual({ ok: true, removeIssueIds: [], replaceIssueIds: [], addLines: [{ purchasedItemId: "SPM-012", baseQuantity: 1000 }] });
  });

  it("refuses zero, an emptied slip, no change, and a foreign line", () => {
    expect(diffIssueSlipEdit(original, [{ ...keep[0], baseQuantity: 0 }, keep[1]])).toEqual({ ok: false, error: "Dòng 1: số lượng phải lớn hơn 0" });
    expect(diffIssueSlipEdit(original, keep.map(l => ({ ...l, removed: true })))).toEqual({ ok: false, error: "Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết." });
    expect(diffIssueSlipEdit(original, keep)).toEqual({ ok: false, error: "Chưa có thay đổi nào." });
    expect(diffIssueSlipEdit(original, [...keep, { issueId: "ISS-99999", purchasedItemId: "SPM-038", baseQuantity: 1, removed: false }]))
      .toEqual({ ok: false, error: "Dòng không thuộc phiếu này. Tải lại trang rồi sửa lại." });
  });
});
```

```ts
// issue-slip-detail.test.ts
import { describe, expect, it } from "vitest";
import { buildIssueSlipDetail } from "./issue-slip-detail";
import type { IssueRowRecord } from "./issue-slip-status";

const base = { source: "MANUAL", session_id: null, note: "Khác", created_at: null, reverses_issue_id: null } as const;
const slip = { id: "ISL-00076", issued_at: "2026-09-28T11:20:00Z", note: "Khác", created_by_id: "USR-002", created_by_name: "tuyen2612", created_at: "2026-09-29T03:21:58Z" };
const issues: IssueRowRecord[] = [
  { ...base, id: "ISS-00192", purchased_item_id: "SPM-038", issued_at: slip.issued_at, base_quantity: 2000, issue_slip_id: "ISL-00076" },
  { ...base, id: "ISS-00196", purchased_item_id: "SPM-070", issued_at: slip.issued_at, base_quantity: 1, issue_slip_id: "ISL-00076" },
];
const input = {
  slip, issues, sessions: [{ id: "STK-001", status: "CONFIRMED", confirmed_at: "2026-08-09T15:02:00Z", confirmed_by_name: "admin" }],
  items: [{ id: "SPM-038", name: "Sữa yến mạch Oatside" }, { id: "SPM-070", name: "Giấy lót chống tràn" }],
  baseUnitNameByItem: new Map([["SPM-038", "ml"], ["SPM-070", "Xấp"]]),
  packageLinesByItem: new Map([
    ["SPM-038", [{ conversionId: "QD-044", purchasedItemId: "SPM-038", purchasedItemName: "Sữa yến mạch Oatside", sizeLabel: "Hộp 1.000 ml", conversionRate: 1000, baseUnitName: "ml", purchasedUnitName: "Hộp" }]],
    ["SPM-070", [{ conversionId: "QD-080", purchasedItemId: "SPM-070", purchasedItemName: "Giấy lót chống tràn", sizeLabel: "Xấp 1 Xấp", conversionRate: 1, baseUnitName: "Xấp", purchasedUnitName: "Xấp" }]],
  ]),
  lineValues: new Map([["ISS-00192", 73606.1633], ["ISS-00196", 36404.6]]),
};

describe("buildIssueSlipDetail", () => {
  it("ISL-00076: lines, values, editable", () => {
    const d = buildIssueSlipDetail(input);
    expect(d.lines.map(l => [l.name, l.quantityText, l.value])).toEqual([
      ["Sữa yến mạch Oatside", "2 Hộp (2.000 ml)", 73606], ["Giấy lót chống tràn", "1 Xấp", 36405]]);
    expect(d).toMatchObject({ totalValue: 110011, canEdit: true, cancellation: null, lock: null, createdByName: "tuyen2612" });
  });

  it("a slip dated before STK-001 is locked, not editable", () => {
    const d = buildIssueSlipDetail({ ...input, slip: { ...slip, issued_at: "2026-07-09T14:49:00Z" } });
    expect(d.lock).toMatchObject({ sessionId: "STK-001", dateText: "09/08/2026" });
    expect(d.canEdit).toBe(false);
  });

  it("a returned line is not shown", () => {
    const d = buildIssueSlipDetail({ ...input, issues: [...issues,
      { ...base, id: "ISS-00300", purchased_item_id: "SPM-070", issued_at: "2026-09-30T02:00:00Z", base_quantity: -1, issue_slip_id: null, reverses_issue_id: "ISS-00196" }] });
    expect(d.lines.map(l => l.issueId)).toEqual(["ISS-00192"]);
    expect(d.totalValue).toBe(73606);
  });
});
```

- [ ] **Step 2: Chạy đỏ vì thiếu module** — `npx vitest run lib/stock/issue-unit-options.test.ts lib/stock/issue-slip-edit-diff.test.ts lib/stock/issue-slip-detail.test.ts`.
- [ ] **Step 3: Viết ba file theo Luật.**
- [ ] **Step 4: Chạy xanh.**
- [ ] **Step 5: Commit** `feat(stock): issue-slip detail, unit options with loose base unit, edit diff`

---

### Task 4: Migration 0106 — sửa phiếu, tồn thấp nhất, chặn trước kiểm kê

**Files:**
- Create: `supabase/migrations/0106_issue_slip_edit.sql`
- Test: `tests/migrations/issue-slip-edit-migration.test.ts`

**Interfaces:**
- Produces (SQL):
  - `public.issue_stock_headroom(p_purchased_item_id text, p_at timestamptz) returns numeric` — tồn thấp nhất của mặt hàng tại `p_at` và tại mỗi lần xuất dương sau `p_at`.
  - `public.issue_slip_stocktake_lock(p_issued_at timestamptz) returns text` — mã lần kiểm kê `CONFIRMED` gần nhất nếu `p_issued_at <= confirmed_at` của nó, không thì `null`.
  - `public.edit_issue_slip_atomic(p_slip_id text, p_remove_issue_ids text[], p_replace_issue_ids text[], p_add_lines jsonb, p_created_by_id text, p_created_by_name text) returns jsonb` → `{ slip_id, removed: [{ reversal_issue_id, reverses_issue_id }], added: [{ issue_id, purchased_item_id, base_quantity }] }`.
  - Định nghĩa lại `reverse_manual_issue_atomic`, `cancel_issue_slip_atomic`, `create_issue_slip_atomic` (chữ ký và kết quả trả về **không đổi**).

Đầu file ghi:
- Nguồn: kế hoạch này, spec mục 4 và 6, `BR-INV-013`.
- Liệt kê trigger trên `stock_issues` và `issue_slips`, **suy ra từ chữ migration** (`grep -n "create trigger\|drop trigger" supabase/migrations/*.sql`, lọc hai bảng này), theo mẫu `0062`. Không viết "đã kiểm trên máy chủ".
- Thứ tự lên: code Task 5–8 đẩy lên cùng lúc; hàm mới chưa ai gọi trước khi code lên, ba hàm định nghĩa lại giữ nguyên kết quả trả về, nên chạy migration trước hay sau vài phút đều không làm hỏng máy bán hàng hay trang cũ.

Nội dung:

```sql
create or replace function public.issue_stock_headroom(p_purchased_item_id text, p_at timestamptz)
returns numeric language sql stable security definer set search_path to 'public' as $function$
  -- Lowest balance from p_at to now. Purchases only raise the balance, so the
  -- minimum sits at p_at or right after a later positive issue. Mirrors the
  -- costing engine's order: a purchase at the same instant lands first.
  with points as (
    select p_at as at
    union
    select si.issued_at from public.stock_issues si
    where si.purchased_item_id = p_purchased_item_id and si.issued_at > p_at and si.base_quantity > 0
  )
  select min(
    coalesce((select sum(pol.base_quantity) from public.purchase_order_lines pol
              join public.purchase_orders po on po.id = pol.purchase_order_id
              where po.status = 'COMPLETED' and pol.purchased_item_id = p_purchased_item_id
                and coalesce(po.transaction_date, po.created_at) <= points.at), 0)
    - coalesce((select sum(si.base_quantity) from public.stock_issues si
                where si.purchased_item_id = p_purchased_item_id and si.issued_at <= points.at), 0)
  ) from points;
$function$;

create or replace function public.issue_slip_stocktake_lock(p_issued_at timestamptz)
returns text language sql stable security definer set search_path to 'public' as $function$
  -- The latest CONFIRMED session locks every slip dated on or before its
  -- confirmation (BR-INV-013). An undone session is REVERSED, so it drops out.
  select case when p_issued_at <= latest.confirmed_at then latest.id end
  from (
    select s.id, s.confirmed_at from public.stocktake_sessions s
    where s.status = 'CONFIRMED' and s.confirmed_at is not null
    order by s.confirmed_at desc limit 1
  ) latest
$function$;
```

`edit_issue_slip_atomic` (plpgsql, `security definer`, `set search_path to 'public'`):
1. Kiểm `p_created_by_id`, `p_created_by_name` như `0094`. `p_remove_issue_ids` null → `'{}'`; `p_add_lines` null → `'[]'`. Cả hai rỗng → `raise exception 'Chưa có thay đổi nào.'`.
2. `perform pg_advisory_xact_lock(hashtext('stock_issues:id'));`
3. `select * into v_slip from issue_slips where id = p_slip_id for update;` không có → `'Không tìm thấy phiếu %'`.
4. `v_lock := issue_slip_stocktake_lock(v_slip.issued_at);` khác null → `raise exception 'Phiếu % nằm trước lần kiểm kê % nên không sửa được nữa.', p_slip_id, v_lock;`
5. Đếm dòng còn hiệu lực của phiếu (`issue_slip_id = p_slip_id` và không có dòng nào `reverses_issue_id = id`). Nếu `v_active - (số mã bỏ khác nhau) + jsonb_array_length(p_add_lines) <= 0` → `'Phiếu không còn dòng nào. Huỷ phiếu nếu muốn bỏ hết.'`.
6. Với mỗi mã trong `p_remove_issue_ids` (khác nhau): phải là dòng `MANUAL` của phiếu, chưa bị trả, không thì `'Dòng % không thuộc phiếu % hoặc đã trả về kho'`. Gọi `reverse_manual_issue_atomic(v_id, 'Sửa phiếu ' || p_slip_id, p_created_by_id, p_created_by_name)`, gom `reversal_issue_id`, `reverses_issue_id`.
7. Lấy số `ISS-` kế tiếp **sau** bước 6 (các dòng trả đã dùng số). Với mỗi dòng thêm: kiểm như `0094` dòng 69–80 (thiếu mặt hàng, số ≤ 0, mặt hàng không có); tồn cộng dồn theo mặt hàng như `0094` nhưng giá trị đầu lấy từ `issue_stock_headroom(item, v_slip.issued_at)`; vượt → `raise exception 'Dòng thêm % (%): cần % %, từ % tới nay tồn thấp nhất chỉ còn % %. Muốn xuất thêm thì thêm một dòng riêng cho phần chênh.', …` (ngày viết `to_char(v_slip.issued_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')`, tên đơn vị gốc lấy như `0094` dòng 111–115). Chưa có đơn nhập nào tới lúc đó → câu lỗi như `0094`. Ghi `stock_issues` với `issued_at = v_slip.issued_at`, `note = v_slip.note`, `issue_slip_id = p_slip_id`, `source = 'MANUAL'`.
8. Trả jsonb như Interfaces.

**Đã đổi khi làm (2026-09-29, ba vòng sửa sau soát, tới commit `8c158f8`; code là nguồn đúng, mục này ghi khác biệt so với các bước trên):**
- Thêm tham số `p_replace_issue_ids text[]` (chữ ký 6 tham số: `p_slip_id, p_remove_issue_ids, p_replace_issue_ids, p_add_lines, p_created_by_id, p_created_by_name`). Dòng đổi số lượng đi vào đây; dòng trả của nó ghi **đúng `issued_at` của dòng gốc** (chủ quán chọn "1", `BR-INV-013`), ghi thẳng, không qua `reverse_manual_issue_atomic`. Dòng xoá thuần vẫn qua bước 6, ghi hôm nay.
- Mọi dòng trả được ghi **trước** lần đọc `issue_stock_headroom` đầu tiên, nên phần trả ở ngày của phiếu được tính vào tồn.
- Phiếu không còn dòng hiệu lực (đã huỷ) → `'Phiếu xuất % đã huỷ, không sửa được.'`, trước mọi bước thêm/bớt.
- Mã trống → `'Danh sách dòng bỏ có mã trống.'`; mã trùng (tính gộp bỏ + đổi) → `'Danh sách dòng bỏ có mã trùng nhau.'`.
- Kiểm "chưa có đơn nhập" dùng `coalesce(po.transaction_date, po.created_at)` ở cả tạo lẫn sửa.
- Câu báo thiếu hàng ở cả tạo lẫn sửa: `'Không đủ tồn kho cho %: từ ngày phiếu tới nay có lúc kho chỉ còn % %.'`.

Định nghĩa lại ba hàm cũ — lấy thân **mới nhất** của mỗi hàm (`grep -ln "create or replace function public.<tên>" supabase/migrations/` rồi lấy file số lớn nhất: hiện là `0093` cho `reverse_manual_issue_atomic`, `0063` cho `cancel_issue_slip_atomic`, `0094` cho `create_issue_slip_atomic`), chép nguyên văn, chỉ thêm:
- `reverse_manual_issue_atomic`: ngay sau bước kiểm `source = 'MANUAL'` và chưa bị trả: `if public.issue_slip_stocktake_lock(v_original.issued_at) is not null then raise exception 'Dòng % nằm trước lần kiểm kê % nên không trả về kho được nữa.', v_issue_id, public.issue_slip_stocktake_lock(v_original.issued_at); end if;`
- `cancel_issue_slip_atomic`: trước vòng lặp: đọc `issued_at` của phiếu; khoá → `'Phiếu % nằm trước lần kiểm kê % nên không huỷ được nữa.'`.
- `create_issue_slip_atomic`: (a) `v_remaining` đầu cho mỗi mặt hàng = `issue_stock_headroom(item, p_issued_at)` thay cho phép trừ hai tổng; giữ phép kiểm "chưa có đơn nhập nào". (b) Chủ quán chốt câu 2 = A (2026-09-29): `issue_slip_stocktake_lock(p_issued_at)` khác null → `'Ngày xuất % nằm trước lần kiểm kê % đã chốt. Chọn ngày sau lần kiểm kê.'`.

Quyền: mỗi hàm mới và định nghĩa lại: `revoke all on function … from public, anon, authenticated; grant execute on function … to service_role;` như `0063`.

- [ ] **Step 1: Viết test đỏ** (đọc chữ migration, mẫu `tests/migrations/stocktake-cancel-deletes-migration.test.ts`)

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_FILE = "0106_issue_slip_edit.sql";
const sql = () => readFileSync(resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE), "utf8");
function body(name: string): string {
  const m = sql().match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$function\\$([\\s\\S]*?)\\$function\\$`));
  if (!m) throw new Error(`${name} not defined in ${MIGRATION_FILE}`);
  return m[1];
}

describe("0106: issue-slip edit", () => {
  it("edit dates new lines on the slip and checks stock from then to now", () => {
    const b = body("edit_issue_slip_atomic");
    expect(b).toContain("issue_stock_headroom(");
    expect(b).toContain("v_slip.issued_at");
    expect(b).toContain("issue_slip_id");
    expect(b).toMatch(/reverse_manual_issue_atomic\(/);
    expect(b).toContain("array_position(");            // cumulative per item, as in 0094
  });

  it("edit, reverse, cancel and create all refuse a slip before the last confirmed stocktake", () => {
    for (const fn of ["edit_issue_slip_atomic", "reverse_manual_issue_atomic", "cancel_issue_slip_atomic", "create_issue_slip_atomic"]) {
      expect(body(fn)).toContain("issue_slip_stocktake_lock(");
    }
    expect(body("issue_slip_stocktake_lock")).toContain("'CONFIRMED'");
  });

  it("edit refuses a line that is not an active line of this slip", () => {
    expect(body("edit_issue_slip_atomic")).toContain("không thuộc phiếu");
  });

  it("create checks the lowest balance from its date onward, not only at its date", () => {
    expect(body("create_issue_slip_atomic")).toContain("issue_stock_headroom(");
  });

  it("headroom walks every later positive issue", () => {
    const b = body("issue_stock_headroom");
    expect(b).toContain("si.issued_at > p_at");
    expect(b).toContain("base_quantity > 0");
  });

  it("grants execute to service_role only", () => {
    for (const fn of ["edit_issue_slip_atomic", "issue_stock_headroom", "issue_slip_stocktake_lock"]) {
      expect(sql()).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role`));
    }
  });

  it("header lists triggers from the migration text, not a server check", () => {
    const head = sql().split("\n").slice(0, 40).join("\n");
    expect(head).toMatch(/trigger/i);
    expect(head).not.toMatch(/kiểm trực tiếp trên máy chủ|verified on the server/i);
  });
});
```

- [ ] **Step 2: Chạy đỏ vì thiếu file** — `npx vitest run tests/migrations/issue-slip-edit-migration.test.ts`.
- [ ] **Step 3: Viết migration.** Không chạy lên máy chủ.
- [ ] **Step 4: Chạy xanh; chạy lại `tests/migrations/` cả thư mục** (test cũ của `0093`, `0094` đọc file cũ, không bị ảnh hưởng).
- [ ] **Step 5: Commit** `feat(db): 0106 edit_issue_slip_atomic, stock headroom, block before the last confirmed stocktake (not applied)`

---

### Task 5: Hàm gọi và server action

**Files:**
- Modify: `lib/stock/manual-issue-transaction.ts` (+ test cùng tên nếu có; không có thì tạo `lib/stock/manual-issue-transaction.test.ts`)
- Modify: `app/admin/inventory/issue-slips/actions.ts`, `app/admin/inventory/issue-slips/actions.test.ts`

**Interfaces:**
- Produces:

```ts
// manual-issue-transaction.ts
export type SlipEditResult = {
  slipId: string;
  removed: { reversalIssueId: string; reversesIssueId: string }[];
  added: { issueId: string; purchasedItemId: string; baseQuantity: number }[];
};
export async function editIssueSlipAtomic(input: {
  slipId: string; removeIssueIds: string[]; replaceIssueIds: string[]; addLines: { purchasedItemId: string; baseQuantity: number }[];
  createdById: string; createdByName: string;
}): Promise<SlipEditResult>;   // rpc "edit_issue_slip_atomic"; error → throw new Error(`edit_issue_slip_atomic: ${error.message}`)

// actions.ts ("use server": chỉ export hàm async)
export async function getIssueSlipsPage(filters: IssueSlipListFilters): Promise<IssueSlipListPage>;
export async function getIssueSlipDetail(slipId: string): Promise<IssueSlipDetail | null>;
export async function editIssueSlip(input: { slipId: string; original: EditOriginalLine[]; draft: EditDraftLine[] }):
  Promise<ActionResponse & { result?: SlipEditResult }>;
```

- Cả ba `requireAdmin()`. Đọc: `Issue_Slips`/`issue_slips`, `Stock_Issues`, `stocktake_sessions`, `Purchase_Orders`, `Purchase_Order_Lines`, `Purchased_Items`, `Item_Categories` (thêm `UOM_Conversions`, `Units` cho chi tiết) bằng `findAllNoCache` cho bảng hay đổi, `findAll` cho danh mục — như `app/admin/reports/issued/actions.ts`. Tên khoá bảng: dùng đúng tên mà `lib/db/tables.ts` nhận (kiểm trước, không đoán).
- Giá trị dòng: `computeIssueLineValues(buildIssueCostingPurchases(orders, lines), selectCostedIssues(issues, items, categories).map(r => ({ id: r.id, purchased_item_id: r.purchased_item_id, at: r.issued_at, base_quantity: Number(r.base_quantity) || 0, source: r.source })))`. Tách phần dùng chung ra một hàm không export trong `actions.ts` (hoặc một file `lib/stock/issue-slip-loader.ts` không có `"use server"` nếu cần export).
- Chi tiết: quy cách lấy bằng `buildPackageLines` như `getIssueSlipFormData`; đơn vị gốc lấy như `getIssuedValueReport` (quy đổi `ACTIVE` đầu tiên → `Units`). Không có phiếu → `null`.
- `editIssueSlip`: `diffIssueSlipEdit` lỗi → `fail(error)`; rồi `editIssueSlipAtomic`; thành công `revalidatePath(PATH)` và `revalidatePath(\`${PATH}/${slipId}\`)`; lỗi → `describeActionError`.
- `cancelIssueSlip`: giữ nguyên, thêm `revalidatePath` cho trang chi tiết.
- Thêm `it.todo("Danh sách lý do xuất do chủ quán tự thêm, sửa, ngừng dùng (spec 2026-09-29 mục 0; 72 trên 78 phiếu chọn Khác)")` vào `actions.test.ts`.

- [ ] **Step 1: Test đỏ** — `editIssueSlipAtomic` gửi đúng tham số và đọc kết quả (mock `getSupabaseClient().rpc` như test hiện có của `createIssueSlipAtomic`); `editIssueSlip` trả `fail("Chưa có thay đổi nào.")` khi nháp không đổi và không gọi rpc; `editIssueSlip` với ví dụ spec gọi rpc với `p_remove_issue_ids: ["ISS-00192", "ISS-00196"]`, `p_add_lines: [{ purchased_item_id: "SPM-038", base_quantity: 1000 }]`; `getIssueSlipDetail("ISL-99999")` trả `null`; người không có quyền nhận `fail`. Lỗi rpc chứa "tồn thấp nhất" được trả nguyên câu cho màn hình.
- [ ] **Step 2: Chạy đỏ** (thiếu hàm).
- [ ] **Step 3: Viết code.**
- [ ] **Step 4: Chạy xanh; `npx tsc --noEmit`.**
- [ ] **Step 5: Đo đọc-không-ghi trên dữ liệu thật:** một script tạm trong thư mục scratchpad (không trong `scripts/`) gọi `listIssueSlipsPage` và `buildIssueSlipDetail` với dữ liệu thật; phải ra đúng: 75 dòng ở Tất cả, ISL-00076 = 451.265đ, STK-001 = 34.864.627đ, Đã huỷ = 4 phiếu. Ghi kết quả vào báo cáo.
- [ ] **Step 6: Commit** `feat(issue-slips): list, detail and edit server actions`

---

### Task 6: Trang danh sách (Gemini)

**Files:**
- Modify: `app/admin/inventory/issue-slips/page.tsx`
- Create: `app/admin/inventory/issue-slips/loading.tsx`, `app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx` (+ `IssueSlipsClient.test.tsx`)

**Interfaces:** Consumes `getIssueSlipsPage(filters)` → `IssueSlipListPage` (Task 2). Search params: `q, kind, person, from, to, page`.

Yêu cầu (khuôn Phiếu nhập: đọc `app/admin/inventory/purchase-orders/page.tsx`, `loading.tsx`, `components/PurchaseOrdersClient.tsx` và làm giống; bản mẫu artboard `Main`, `ListPhone`):
- `<h1>Phiếu xuất</h1>` (test `app/admin/page-headings.test.ts` đòi đúng chữ này), chữ nhỏ "Kho" phía trên; `loading.tsx` có cùng tên trang.
- Nút "Tạo phiếu xuất" → `/admin/inventory/issue-slips/new`; điện thoại chiếm hết bề ngang.
- Thanh lọc: Tìm ("Mã phiếu, tên mặt hàng"), Loại (Tất cả `ALL` · Phiếu xuất `SLIP` · Kiểm kê `STOCKTAKE` · Đã huỷ `CANCELLED`), Người ghi (Tất cả + `people`), Từ ngày, Đến ngày (`DayInput`), Lọc, Xoá lọc; Enter lọc; `rangeError` → câu báo như Phiếu nhập.
- Bảng máy tính: Mã phiếu · Ngày xuất · Loại · Người ghi · Giá trị (canh phải, `formatNumber(value)` + "đ"). Nhãn Loại: `SLIP` → "Phiếu xuất · {reason}" (reason trống thì chỉ "Phiếu xuất"); `STOCKTAKE` → "Kiểm kê"; `CANCELLED` → "Đã huỷ". Cả dòng bấm được (`href`).
- Thẻ điện thoại: dòng 1 mã + giá trị; dòng 2 ngày giờ · người ghi + nhãn loại.
- Chân: "{firstIndex}–{lastIndex} trên {total} phiếu", trước/sau/số trang, giữ các lọc khác trong đường dẫn.
- Rỗng: `EmptyState`.
- Màu dùng token có sẵn (không `bg-primary text-white`: test canh chặn).
- Test: hiện đúng nhãn ba loại; bấm dòng STK đi `/admin/inventory/stocktake`; Loại có đúng bốn lựa chọn.

- [ ] Giao Gemini (`agy --model gemini-3.1-pro-high --mode accept-edits -p "…"`, câu mở: "NO shell. Use view_file and edit tools only. APPLY the changes."), kèm đường dẫn file kế hoạch và Task 6.
- [ ] Opus chạy `npx tsc --noEmit`, `npx vitest run app/admin`, soát, commit `feat(ui): Phiếu xuất list page` (kèm dòng "Written by Gemini 3.1 Pro (agy); gates run and committed by Opus.").

---

### Task 7: Trang chi tiết và chế độ sửa (Gemini)

**Files:**
- Create: `app/admin/inventory/issue-slips/[id]/page.tsx`, `[id]/loading.tsx`, `app/admin/inventory/issue-slips/components/IssueSlipDetailClient.tsx` (+ `.test.tsx`)

**Interfaces:** Consumes `getIssueSlipDetail(id)` → `IssueSlipDetail | null` (null → `notFound()`); `getIssueSlipFormData()` cho ô chọn mặt hàng khi thêm dòng (chỉ hàng còn trong kho); `editIssueSlip({ slipId, original, draft })`; `cancelIssueSlip({ slipId, reason })`; `buildIssueUnitOptions`, `initialUnitQuantity`, `toBaseQuantity` (Task 3).

Yêu cầu (bản mẫu artboard `Detail`, `DetailPhone`, `Locked`; spec mục 4):
- Đầu trang: "← Phiếu xuất" quay lại danh sách đúng trang và lọc (đọc `document.referrer` không được; dùng `searchParams.back` do danh sách gắn vào `href`, hoặc `router.back()` khi có lịch sử — chọn một, ghi lý do). Mã phiếu, ngày xuất, lý do, người ghi, tổng giá trị.
- Đã huỷ: nhãn "Đã huỷ", "Lý do huỷ: {reason}" (trống thì bỏ câu), "Huỷ lúc {dateText}"; không nút.
- Khoá: câu "Phiếu nằm trước lần kiểm kê ngày {lock.dateText} nên không sửa được. Sai lệch sẽ được bù ở lần kiểm kê sau." thay cho nút.
- Xem: bảng Mặt hàng · Số lượng (`quantityText`) · Giá trị; điện thoại mỗi dòng một thẻ. Nút "Chỉnh sửa", "Huỷ phiếu" chỉ khi `canEdit`.
- Chế độ sửa:
  - Mỗi dòng: ô đánh dấu, tên, ô **Đơn vị** (`unitOptions`), ô **Số lượng** (cho số lẻ, dấu phẩy thập phân), cột **Quy ra** = `toBaseQuantity` + đơn vị gốc. Dòng cũ mở bằng `initialUnitQuantity`. Ô "chọn tất cả".
  - Dòng cuối bảng: chữ "+ Thêm dòng"; bấm là thêm một dòng mới ngay đó với ô chọn mặt hàng (lấy từ `getIssueSlipFormData`, cùng kiểu ô của trang tạo phiếu); chọn mặt hàng xong mới có ô đơn vị (`buildIssueUnitOptions(item.unitName, item.packageLines)`).
  - Nút chính ở góc dưới: có dòng tick → "Xoá N dòng đã chọn" (đánh dấu `removed`, dòng mờ, bỏ tick); không tick và chưa khác bản gốc → "Lưu thay đổi" mờ; không tick và đã khác → "Lưu thay đổi" bấm được. "Bỏ thay đổi" luôn cạnh bên, đưa về bản gốc.
  - Mọi dòng đều `removed` → hộp "Phiếu không còn dòng nào. Huỷ phiếu này?" Có → hộp lý do huỷ → `cancelIssueSlip`. Không → về chế độ sửa, Lưu mờ tới khi còn ≥ 1 dòng.
  - Lưu → `editIssueSlip` với `baseQuantity = toBaseQuantity(...)`; lỗi → hiện nguyên câu máy chủ trả; xong → thoát chế độ sửa, trang tải lại số mới.
- Hộp huỷ phiếu: ô lý do bắt buộc, nút xác nhận mờ khi trống.
- Không dùng `window.confirm`/`alert`: hộp thoại tự dựng.
- Test: `canEdit=false` thì không có nút; tick 1 dòng thì nút đổi chữ; không đổi gì thì Lưu `disabled`; đổi Oatside sang 1 Hộp thì Quy ra hiện "1.000 ml"; bỏ hết dòng thì hiện câu hỏi huỷ.

- [ ] Giao Gemini như Task 6 (Task 7).
- [ ] Opus chạy cửa kiểm, soát theo bản mẫu, commit.

---

### Task 8: Dời trang tạo phiếu sang `/new` (Gemini)

**Files:**
- Create: `app/admin/inventory/issue-slips/new/page.tsx`, `new/loading.tsx`
- Modify: `app/admin/inventory/issue-slips/components/IssueSlipClient.tsx` (+ hai file test của nó), `app/admin/nav-allowlist.ts`

Yêu cầu:
- `new/page.tsx` gọi `getIssueSlipFormData()` và dựng `IssueSlipClient` (bỏ `recentSlips`).
- `IssueSlipClient`: bỏ phần "phiếu gần đây" và mọi code chỉ phục vụ nó (trả dòng từng dòng); ô quy cách dùng `buildIssueUnitOptions(item.unitName, item.packageLines)` (có "g (lẻ)"), số gửi đi = `toBaseQuantity`; lưu xong `router.push(\`/admin/inventory/issue-slips/${result.slipId}\`)`.
- Tên trang "Tạo phiếu xuất", có "← Phiếu xuất" về danh sách.
- `nav-allowlist.ts`: thêm `{ route: "/admin/inventory/issue-slips/new", reason: "reached from the issue-slips list -- legitimately unlinked" }`.
- Test cũ của `IssueSlipClient` nói về phiếu gần đây: xoá kèm lý do trong thông điệp commit ("recent-slips list removed by spec 2026-09-29 section 5"); test mới: Phin Đậm chọn "g (lẻ)", gõ 250 → gửi 250.

- [ ] Giao Gemini như Task 6 (Task 8).
- [ ] Opus chạy cửa kiểm, commit.

---

### Task 9: Gỡ hai hàm không còn ai gọi (Sonnet)

**Files:** Modify `app/admin/inventory/issue-slips/actions.ts`, `actions.test.ts`.

- [ ] `grep -rn "getRecentIssueSlips\|reverseIssueSlip\b\|IssueSlipRow\b" app lib components` — chỉ còn định nghĩa và test của chúng thì gỡ `getRecentIssueSlips`, `IssueSlipRow`, `RECENT_SLIPS_LIMIT`, `reverseIssueSlip` và test của chúng (lý do: spec mục 5 bỏ danh sách phiếu gần đây; trả từng dòng nay đi qua chế độ sửa). Còn chỗ gọi thì dừng và báo.
- [ ] `reverseManualIssueAtomic` trong `lib/stock/manual-issue-transaction.ts` giữ lại nếu còn chỗ gọi; không còn thì báo, không tự xoá (hàm SQL vẫn được `edit_issue_slip_atomic` và `cancel_issue_slip_atomic` dùng).
- [ ] `npx tsc --noEmit`, `npx vitest run`, commit `refactor(issue-slips): drop the recent-slips reader and per-line reverse action, replaced by the list and edit mode`.

---

### Task 10: Tài liệu, cửa kiểm, soát (Opus)

- [x] `BR-INV-013` đoạn "Stock check on backdated lines" đã ghi ngay khi chủ quán chốt (2026-09-29). Khi code lên: đổi dòng **Status** của `BR-INV-013` từ "Not built yet" sang đã làm, kèm mã commit.
- [ ] `docs/02-rules/business-rules/inventory.md`: ghi chú dưới dòng 166: ISL-00075..78 hiện có là phiếu tạo lại 29/09 cùng số.
- [ ] Spec mục 3: "1–20 trên 79 phiếu" → "1–20 trên 75 phiếu (74 phiếu còn hiệu lực và 1 lần kiểm kê; 4 phiếu đã huỷ ẩn)".
- [ ] `docs/03-workflows/` luồng phiếu xuất (nếu có file) cập nhật đường dẫn `/new` và chế độ sửa.
- [ ] Sinh lại `docs/04-operations/OPEN-ITEMS.md` từ `it.todo` (lệnh sinh lại theo `scripts/`).
- [ ] Chạy đủ: `npx tsc --noEmit`; `npx vitest run`; `npx vite-node scripts/check-rules-current.ts`; `npx vite-node scripts/doc-checks/run-blocking.ts`; `npm run build`; `npx vite-node scripts/verify-cogs.ts` (0 lệch, báo kèm mẫu số).
- [ ] Soát toàn nhánh (`/code-review` hoặc agent `reviewer`).
- [ ] Hỏi chủ quán duyệt riêng từng việc: đẩy code; chạy migration `0106`.
- [ ] Sau khi lên: mở trang sau khi đăng nhập (máy tính và điện thoại), đối chiếu ISL-00076 = 451.265đ, STK-001 = 34.864.627đ; báo chủ quán chỗ cần xem tận mắt (spec mục 8).
