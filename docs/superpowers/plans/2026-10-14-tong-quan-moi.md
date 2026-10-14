# Tổng quan mới — kế hoạch dựng

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang Tổng quan chỉ còn báo động ở đầu trang và bảng 7 ngày bên dưới. Kèm ba thứ chủ quán tự quản:
- Loại món;
- Khoản chi hằng tháng;
- Cài đặt Tổng quan.

**Architecture:**
- Một migration chỉ thêm bảng và cột, không đổi hàm nào. Vì thế chạy nó trước code được, khác với trường hợp sự cố `0076`.
- Phần tính toán là hàm thuần trong `lib/dashboard/`, có test bằng số.
- Một hàm nạp dữ liệu phía máy chủ đọc bảng rồi gọi các hàm thuần đó.
- Màn hình dựng theo khuôn sẵn có (`DataList`, `Field`, `Button`, `Table`), mỗi trang có hai bố cục: máy tính và điện thoại.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgREST + `lib/db/tables.ts`), Vitest/jsdom, Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-14-tong-quan-moi-design.md` (chủ quán xác nhận ví dụ 2026-10-14).

## Hiện trạng (năm câu)

1. **Trạng thái.**
   - **Loại món:** có hoặc đã xoá hẳn. Không có cột trạng thái. Đổi so với đặc tả: đặc tả liệt kê cột `status` cho bảng này, nhưng xoá hẳn là đủ, vì khoá ngoại `RESTRICT` đã chặn việc xoá loại còn nhóm món dùng.
   - **Khoản chi hằng tháng:** `ACTIVE` hoặc `INACTIVE`.
     - Đặt bằng nút "Ngừng dùng" / "Dùng lại".
     - Xoá hẳn khi chưa có dòng sổ nào gắn khoản đó. Chỉ `ADMIN` được xoá, chặn bằng `requireOwner()`.
   - **Lời nhắc tháng M** bật khi đủ cả bốn điều kiện:
     - khoản đang `ACTIVE`;
     - tháng M không sớm hơn tháng lập khoản;
     - hôm nay ≥ ngày `reminder_start_day` của tháng M (tháng cũ hơn tháng này luôn đủ điều kiện này);
     - tháng M chưa có dòng `cash_entries` nào có `monthly_item_id` = khoản, `entry_date` trong tháng M và `status` ≠ `CANCELLED`.
   - **Báo động "lâu chưa kiểm kê"** bật khi:
     - phiên `CONFIRMED` mới nhất mà `reversed_at` còn trống có `confirmed_at` cũ hơn `stale_stocktake_days` ngày;
     - hoặc chưa có phiên nào như vậy.
   - **Báo động "phiếu kiểm kê mở dở"** bật khi có phiên `OPEN` có `created_at` cũ hơn `open_stocktake_days` ngày.
2. **Nút.**
   - Tổng quan:
     - mỗi lời nhắc có nút "Nhập", mở `/admin/finance/new?monthlyItem=<id>&returnTo=/admin`;
     - báo động hàng âm mở `/admin/inventory/items`;
     - báo động kiểm kê mở `/admin/inventory/stocktake`;
     - báo động máy bán hàng mở `/admin/pos-sync` (đang có).
   - Loại món: Tạo, Sửa, Xoá theo khuôn danh sách.
   - Khoản chi hằng tháng: Tạo, Sửa, Ngừng dùng / Dùng lại. Nút "Xoá" chỉ hiện với `ADMIN` và chỉ khi khoản chưa có dòng sổ nào.
   - Cài đặt Tổng quan: một nút "Lưu".
   - Không còn bộ lọc thời gian, ô số hay "so với kỳ trước" (`BR-UI-007`, chủ quán 2026-10-14).
3. **Danh sách.**
   - **Bảng 7 ngày:** hôm nay và 6 ngày trước, giờ Sài Gòn, ngày cũ ở trên. Ngày không bán vẫn có dòng ghi 0.
     - Lấy đơn `COMPLETED` mà `superseded_by` trống, ngày theo `created_at`.
     - **Đơn 0đ vẫn tính** (chủ quán 2026-10-14, *"1c"*).
     - Doanh thu = tổng `net_total` của đơn.
     - Ly = các dòng mà nhóm món (lấy từ `product_snapshot_json.category_id`) thuộc loại có `is_drink`.
     - TB mỗi ly = tổng `net_line_total` của dòng ly ÷ số ly, làm tròn tới đồng.
     - Mỗi món đồ ăn chọn trong cài đặt là một cột, ghi số `qty`.
     - Cột "Topping mua riêng" = tổng `qty` của các dòng thuộc loại `topping_type_id`.
     - Loại để trống thì không có cột này. Món đã chọn mà ngừng bán vẫn giữ cột.
   - **Lời nhắc:** mọi tháng còn thiếu của mọi khoản `ACTIVE`, tháng cũ ở trên.
   - **Hàng âm:** mặt hàng có `computeOnHandByPurchasedItem()` < 0. Đo 2026-10-14: 0 trên 148 mặt hàng, nên hôm nay không hiện.
   - **Loại món, Khoản chi:** mọi dòng, sắp theo tên.
3b. **Vì sao báo động kiểm kê sẽ bật ngay.** Đo 2026-10-14: chỉ có một phiên kiểm kê, `STK-001`, xác nhận 09/08/2026, cách hôm nay 66 ngày, quá mốc 30 ngày.
4. **Ô nhập.**
   - `stale_stocktake_days`, `open_stocktake_days`: số nguyên 1–365. Ngoài khoảng thì báo ngay dưới ô "Nhập số từ 1 đến 365".
   - `reminder_start_day`: 1–28, báo "Nhập số từ 1 đến 28".
   - Cột đồ ăn: chọn nhiều món `ACTIVE`, để trống được.
   - Loại món của cột topping: chọn một loại hoặc "Không hiện".
   - Tên loại món, tên khoản chi: bắt buộc, không trùng tên khác (khoản chi chỉ so với khoản `ACTIVE`).
   - Nhóm thu chi của khoản: bắt buộc, chỉ nhóm `kind = 'EXPENSE'` và `ACTIVE`.
   - Nhóm món: thêm ô "Loại món" bắt buộc.
   - Sổ thu chi: thêm ô "Khoản chi hằng tháng", không bắt buộc, chỉ hiện khi nhóm đã chọn là nhóm chi. Mở từ lời nhắc thì điền sẵn khoản và nhóm.
     - Đây là quyết định kỹ thuật của Opus: không có ô này thì chủ quán nhập Tiền điện thẳng ở Sổ thu chi mà lời nhắc vẫn còn.
5. **Dữ liệu.**
   - Có bảng mới, nên phải chạy migration. Chủ quán duyệt riêng, tách khỏi việc đẩy code.
   - Bảng 7 ngày tính lại mỗi lần mở trang, không ghi lại gì. Đổi loại của một nhóm món thì cả 7 ngày tính lại theo loại mới.
   - Cài đặt sửa là áp dụng ngay cho mọi tháng, không ghi lại giá trị cũ.
   - Cố ý không phục vụ:
     - báo giá nhập tăng, báo sắp hết hàng;
     - gắn loại cho từng món;
     - tiền đang có, giờ đông khách, món lâu không bán (chủ quán bác 2026-10-14).

Đã xem:
- `app/admin/page.tsx`, `app/admin/nav-items.ts`;
- `app/admin/products/categories/*`, `app/admin/finance/actions.ts`;
- `lib/stock/purchased-item-onhand.ts`, `supabase/CLAUDE.md`;
- tên cột thật của `stocktake_sessions`, `product_categories`, `cash_entries`, `cash_categories`, `products`, `order_lines_v2`, `orders_v2` (đọc qua PostgREST 2026-10-14).

Chưa xem:
- trigger trên `product_categories` và `cash_entries`. Sonnet liệt kê ở Task 1 theo luật `supabase/CLAUDE.md`;
- `lib/db/tables.ts` chi tiết;
- trang `/admin/finance/new` khi nhận tham số.

## Ví dụ tính sẵn bằng số thật (08/10/2026, đo bằng JavaScript)

- 27 ly, tiền các dòng ly 564.000đ, TB mỗi ly = 564.000 ÷ 27 = 20.888,9 → **20.889**.
- Ví dụ một dòng ly có topping gọi kèm, ngày 13/10: dòng `ol-9cfa013b-d18c-4a04-8d3a-45f9625bb2f7` thuộc đơn `261013001007`.
  - Món Cacao latte 23.000đ, kèm Kem muối 4.000đ, nên `net_line_total` = 27.000.
  - Dòng này tính 1 ly và 27.000đ. Kem muối không phải một cột riêng.
- Ví dụ đơn 0đ, ngày 08/10: đơn `261008001020` có dòng `ol-e9ac7f31-a5f5-4783-b5fc-9071b3a75567`, 1 Cà phê đá, 0đ. Đọc lại trên máy chủ 2026-10-14; `superseded_by` của đơn này là `""`.
  - Dòng này tính 1 ly, 0đ, và nằm trong 27 ly ở trên.
- Ví dụ một dòng đồ ăn, ngày 08/10: dòng `ol-d4df5663-f26a-4a00-b267-3503726beb85` thuộc đơn `261008001001`, 2 Trứng luộc, cộng 2 vào cột Trứng luộc.
- Bảng phải ra đúng như mục 3 của đặc tả:

  | Ngày | Doanh thu | TB mỗi ly | Số ly | Trứng luộc | Khoai lang | Topping mua riêng |
  |---|---|---|---|---|---|---|
  | 08/10 | 714.000 | 20.889 | 27 | 22 | 12 | 0 |
  | 09/10 | 838.000 | 21.344 | 32 | 25 | 14 | 0 |
  | 10/10 | 480.000 | 20.000 | 19 | 19 | 9 | 0 |
  | 11/10 | 30.000 | 15.000 | 2 | 0 | 0 | 0 |
  | 12/10 | 873.000 | 20.848 | 33 | 25 | 18 | 0 |
  | 13/10 | 526.000 | 21.235 | 17 | 22 | 11 | 0 |

- Lời nhắc, ví dụ "Tiền điện" lập ngày 14/10, ngày bắt đầu nhắc là 25:

  | Hôm nay | Dòng Tiền điện trong tháng 10 | Lời nhắc |
  |---|---|---|
  | 24/10 | không có | không có |
  | 25/10 | không có | "Chưa nhập Tiền điện tháng 10/2026" |
  | 31/10 | có dòng ngày 31/10 | không có |
  | 03/11 | không có | vẫn có, ghi "tháng 10/2026" |

## Global Constraints

- Code và chú thích tiếng Anh; chữ hiển thị tiếng Việt, một cách viết (huỷ, xoá, tuỳ, hoá; `BR-UI-001`).
- Số: `formatNumber` (`BR-UI-008`). Tiền: làm tròn bằng `displayMoney` (`BR-DATA-005`).
- Không mở hộp thoại trên trang quản trị (`BR-DATA-007`). Ô nhập nằm trên trang, có/không nằm ngay trong trang.
- Trang tạo có tiêu đề "Tạo …", chỉ viết hoa chữ đầu (`BR-UI-013`); nút tạo ghi "Tạo" (`BR-UI-002`).
- Mọi trang mới có lối vào menu (phép kiểm `app/admin/nav-items.test.ts`) và một tài liệu luồng khai báo đường dẫn (`docs/doc-checks` route-coverage).
- Máy tính và điện thoại hai bố cục riêng (`.claude/rules/ui-devices.md`).
- Gốc `lib/` không chứa file; module mới nằm trong `lib/dashboard/`.
- Không có `shortcut:` comment trong code.

## Review Focus

1. Một đơn bị sửa có hai bản. Chỉ bản có `superseded_by` trống được tính. Không được đếm hai lần.
   - "Trống" là `null` **hoặc** chuỗi rỗng.
   - Đo 2026-10-14 trên 3.475 đơn: 1.211 `null`, 2.240 `""`, 24 có giá trị.
   - Lọc bằng `!o.superseded_by`, như `lib/reports/profit-and-loss.ts:132`. Đừng viết `=== null`.
2. Dòng của nhóm món đã xoá (`CAT-003` Cacao) vẫn phải tính là ly, vì migration gán loại Thức uống cho cả nhóm đã xoá.
3. Đổi mốc ngày theo giờ Sài Gòn: đơn tạo lúc 23:30 ngày 08/10 giờ Sài Gòn (16:30Z) phải vào ngày 08/10, không phải 09/10.
4. Lời nhắc của tháng 2 (28 ngày) với ngày bắt đầu 28, và một khoản lập ngày 30/09 thì không sinh lời nhắc cho tháng 8.
5. Dòng sổ đã huỷ không tắt được lời nhắc. Dòng của khoản khác cùng nhóm thu chi cũng không tắt được.

---

### Task 1: Migration và đăng ký bảng (Sonnet)

**Files:**
- Create: `supabase/migrations/0109_dashboard_settings.sql`
- Create: `tests/migrations/dashboard-settings-migration.test.ts`
- Modify: `lib/db/tables.ts` (đăng ký `Product_Types`, `Monthly_Expense_Items`, `Dashboard_Settings`), `types/db.ts` (kiểu `DBProductType`, `DBMonthlyExpenseItem`, `DBDashboardSettings`; thêm `type_id` vào `DBProductCategory`, `monthly_item_id` vào `DBCashEntry`)
- Modify: `docs/01-system/TABLE-DICTIONARY.md`

**Produces:**
- `product_types(id text pk 'PT-001…', name text not null, is_drink boolean not null default false, created_at timestamptz default now())`, unique `lower(name)`. Seed: `PT-001` Thức uống (is_drink true), `PT-002` Thức ăn, `PT-003` Topping.
- `product_categories.type_id text references product_types(id) on delete restrict`. Backfill: CAT-001, CAT-002, CAT-003, CAT-004, CAT-005 → PT-001; CAT-006 → PT-002; CAT-007 → PT-003; rồi `set not null`. Cột có `default 'PT-001'` để màn hình Tạo nhóm món hiện tại vẫn lưu được trong khoảng giữa lúc chạy migration và lúc Task 5 lên. Task 5 bắt chọn loại nên giá trị mặc định này không còn được dùng tới.
- `monthly_expense_items(id text pk 'KCT-001…', name text not null, cash_category_id text not null references cash_categories(id) on delete restrict, status text not null default 'ACTIVE' check in ('ACTIVE','INACTIVE'), created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name)`, unique `lower(name)` where status = 'ACTIVE'.
- `cash_entries.monthly_item_id text null references monthly_expense_items(id) on delete restrict`.
- `dashboard_settings(id int primary key check (id = 1), stale_stocktake_days int not null default 30 check 1–365, open_stocktake_days int not null default 2 check 1–365, reminder_start_day int not null default 25 check 1–28, food_product_ids text[] not null default '{PROD-028,PROD-027}', topping_type_id text null default 'PT-003' references product_types(id) on delete set null, updated_at, updated_by_id, updated_by_name)` + insert dòng id 1.
- RLS và quyền giống bảng cùng loại gần nhất (Sonnet chép từ migration của `cash_categories`).

- [ ] **Step 1:** Viết test đọc chữ migration, kiểm từng ý ở "Produces" (tên bảng, khoá ngoại `on delete restrict`, check, seed, backfill bảy nhóm, `set not null` đứng sau backfill). Chạy: `npx vitest run tests/migrations/dashboard-settings-migration.test.ts`, mong đợi: FAIL vì chưa có file.
- [ ] **Step 2:** Viết migration. Đầu file liệt kê trigger của `product_categories` và `cash_entries`, suy ra từ chữ migration (grep `create trigger`), ghi đúng nguồn như mẫu `0099`.
- [ ] **Step 3:** Đăng ký bảng và kiểu, sửa TABLE-DICTIONARY. Chạy test, `npx tsc --noEmit`, mong đợi: PASS.
- [ ] **Step 4:** Opus soát, hỏi chủ quán duyệt chạy migration. **Không chạy khi chưa có lời duyệt.**

### Task 2: Bảng 7 ngày (Sonnet)

**Files:**
- Create: `lib/dashboard/seven-day-table.ts`, `lib/dashboard/seven-day-table.test.ts`
- Create: `scripts/verify-dashboard-seven-days.ts` (chỉ đọc)

**Interfaces — Produces:**
```ts
export interface SevenDayRow {
  day: string;                       // "YYYY-MM-DD", Saigon
  revenue: number;                   // sum of orders' net_total
  cups: number;
  cupMoney: number;                  // sum of drink lines' net_line_total
  avgPerCup: number;                 // displayMoney(cupMoney / cups), 0 when cups = 0
  foodQty: Record<string, number>;   // productId -> qty, every chosen id present
  toppingQty: number | null;         // null when no topping type is set
}
export function buildSevenDayTable(input: {
  today: string;                                     // "YYYY-MM-DD" Saigon
  orders: Array<{ id: string; status: string; superseded_by: string | null; created_at: string; net_total: number | string }>;
  lines: Array<{ order_id: string; product_id: string; qty: number | string; net_line_total: number | string; product_snapshot_json: { category_id?: string } | null }>;
  categoryTypeId: Map<string, string>;               // category id -> product type id
  drinkTypeIds: Set<string>;
  foodProductIds: string[];
  toppingTypeId: string | null;
}): SevenDayRow[];                                   // 7 rows, oldest first
```

- [ ] **Step 1:** Viết test đỏ cho:
  - 7 dòng, ngày không bán ra 0;
  - đơn bị thay thế không tính; đơn huỷ không tính; đơn có `superseded_by` là `null` và đơn có `""` đều tính;
  - đơn 0đ có tính;
  - dòng nhóm `CAT-003` tính là ly;
  - mốc 23:30 giờ Sài Gòn;
  - `toppingQty` null khi không có loại;
  - TB 564.000 / 27 ra 20.889.
  
  Chạy, mong đợi: FAIL vì thiếu module.
- [ ] **Step 2:** Viết hàm. Ngày Sài Gòn dùng helper có sẵn trong `lib/shared/datetime.ts`, không tự cộng 7 giờ.
- [ ] **Step 3:** Viết `scripts/verify-dashboard-seven-days.ts`. Script đọc bảng thật, in bảng 08/10–13/10, so với bảng ở mục "Ví dụ" của kế hoạch này, in "0 lệch trên N ô" hoặc liệt kê chỗ lệch. Phép so dùng loại gán sẵn như migration; trước khi migration chạy, script tự dựng bản đồ đó từ danh sách nhóm ở Task 1.
- [ ] **Step 4:** Chạy test và script, mong đợi: PASS, 0 lệch.

### Task 3: Lời nhắc khoản chi hằng tháng (Sonnet)

**Files:** Create `lib/dashboard/monthly-reminders.ts`, `lib/dashboard/monthly-reminders.test.ts`

**Interfaces — Produces:**
```ts
export interface MonthlyReminder { itemId: string; itemName: string; month: string /* "YYYY-MM" */; cashCategoryId: string }
export function computeMonthlyReminders(input: {
  today: string;                                         // "YYYY-MM-DD" Saigon
  reminderStartDay: number;                              // 1–28
  items: Array<{ id: string; name: string; cash_category_id: string; status: string; created_at: string }>;
  entries: Array<{ monthly_item_id: string | null; entry_date: string; status: string }>;
}): MonthlyReminder[];                                   // oldest month first, then item name
```

- [ ] **Step 1:** Viết test đỏ cho:
  - bốn dòng Tiền điện ở mục "Ví dụ";
  - khoản `INACTIVE` không nhắc;
  - dòng `CANCELLED` không tắt lời nhắc;
  - dòng của khoản khác không tắt lời nhắc;
  - khoản lập 30/09 không nhắc tháng 8;
  - tháng 2 với ngày bắt đầu 28;
  - `created_at` là giờ UTC: lấy tháng theo giờ Sài Gòn.
- [ ] **Step 2:** Viết hàm. **Step 3:** Chạy test, mong đợi: PASS.

### Task 4: Báo động (Sonnet)

**Files:** Create `lib/dashboard/alerts.ts`, `lib/dashboard/alerts.test.ts`

**Interfaces — Produces:**
```ts
export interface StocktakeAlerts {
  stale: { lastConfirmedDay: string | null; daysSince: number | null } | null; // null = no alert
  openTooLong: Array<{ id: string; openedDay: string; daysOpen: number }>;
}
export function computeStocktakeAlerts(input: {
  today: string;
  staleDays: number;
  openDays: number;
  sessions: Array<{ id: string; status: string; created_at: string; confirmed_at: string | null; reversed_at: string | null }>;
}): StocktakeAlerts;
export function negativeStockItems(onHand: Map<string, number>, names: Map<string, string>): Array<{ id: string; name: string; qty: number }>;
```

- [ ] **Step 1:** Viết test đỏ cho:
  - `STK-001` xác nhận 09/08, hôm nay 14/10, mốc 30: `daysSince` 66;
  - phiên đã đảo (`reversed_at` có giá trị) không tính;
  - chưa có phiên nào: `lastConfirmedDay` null, vẫn báo;
  - phiên `OPEN` 3 ngày với mốc 2: báo;
  - hàng âm sắp theo tên.
- [ ] **Step 2:** Viết hàm. **Step 3:** PASS.

### Task 5: Thao tác máy chủ (Sonnet, sau khi migration đã chạy)

**Files:**
- Create: `lib/dashboard/dashboard-data.ts`
  - `getDashboardData(): Promise<{ posSyncFailureCount: number; negativeStock: …; stocktake: StocktakeAlerts; reminders: MonthlyReminder[]; table: SevenDayRow[]; foodColumns: Array<{ id: string; name: string }>; toppingColumnName: string | null }>`.
  - Hàm đọc đơn từ `created_at` ≥ 00:00 giờ Sài Gòn của ngày cũ nhất.
- Create: `app/admin/products/types/actions.ts` (+ test):
  - `getProductTypes`, `saveProductType`, `updateProductType`, `deleteProductType`;
  - xoá dùng `requireOwner()`;
  - bị khoá ngoại từ chối thì báo "Loại món đang được dùng ở nhóm: Cà phê, Trà." (liệt kê tên nhóm).
- Modify: `app/admin/products/categories/actions.ts`: `type_id` bắt buộc khi tạo và sửa, báo "Chọn loại món".
- Create: `app/admin/finance/monthly-items/actions.ts` (+ test): danh sách kèm số dòng sổ, tạo, sửa, ngừng / dùng lại, xoá (`requireOwner()`, chỉ khi 0 dòng); nhóm phải là `EXPENSE` và `ACTIVE`.
- Modify: `app/admin/finance/actions.ts`: `addCashEntry`/`updateCashEntry` nhận `monthly_item_id`, rỗng thì `null`. Từ chối khi khoản không `ACTIVE`, báo "Khoản chi hằng tháng không còn dùng".
- Create: `app/admin/dashboard-settings/actions.ts` (+ test): `getDashboardSettings`, `saveDashboardSettings`, kiểm khoảng như mục 4 ở máy chủ.

- [ ] Mỗi hàm: test đỏ trước (giá trị sai, không phải thiếu hàm, khi có thể), rồi code, rồi PASS.

### Task 6: Màn hình (Gemini)

**Files:**
- Rewrite: `app/admin/page.tsx`
  - Từ trên xuống: tiêu đề "Tổng quan", báo động, lời nhắc, bảng 7 ngày.
  - Máy tính: bảng thật, mỗi cột đồ ăn một cột, cột "Topping mua riêng" ở cuối.
  - Điện thoại: mỗi ngày một thẻ, hôm nay ở trên.
- Create các trang theo mẫu `app/admin/products/categories`:
  - `/admin/products/types` (+ `new`, `[id]`, `[id]/edit`);
  - `/admin/finance/monthly-items` (+ `new`, `[id]`, `[id]/edit`);
  - `/admin/dashboard-settings`.
- Modify:
  - `ProductCategoryForm.tsx`: thêm ô "Loại món";
  - `CashEntryForm.tsx`: thêm ô "Khoản chi hằng tháng", điền sẵn từ `?monthlyItem=`;
  - `app/admin/nav-items.ts`:
    - "Loại món" sau "Nhóm món";
    - "Khoản chi hằng tháng" sau "Nhóm thu chi";
    - "Cài đặt Tổng quan" trong nhóm Cài đặt.
- Opus viết test đỏ cho từng trang trước khi giao (chữ, nút, hai bố cục, `formatNumber`).

### Task 7: Tài liệu và dọn (Opus)

- Luật mới:
  - `docs/02-rules/business-rules/sales.md`: thế nào là ly, TB mỗi ly, đơn 0đ có tính;
  - `cash-book.md`: khoản chi hằng tháng và lời nhắc;
  - `screens.md`: bố cục Tổng quan.
  - Mỗi luật kèm ngày chủ quán chốt và test của nó.
- Tài liệu luồng: thêm đường dẫn mới vào `product-catalog.md`, `cash-book.md`, và một khai báo cho `/admin/dashboard-settings`.
- Gỡ phần cũ của Tổng quan. Đo 2026-10-14:
  - `lib/reports/dashboard-periods.ts` (`buildSevenDayChart`, `inSaigonDayRange`, `dashboardQueryStart`) chỉ có `app/admin/page.tsx` đọc. Trang viết lại thì xoá file này cùng `dashboard-periods.test.ts`.
  - `compare-periods.ts`, `CompareLine`, `breakdownRevenueByProduct`, `getSalesTotalsV2` còn được Doanh số, Lãi lỗ và máy bán hàng đọc, nên **giữ**.
  - `app/admin/page.test.tsx` viết lại theo trang mới (Task 6).
- Kế hoạch chung: dòng 3 đổi trạng thái. Xong hẳn thì xoá file kế hoạch này.
- `scripts/verify-dashboard-seven-days.ts` đang dựng bản đồ nhóm → loại bằng tay, vì cột `type_id` chưa có trên máy chủ. Chạy migration xong thì đổi sang đọc `product_categories.type_id` và `product_types.is_drink`.
- Chạy đủ năm lệnh kiểm và `scripts/verify-dashboard-seven-days.ts`.
