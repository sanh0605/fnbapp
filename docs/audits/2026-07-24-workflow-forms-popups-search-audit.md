# Workflow Audit — Forms, Popups, Selects, and Per-Page Search

Date: 2026-07-24
Author: Claude (read-only code audit)
Status: findings + proposals; WF-* items await owner approval before any ROADMAP entry
Trigger: owner's direct questions — form consistency, popup-vs-page preference,
select scalability, and two concrete search scenarios that today have no answer.

## Tóm tắt cho chủ quán

Anh hỏi trúng tầng mà 2 đợt kiểm trước chưa đào: **quy trình thao tác**. Kết quả:

1. **Form đã khá đồng nhất ở lớp đang dùng** (12/14 form dùng chung một khuôn),
   nhưng phát hiện mới: có **9 file form bản cũ đã chết** còn nằm trong code —
   di sản của đợt tổ chức lại thư mục — làm đội bảo trì sửa nhầm chỗ (đã xảy ra
   thật ở đợt kiểm 19/07). Gần 2/3 số "màu tự chế" định thay hóa ra nằm trong
   các file chết này → bài bàn giao dọn dẹp đã được sửa lại: **xóa file chết
   trước, thay màu phần còn sống sau** (ít việc hơn dự kiến).
2. **Popup: anh nói đúng hướng.** Hiện gần như mọi thao tác thêm/sửa đều là
   popup; chỉ duy nhất phiếu nhập hàng có trang riêng. Popup hợp với việc ngắn
   (xác nhận xóa, sửa 2-3 ô); không hợp với form dài (thêm món + size + công
   thức trong 1 popup). Em đề xuất lộ trình chuyển các form phức tạp thành
   trang riêng — có nút quay lại, có đường dẫn gửi được, đỡ lỗi kẹt con trỏ.
3. **Ô chọn (dropdown):** các form nặng dữ liệu đã dùng ô chọn có tìm kiếm
   (7/7 form chính) — nền tốt. Còn ~30 ô chọn thường, đa số là bộ lọc ngắn
   (không sao), nhưng vài chỗ đang gánh danh sách sẽ dày lên (form khuyến mãi,
   bán thành phẩm, tính giá vốn) cần chuyển sang loại có tìm kiếm.
4. **Tìm kiếm theo trang — đây là lỗ hổng thật.** Hai ví dụ của anh hôm nay
   đều **chưa làm được**: (a) muốn xem lịch sử nhập của 1 mặt hàng → phải mở
   từng phiếu nhập một; (b) muốn tìm mặt hàng trong trang nhập hàng → ô tìm
   kiếm chỉ tìm theo mã phiếu và tên nhà cung cấp, không tìm theo tên hàng.
   Em đề xuất gói WF-1 xử lý đúng 2 việc này + bảng "trang nào nên tìm được gì".
5. **Nhận xét gốc của anh là chính xác**: các đợt trước tối ưu "code chạy đúng
   và nhanh", chưa tối ưu "ít thao tác nhất cho việc thật". Em đề xuất đưa
   nguyên tắc thiết kế theo việc thật vào giai đoạn làm đẹp, và dùng các buổi
   đi thử cùng anh để gom tiếp các nhu cầu tiềm ẩn.

## A. Form consistency — live layer good, dead layer misleading

**Live forms (14):** 12 use the shared `FormModal` primitive
(`app/admin/*/components/*Form.tsx` + `components/ui/DeleteConfirmModal.tsx`,
`components/backdated-ledger/{apply,reject}-modal.tsx`). Two exceptions:

- `components/ProductForm.tsx` — custom modal predating `FormModal`; the most
  complex form in the system (product + variants + recipe) not on the shared
  primitive. Unification candidate (or page conversion, see B).
- `app/admin/inventory/purchase-orders/components/PurchaseOrderForm.tsx` —
  full page (`/new`, `/[id]`), the only entity already matching the owner's
  preferred pattern.

**Dead duplicates (evidence: zero `@/components/...` importers, this session's
grep):** `components/ModifierForm.tsx` (known, FE-5), plus
`components/SemiProductForm.tsx`, `components/ProductionForm.tsx`,
`components/UserForm.tsx`, `components/EditUserForm.tsx`,
`components/ProductCategoryForm.tsx`, `components/inventory/PurchasedItemForm.tsx`,
`components/inventory/BaseIngredientForm.tsx`, `components/inventory/ConversionForm.tsx`.
Special case: `components/SupplierForm.tsx` — only its `SupplierModal` export
is live (quick-add supplier inside the PO form); the rest of the file
duplicates `app/admin/suppliers/components/SupplierForm.tsx`.
Implementer must re-verify each with a full-path grep (relative imports too)
before deleting. **UI-CLEAN-1 handoff amended accordingly** — ~42 of the 65
raw-color occurrences sit in these dead/partial files.

## B. Popups vs pages

Current state: every create/edit flow is a modal except purchase orders.
Detail viewers (`OrderDetailModal`, `HistoryModal`) and the order editor
(`OrderEditModal`, the largest modal) are also popups.

Owner preference (2026-07-24): prefer page navigation. Recommended split:

| Keep as popup | Convert to page (redesign phase) |
|---|---|
| Delete/void confirmations, `lib/dialog` alerts | Product create/edit (variants + recipe) |
| 1–4 field quick forms: brand, unit, item category, conversion | Semi-product (recipe editor) |
| Quick-add supplier inside PO form | Production order |
| | Modifier (recipe editor) |
| | Order edit (`OrderEditModal`) → `/admin/orders/[id]/edit` |
| | Order detail → `/admin/orders/[id]` (shareable link, back button) |

Rationale: pages give working back-button/history, shareable URLs, room on
mobile, and remove the whole focus-trap bug class the 07-23 fix patched.
This is structural UI work — belongs to the redesign phase (roadmap item 4),
executed page-by-page with parity checks, not a quick fix now.

## C. Selects / dropdowns

- `SearchableSelect` (client-side filtered combobox) already adopted by all 7
  live data-heavy forms — right pattern, no action needed now.
- Its lists are fully loaded server-side; fine at current scale (48
  ingredients, ~42 products, 55 POs). At ~10x catalog growth, move to a
  server-backed search endpoint — same family as the PERF-2/B2 scaling work.
- **Owner decision (2026-07-24): any select offering ≥10 options must be a
  searchable combobox** — 10 is the owner's stated threshold where a plain
  dropdown starts costing data-entry time. This is now the standing UI rule
  for current work and the redesign phase alike.
- 30 raw `<select>` in `app/` (grep this session): short filter enums (<10
  static options) stay as-is per the rule. Verify-and-convert candidates that
  carry data-driven lists: `PromotionForm` (4 selects), `SemiProductForm` (3),
  `CogsCalculator` (1), `ModifierForm` (2) — conversion folded into
  UI-CLEAN-1 as Item 4 (mechanical: `SearchableSelect` already exists).
- Workflow enhancer for the redesign phase: option rows should carry context
  (unit, current stock, last purchase price) so the user doesn't open a second
  screen to decide.

## D. Per-page search — current vs. should-be

Owner's two scenarios, verified against code:

1. **"Lịch sử nhập hàng của một mặt hàng"** — NOT POSSIBLE today. `ItemsClient`
   searches name/category only; `HistoryModal` covers product price/recipe
   history, not purchases. Only path: open each PO one by one.
2. **"Tìm mặt hàng trong trang nhập hàng"** — NOT POSSIBLE today.
   `PurchaseOrdersClient` search matches `po.id` + supplier name only
   (lines are not searched).

Search matrix (current → proposed):

| Page | Searchable today | Proposed addition |
|---|---|---|
| `/admin/inventory/items` | item name, category | **Per-item purchase history view** (PO lines by item: date, qty, unit cost, supplier, price trend) — WF-1a |
| `/admin/inventory/purchase-orders` | PO id, supplier name | **Item-name search across PO lines** + date range filter — WF-1b |
| `/admin/suppliers` | name/contact | Link each supplier → pre-filtered PO list (filter already exists, just link it) — WF-1c |
| `/admin/reports/stock` | item name | **Per-item movement history** (paginated `Stock_Ledger` drill-down: receipts, sales-consume, adjustments) — WF-2 |
| `/admin/orders` | order code (+date/payment/brand, server-side) | Search by product name within lines (server-side join) — WF-3, lower priority |
| `/admin/activity-log` | (full rebuild already in PERF-2/A2) | — |
| Global quick-search (order/product/ingredient from anywhere) | — | Optional, decide in redesign phase |

WF-1 (a+b+c) is one small, high-value package: all read-only queries over
existing tables (`purchase_order_lines` by item id / by item name), no schema
change, no write path. Engine queries = Codex; UI = Antigravity or bundled.

## E. The meta-point — workflow-first principle

The owner's critique is accurate: audits to date optimized correctness and
speed of existing screens, not task time. Proposed additions to the redesign
phase charter:

1. Each screen is designed from its top real tasks (e.g., items page: "check
   what I paid last time", "see if price is rising", "reorder quickly").
2. Related records must cross-link (item ↔ its POs ↔ supplier ↔ its stock
   movements ↔ orders that consumed it) instead of dead-ending in lists.
3. Latent needs get captured during the W4.3 UAT sessions with the owner —
   each friction moment becomes a WF-* candidate instead of waiting for the
   user to proactively request changes.

## Proposed next steps (await owner approval)

1. **WF-1** — item purchase history + PO item-name search + supplier→PO link
   (small, read-only, immediately answers today's two scenarios).
2. **WF-2** — per-item stock movement history view.
3. Redesign-phase charter gains: popup→page migration list (section B),
   select context upgrade (section C), workflow-first rules (section E).
4. UI-CLEAN-1 amendment is already applied to the handoff (dead-form deletion
   first; token swap only on surviving files).
