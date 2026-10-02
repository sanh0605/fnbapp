# Trang Tài sản theo món đồ: kế hoạch

> **For agentic workers:** Task 1 (backend: `lib/assets/`, `app/admin/inventory/assets/actions.ts` and their tests) goes to Sonnet via the Agent tool, model `sonnet`. Task 2 (UI: everything under `app/admin/inventory/assets/` except `actions.ts`) goes to Gemini via `agy --model gemini-3.8-flash-high --mode accept-edits` (`agy models` checked 2026-10-02). Gemini cannot run shell headless: Opus runs every test, proves new tests red on the old code, and commits. Task 3 is Opus. Steps use `- [ ]`.

**Goal:** Danh sách Tài sản mỗi dòng một món đồ (gom theo mã hàng hoá). Trang chi tiết của món có các lần mua, các lần thanh lý kèm số tiền dồn vào chi phí, và khấu hao gộp theo tháng. Khi thanh lý, chủ quán chọn lần mua.

**Architecture:**
- Gom và tính trong một module thuần mới `lib/assets/asset-items.ts`. Module này dựng trên `buildAssetSchedule` / `summarizeAsset` hiện có, không đổi cách tính nào.
- `actions.ts` thêm ba hàm đọc. Hai hàm ghi `previewDisposalCharge` / `disposeAsset` giữ nguyên, vẫn nhận mã TS.
- Route `[id]` giờ nhận mã hàng hoá. Mã `TS-…` thì chuyển hướng sang món.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-02-trang-tai-san-design.md` (chủ quán duyệt 2026-10-02). Khuôn chung: `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`.

## Hiện trạng

1. **Trạng thái.**
   - Danh sách: một trạng thái "đang xem". Lọc bằng `?q=` (tìm tên) và `?all=1` (hiện cả món đã thanh lý hết), cộng `?sort=&dir=&page=`.
   - Bỏ `?tab=`: địa chỉ cũ có `tab` thì bỏ qua.
   - Món "đã thanh lý hết" khi `remainingQuantity === 0`. Không lưu cờ nào.
   - Chi tiết `/admin/inventory/assets/[mã hàng]`. Mã `TS-…` thì chuyển hướng 307 sang món. Mã không có hoặc món không còn dòng ACTIVE thì 404.
2. **Nút.**
   - **Danh sách:** "Thời hạn khấu hao" (đầu trang), "Lọc", "Xoá lọc", ô tick, tên cột.
     - Không nút tạo, không thùng rác, không ô chọn nhiều.
   - **Chi tiết:**
     - "← Tài sản" về `returnTo`.
     - "Thanh lý" sang `/[mã hàng]/dispose?returnTo=<chi tiết>`, ẩn khi `remainingQuantity === 0`.
     - "Xem hàng hoá" sang `/admin/inventory/items/[mã hàng]`.
   - **Thanh lý:** "Lưu", "Huỷ", cả hai về chi tiết.
3. **Danh sách.**
   - Mỗi `purchased_item_id` có ít nhất một `assets` ACTIVE thì một dòng. Mặc định loại món đã thanh lý hết.
   - Đo 2026-10-02: 84 dòng ACTIVE → 65 món, 0 món thanh lý hết, nên trang 1–4 có 20 dòng, trang 4 chỉ 5 dòng. 0 dòng thiếu `purchased_item_id`, 0 dòng thiếu `purchase_order_line_id`, 0 món ngừng dùng, 0 tên lệch giữa `name_snapshot` và tên hàng hoá.
4. **Ô nhập.**
   - `q`: cắt khoảng trắng, không phân biệt hoa thường. So bằng `toLocaleLowerCase("vi")`, chứa là khớp.
   - `all`: chỉ `"1"` là bật.
   - `page` ngoài khoảng thì về trang cuối (`paginate`).
   - `sort` lạ thì về mã tăng dần (`parseSort`).
   - Trang thanh lý:
     - `?lot=TS-…` chọn sẵn lần mua đó nếu nó thuộc món và còn hàng. Ngược lại chọn lần cũ nhất còn hàng.
     - Số lượng và ngày giữ luật của `previewDisposalCharge` / `disposeAsset`, áp theo **lần mua đã chọn**.
5. **Dữ liệu.**
   - Chỉ đọc thêm `purchase_order_lines`, `purchased_items`.
   - Không bảng mới, không migration, không ghi mới.
   - Báo cáo lãi lỗ không đổi.

Thêm, riêng cho việc này:
- **Ví dụ tính sẵn (số thật 2026-10-02, đã chạy `buildAssetSchedule`):**
  - Bình bơm (thuỷ tinh, 1300ml, 10ml/lần): một lần mua TS-004, mua 04/04/2026, 2 cái, tổng 411.840đ, 24 tháng. Thanh lý TL-002 1 cái ngày 02/07/2026, lý do trống.
    - Tháng 07/2026: khấu hao 188.760đ; trong đó **tiền dồn do thanh lý 171.600đ** (= 188.760 − 17.160, khấu hao tháng 7 nếu không thanh lý).
    - Từ 08/2026: 8.580đ/tháng.
    - Tổng 24 tháng: 411.840đ.
  - Cốc đong 100ml: ba lần mua.

    | Lần mua | Ngày mua | Mua | Thanh lý |
    |---|---|---|---|
    | TS-025 | 27/03 | 2 | 2 ngày 02/07, "Rơi vỡ" |
    | TS-030 | 08/04 | 2 | 0 |
    | TS-057 | 01/07 | 4 | 0 |

    Dòng danh sách: còn 6 / mua 8, đã thanh lý 2. Tiền dồn do thanh lý của TS-025: 14.583,33đ (= 16.666,67 − 2.083,33).
  - Dụng cụ lọc trà: 5 lần mua, giá một cái 49.000 / 27.983 / 273.484 / 246.000 / 80.792đ. Trang thanh lý chọn sẵn TS-034 (08/04).
- **Tiền dồn do thanh lý, định nghĩa.** Với một lần mua có các lần thanh lý `d1..dn` xếp theo ngày, rồi theo `id`:
  - `charge(di) = chargeForMonth(schedule(d1..di), tháng di) − chargeForMonth(schedule(d1..di−1), tháng di)`.
  - Cộng các `charge` theo lần mua bằng đúng phần chênh của lịch có thanh lý so với lịch không thanh lý, trong các tháng có thanh lý.
- **Đã khấu hao đến nay** của món: cộng `totalCost − remainingValue` các lần mua, cùng cách `getAssetDetail` đang tính.
- **Gỡ.** `getAssetDetail`, `AssetDetail`, `AssetDisposalView`, `AssetCard`, `AssetDetailView` bị thay. Đã xem các chỗ đọc chúng: chỉ có `app/admin/inventory/assets/**` cùng test của chúng, và `docs/03-workflows/assets.md`. `getAssetsData` vẫn giữ, vì `getAssetItemsData` dùng lại phần đọc. Trang thanh lý cũ đọc `getAssetsData`, trang mới đọc `getAssetItemDetail`.
- **Menu:** không đổi, `/admin/inventory/assets` đã có lối vào.

Đã xem: `actions.ts` và test, `lib/assets/asset-depreciation.ts` (`buildAssetSchedule`, `summarizeAsset`, `chargeForMonth`), ba trang hiện có, `DisposeAssetForm`, `lib/db/tables.ts` (`findAll`, `findAllWhere`), số thật qua truy vấn chỉ đọc.
Chưa xem: số dòng `purchase_order_lines`. Dùng `findAllWhere` theo id thay vì đọc cả bảng nên không cần.

## Global Constraints

- Code và chú thích tiếng Anh; chữ hiển thị tiếng Việt. Gọi tên món, không đọc mã cho người dùng ngoài cột "Mã".
- Máy tính dùng bảng thật, điện thoại dùng thẻ, vùng chạm 44px (`.claude/rules/ui-devices.md`).
- Không popup ô nhập (`BR-DATA-007`). Sắp xếp theo `BR-DATA-008`: mặc định theo mã tăng dần.
- Trang máy chủ không truyền hàm sang component máy khách.
- Tiền hiện bằng `formatNumber(Math.round(x))` + "đ". Không làm tròn khi cộng (`data-integrity.md`: tổng hiện ra là tổng chính xác làm tròn).
- Import cùng thư mục viết `./`, khác thư mục viết `@/`.

## Review Focus

1. Món có một lần mua thanh lý hết và lần mua khác còn hàng (Cốc đong 100ml): món vẫn ở danh sách mặc định, "Thanh lý" vẫn hiện, trang thanh lý không cho chọn TS-025. Test ở Task 1 (gom) và Task 2 (trang thanh lý).
2. Hai lần thanh lý cùng một lần mua trong cùng tháng: hai số tiền dồn cộng lại đúng bằng phần chênh của tháng. Test ở Task 1.
3. Đường dẫn cũ `TS-025` (lần mua đã thanh lý hết) vẫn mở được trang món; `/TS-025/dispose` chọn lần cũ nhất còn hàng thay vì TS-025. Test ở Task 2.
4. `?q=` có dấu tiếng Việt và hoa thường ("BÌNH bơm") vẫn khớp. Test ở Task 2.
5. Đổi lần mua trên trang thanh lý thì xem trước gọi lại với đúng mã TS mới, và nút "Lưu" gửi mã đó. Test ở Task 2.

---

### Task 1: Gom theo món và ba hàm đọc (Sonnet)

**Files:**
- Create: `lib/assets/asset-items.ts`, `lib/assets/asset-items.test.ts`
- Modify: `app/admin/inventory/assets/actions.ts`, `app/admin/inventory/assets/actions.test.ts`

**Interfaces — Produces** (Task 2 dựa đúng các tên này):

```ts
// lib/assets/asset-items.ts  (pure, no I/O)
import type { AssetSummary, MonthlyCharge } from "@/lib/assets/asset-depreciation";

export type AssetLotInput = {
  id: string; purchased_item_id: string; purchase_order_id: string | null;
  name_snapshot: string; acquired_date: string; unit_cost: number;
  total_cost: number; quantity: number; term_months: number;
};
export type DisposalRowInput = { id: string; asset_id: string; quantity: number; disposed_date: string; reason: string | null };

export type AssetItemRow = {
  itemId: string;            // purchased_item_id
  name: string;              // purchased_items.name, fallback: newest lot's name_snapshot
  quantity: number;          // sum of lot quantities
  remainingQuantity: number;
  disposedQuantity: number;
  remainingValue: number;    // exact sum, unrounded
  latestAcquiredDate: string;// "YYYY-MM-DD"
  fullyDisposed: boolean;    // remainingQuantity === 0
};
export type AssetLotView = AssetSummary & { purchaseOrderId: string | null; nameSnapshot: string };
export type AssetItemDisposal = {
  id: string; assetId: string; lotAcquiredDate: string;
  quantity: number; disposedDate: string; reason: string; // "" when null
  charge: number;            // exact, see plan "Tiền dồn do thanh lý"
};
export type AssetItemMonth = { month: string; unitsHeld: number; charge: number; disposalCharge: number };
export type AssetItemDetail = {
  item: AssetItemRow & { totalCost: number; chargedToDate: number };
  lots: AssetLotView[];             // acquired_date asc, then id
  disposals: AssetItemDisposal[];   // disposed_date asc, then id
  months: AssetItemMonth[];         // summed over lots, month asc, only charge > 0
};

export function groupAssetItems(lots: AssetLotInput[], disposals: DisposalRowInput[],
  itemNames: Map<string, string>, asOfMonth: string): AssetItemRow[];          // sorted by itemId, natural
export function buildAssetItemDetail(itemId: string, lots: AssetLotInput[], disposals: DisposalRowInput[],
  itemName: string | undefined, asOfMonth: string): AssetItemDetail | null;   // null when no lot for itemId
```

```ts
// app/admin/inventory/assets/actions.ts  ("use server", each starts with requireAdmin like the others)
export async function getAssetItemsData(): Promise<AssetItemRow[]>;
export async function getAssetItemDetail(itemId: string): Promise<AssetItemDetail | null>;
export async function findItemIdForAsset(assetId: string): Promise<string | null>; // null: unknown or INACTIVE
```

Callers pass only ACTIVE lots (filter `status !== "INACTIVE"` in actions, as `getAssetsData` does). `purchase_order_id` is read via `findAllWhere("purchase_order_lines", …)` on the lots' `purchase_order_line_id`s; item names via `findAllWhere("purchased_items", …)`. Check `findAllWhere`'s signature in `lib/db/tables.ts:372` before use.

Remove `getAssetDetail`, `AssetDetail`, `AssetDisposalView` and their tests in the same commit. Keep `getAssetsData`, `previewDisposalCharge`, `disposeAsset` untouched.

- [ ] **Step 1: Write the failing tests** in `lib/assets/asset-items.test.ts`, using the real figures from "Ví dụ tính sẵn":
  - Cốc đong 100ml: three lots TS-025, TS-030, TS-057 (`total_cost` 25.000 real; 35.000 / 55.140 illustrative; `term_months` 12; TS-025 disposed 2 on 2026-07-02 "Rơi vỡ").
    - `groupAssetItems` gives one row `{quantity: 8, remainingQuantity: 6, disposedQuantity: 2, fullyDisposed: false, latestAcquiredDate: "2026-07-01"}`.
    - The detail's single disposal has `charge` ≈ 14583.33 (`toBeCloseTo(…, 2)`).
  - Bình bơm TS-004 (411.840đ, 2 cái, 24 tháng, from 2026-04-04, 1 disposed 2026-07-02, reason null).
    - Disposal `charge` = 171600, `reason` = "".
    - The month 2026-07 has `charge` 188760 and `disposalCharge` 171600.
    - The sum of `months[].charge` = 411840.
  - Two disposals of one lot in the same month: 1 then 1 of a 3-unit lot. The two charges sum to `chargeForMonth(with both) − chargeForMonth(with none)` for that month.
  - An item whose every lot is fully disposed gives `fullyDisposed: true`, `remainingQuantity: 0`.
  - Sorting: item ids `SPM-9`, `SPM-10`, `SPM-101` come out in that order.
  - Name fallback: when `itemNames` lacks the id, use the newest lot's `name_snapshot`.
  - `buildAssetItemDetail` returns `null` for an item with no lots.
  - Lots sort by `acquired_date` then `id`. Note that TS-019 (2026-04-04) sorts after TS-023 (2026-03-27).
- [ ] **Step 2:** Run `npx vitest run lib/assets/asset-items.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3:** Implement `lib/assets/asset-items.ts`.
  - Reuse `buildAssetSchedule`, `summarizeAsset`, `chargeForMonth`.
  - No rounding anywhere.
  - Sort with `localeCompare(…, "vi", { numeric: true })`.
- [ ] **Step 4:** Run the test again. Expected: PASS.
- [ ] **Step 5:** Add to `actions.test.ts`, with the existing `findAllMockFor` pattern extended for `findAllWhere`:
  - `getAssetItemsData` excludes INACTIVE lots.
  - `getAssetItemsData` rejects without reading when `requireAdmin` refuses.
  - `getAssetItemDetail("SPM-…")` attaches `purchaseOrderId` from the line.
  - `getAssetItemDetail` returns `null` for an unknown item.
  - `findItemIdForAsset("TS-…")` gives the item id; it gives `null` for an unknown or INACTIVE lot.
  - Delete the `getAssetDetail` describe block: that function is replaced by `getAssetItemDetail`.
- [ ] **Step 6:** Run `npx vitest run app/admin/inventory/assets/actions.test.ts lib/assets`. The new tests go red first, then implement and they turn PASS.
- [ ] **Step 7:** Run `npx tsc --noEmit`. Expected: errors only in the UI files that still import `getAssetDetail`. Task 2 fixes them. List them in your report.
- [ ] **Step 8:** Do not commit; Opus commits Task 1 and Task 2 together.

### Task 2: Giao diện (Gemini)

**Files:**
- Modify:
  - `app/admin/inventory/assets/page.tsx`
  - `components/AssetsClient.tsx` and its test
  - `[id]/page.tsx` and its test
  - `[id]/dispose/page.tsx`
  - `components/DisposeAssetForm.tsx` and its test
- Create:
  - `[id]/components/AssetItemDetailView.tsx` and its test
  - `[id]/dispose/page.test.tsx`
  - `components/AssetItemCard.tsx`
- Delete:
  - `components/AssetCard.tsx` and its test
  - `[id]/components/AssetDetailView.tsx` and its test

All paths under `app/admin/inventory/assets/`.

**Interfaces — Consumes:** Task 1's `getAssetItemsData`, `getAssetItemDetail`, `findItemIdForAsset`, types `AssetItemRow`, `AssetItemDetail`, `AssetLotView`, `AssetItemDisposal`, `AssetItemMonth`. Unchanged: `previewDisposalCharge(assetId, qty, date)`, `disposeAsset(formData with asset_id)`.

- [ ] **Step 1: Write failing tests**:
  - **List (`AssetsClient.test.tsx`):**
    - The columns are, in order, Mã hàng · Tên · Còn / Đã mua · Đã thanh lý · Giá trị còn lại · Mua gần nhất. "Đã thanh lý" and "Mua gần nhất" are `secondary`.
    - Default order is by item code.
    - A row links to `/admin/inventory/assets/SPM-101?returnTo=…`.
    - `fullyDisposed` rows are hidden unless `?all=1`.
    - `?q=BÌNH bơm` matches "Bình bơm (thuỷ tinh…)".
    - There is no checkbox and no bin.
    - The phone card reads "Còn 1 / mua 2 · Đã thanh lý 1".
  - **Detail (`AssetItemDetailView.test.tsx`):**
    - It shows three tables: "Các lần mua", "Thanh lý", "Khấu hao theo tháng".
    - The disposal row of the Bình bơm example shows "171.600đ".
    - The 07/2026 month shows "gồm 171.600đ thanh lý".
    - An empty reason shows "—".
    - "Thanh lý" is hidden when `remainingQuantity` is 0.
    - "Xem hàng hoá" links to `/admin/inventory/items/SPM-…`.
    - The purchase order id links to `/admin/inventory/purchase-orders/<id>`.
  - **Detail page (`[id]/page.test.tsx`):**
    - No prop is a function.
    - A `TS-004` param redirects to the item, keeping `returnTo`.
    - An unknown code gives 404.
  - **Dispose page and form:**
    - Lots with stock are listed, and the oldest is preselected.
    - `?lot=TS-030` preselects TS-030.
    - `?lot=TS-025` (none left) falls back to the oldest lot with stock.
    - With a single lot, there is no picker.
    - Changing the lot re-calls `previewDisposalCharge` with the new id.
    - Submit sends `asset_id` = the chosen lot.
    - The `/TS-…/dispose` path redirects to `/[item]/dispose?lot=TS-…`.
- [ ] **Step 2:** Opus runs them. Expected: FAIL, because the components are missing or old.
- [ ] **Step 3: Implement.**
  - List, desktop: header "Kho / Tài sản" with the "Thời hạn khấu hao" link. `FilterCard` holds the name search, the "Hiện cả món đã thanh lý hết" checkbox, "Lọc" and "Xoá lọc". `DataList` uses the sort columns, without `removal`, then `ListPagination`.
  - List, phone: cards with a "Sắp xếp" picker.
  - Detail: `DetailFrame`, `DetailHeader`, `FieldList`, then the three tables, each with a desktop table and phone cards (existing `AssetDetailView` shows the pattern).
  - Dispose: the picker is a radio list, 44px rows, each lot reading "Mua dd/mm/yyyy · giá một cái …đ · còn N". The rest stays the current `DisposeAssetForm`. Its asset prop becomes the chosen `AssetLotView`.
- [ ] **Step 4:** Opus runs `npx vitest run app/admin/inventory/assets app/admin/list-template.test.ts` and `npx tsc --noEmit`. Expected: PASS, tsc clean.

### Task 3: Tài liệu, cổng, mắt (Opus)

- [ ] `docs/03-workflows/assets.md`:
  - Add a "Behaviour change — 2026-10-02" line: assets are listed per purchased item, and the detail page and disposal are per item with a lot picker.
  - In `files:`, add `lib/assets/asset-items.ts` only if the flow check requires it.
  - Rewrite five-question item 3 to say "one row per purchased item".
- [ ] Run all five gates. `npm run build` runs in a throwaway worktree (memory `project_build-breaks-dev-server`). `docs/generated/system-map.md` changes that are only line endings get reverted.
- [ ] Measure on real data with a read-only scratch script (scratchpad, never `scripts/`): run `groupAssetItems` over all ACTIVE rows. Expect 65 rows from 84 lots, 0 fully disposed, and the sum of `remainingValue` equal to the sum of `getAssetsData()` `remainingValue` (0 lệch trên 84 dòng).
- [ ] If the dev server is up: open the list, the Bình bơm detail, the Dụng cụ lọc trà detail and the dispose page at 1568, 1024 and 390px. **Never press Lưu.**
- [ ] Commit; remove the two asset items from `UI-FEEDBACK.md`; report to the owner in Vietnamese with what to open.
