# Khuôn danh sách và chi tiết, đợt 1: mảnh dùng chung + Nhà cung cấp

> **For agentic workers:** UI (`components/ui/`, `app/admin/suppliers/`) goes to Gemini via `agy --model gemini-3.8-flash-high` (CLAUDE.md "Ai viết code"; `agy models` checked 2026-10-02). Backend (`app/admin/suppliers/actions.ts` + test) goes to Sonnet (Agent, model `sonnet`). Gemini cannot run shell in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Đổi trang Nhà cung cấp theo khuôn mới. Bấm dòng thì mở trang chi tiết. Sửa chỉ làm từ trang chi tiết. Xoá làm được ở danh sách (từng dòng, hoặc chọn nhiều) và ở trang chi tiết. Đồng thời dựng các mảnh dùng chung cho các đợt sau.

**Architecture:**
- Mảnh dùng chung đặt ở `components/ui/list/` (danh sách) và `components/ui/detail/` (chi tiết). Chúng là mảnh giao diện thuần, không gọi máy chủ. Hàm xoá được truyền vào từ trang.
- Nhà cung cấp có:
  - Trang chi tiết mới `/admin/suppliers/[id]`.
  - Trang sửa `/admin/suppliers/[id]/edit`, dựng lại cùng khung với trang chi tiết.
  - Danh sách `/admin/suppliers` dùng mảnh chung.
- Phân trang danh sách nhà cung cấp làm ở trình duyệt, 20 dòng một trang. Lý do: chỉ có 48 nhà cung cấp, và trang đang lọc ngay khi gõ.
- Bảng phiếu nhập trong trang chi tiết dùng lại `getPurchaseOrdersPage({ supplier: id, page })`, nên không thêm truy vấn mới.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md`. Mẫu: `app/admin/inventory/issue-slips/components/IssueSlipsClient.tsx`, chi tiết ISL-00083.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay danh sách chỉ có trạng thái "đang xem".
   - Sau đợt này có thêm "đang chọn" (ít nhất 1 ô tick), giữ trong bộ nhớ trang. Đổi trang hoặc đổi bộ lọc thì bỏ chọn.
   - Trang chi tiết là trạng thái mới, đặt bằng địa chỉ `/admin/suppliers/[id]`. Mã không có thì `notFound()`.
   - Trang sửa giữ địa chỉ cũ.
2. **Nút.**
   - **Danh sách:**
     - "+ Thêm nhà cung cấp", ô tìm, "Lọc", "Xoá lọc".
     - Ô tick mỗi dòng và "chọn tất cả" của trang đang xem.
     - Thùng rác cuối dòng.
     - Thanh "Đã chọn N · Xoá N dòng đã chọn · Bỏ chọn".
     - Trên điện thoại có thêm nút "Chọn" để bật ô tick trên thẻ.
     - Ô tick, thùng rác và "Chọn" chỉ hiện khi `canDelete`, tức vai `ADMIN` (`BR-ACCESS-003`, như hiện nay).
     - Bỏ "Xem đơn nhập" và "Sửa" khỏi dòng.
   - **Trang chi tiết:**
     - "← Nhà cung cấp" về `returnTo`.
     - "Chỉnh sửa" sang `/admin/suppliers/[id]/edit?returnTo=…`.
     - "Xoá" chỉ hiện khi `canDelete`.
     - "Xem trong Phiếu nhập" sang `/admin/inventory/purchase-orders?supplier=<id>`.
   - **Trang sửa:** "Lưu thay đổi" và "Bỏ thay đổi". Cả hai về trang chi tiết, kèm cùng `returnTo`.
3. **Danh sách.**
   - Giữ nguyên: mọi nhà cung cấp, tìm theo tên, số điện thoại, địa chỉ.
   - Thứ tự giữ như `getSuppliers()` trả về.
   - Mỗi trang 20 dòng; số trang nằm trên địa chỉ, `?q=&page=`.
   - Cột trên máy tính:
     - Mã.
     - Tên kèm nhãn "Ngừng hợp tác" nếu có.
     - Điện thoại.
     - Địa chỉ: cột phụ, ẩn dưới 1280px.
     - Mã số thuế: cột phụ, ẩn dưới 1280px.
   - Bỏ cột "Ghi chú" khỏi danh sách; ghi chú hiện ở trang chi tiết.
4. **Ô nhập.**
   - Ô tìm như cũ.
   - `page` không phải số nguyên ≥ 1 thì về trang 1. Lớn hơn số trang thì về trang cuối.
   - Ô trong trang sửa giữ luật của `SupplierForm`: tên bắt buộc và tối đa 120 ký tự; câu hỏi "Tên gần giống một mục đã có" giữ nguyên.
   - `returnTo` chỉ nhận `/admin/suppliers`, `/admin/suppliers?…`, hoặc `/admin/suppliers/<mã>` kèm hoặc không kèm `?…`.
5. **Dữ liệu.**
   - Không đổi bảng, không chạy migration.
   - Đổi một server action: `deleteSupplierAction` đếm phiếu nhập của nhà cung cấp trước khi xoá. Có phiếu thì từ chối bằng câu tiếng Việt. Hiện nay khoá ngoại `RESTRICT` từ chối, nhưng người dùng chỉ thấy câu chung "Có lỗi xảy ra…".

Thêm:
- **Ví dụ bằng số thật (đo 2026-10-02):** có 48 nhà cung cấp và 196 phiếu nhập.
  - 46 nhà cung cấp đã có phiếu nhập. Chỉ The Garden Tea & Coffee (NCC-020) và Circle K (NCC-023) chưa có phiếu nào.
  - Chọn 3 dòng Vinamilk (NCC-029, 12 phiếu), The Garden Tea & Coffee, Circle K rồi bấm "Xoá 3 dòng đã chọn":
    - Máy xoá 2 dòng.
    - Báo: "Đã xoá 2 dòng. Không xoá được Vinamilk: đã có 12 phiếu nhập."
    - Danh sách còn 46 dòng: trang 1 có 20, trang 3 có 6.
  - Ví dụ này chỉ để đối chiếu cách hiện. Không ai bấm xoá thật trên máy chủ thật khi nghiệm thu.
- **Trang chi tiết của Vinamilk (NCC-029):**
  - Khối thông tin: Mã, Tên, Điện thoại, Địa chỉ, Mã số thuế, Ghi chú / liên kết, Trạng thái.
  - Bảng "Phiếu nhập" bên dưới gồm 12 phiếu, mới nhất ở trên. Cột: Mã phiếu · Ngày nhập · Nguồn · Trạng thái · Tổng tiền.
  - Bấm một phiếu thì mở trang phiếu đó.
- **Menu:** không thêm mục. Trang chi tiết là trang `[id]`, không vào `app/admin/nav-allowlist.ts`.
- **Tài liệu:** dòng `routes:` của workflow chứa `/admin/suppliers` thêm `/admin/suppliers/[id]`.
- **Phép kiểm canh mới** `app/admin/list-template.test.ts`:
  - Một tệp trong `app/admin` liên kết tới trang sửa (`/edit?`, `` /edit` ``, `/edit"`, `/edit/`) mà không nằm trong thư mục `[id]` thì phải có tên trong danh sách CHỜ.
  - Danh sách CHỜ ghi tên từng trang chưa làm, ngắn dần qua các đợt. Rỗng là xong.
  - Tệp đã hết liên kết mà vẫn nằm trong CHỜ thì test cũng đỏ.

Đã xem:
- `app/admin/suppliers/`: `page.tsx`, `[id]/edit/page.tsx`, `actions.ts`, `SuppliersClient.tsx`, `SupplierForm.tsx` (đầu, `DeleteSupplierButton`), `return-to.ts`.
- `IssueSlipsClient.tsx`.
- `getPurchaseOrdersPage`, `lib/purchasing/purchase-order-list.ts` (dòng 1–80).
- `lib/db/tables.ts` (`remove`), `lib/shared/action-error.ts`, khoá ngoại tới `suppliers` (chỉ có `purchase_orders.supplier_id`).
- Dữ liệu thật đếm 2026-10-02.

Chưa xem:
- `SupplierForm.test.tsx`, `SuppliersClient.test.tsx`, `actions.test.ts`.
- Thân form `SupplierForm.tsx` dòng 80–165.
- `components/ui/PageHeader.tsx`, `BackLink.tsx`, `EmptyState.tsx`.
- `lib/shared/dialog` (`confirm`).

## Global Constraints

- Chữ hiển thị tiếng Việt; code và chú thích tiếng Anh.
- Điện thoại (< 768px): không có bảng ngang, mỗi dòng là một thẻ, vùng bấm 44px.
- Máy tính: bảng thật trải hết bề ngang. Cột phụ ẩn dưới 1280px (`hidden xl:table-cell`).
- Chữ trong ô bảng tối thiểu 13px. 10–11px chỉ cho nhãn tiêu đề cột và nhãn nhỏ.
- Trang chi tiết và trang sửa: khung `max-w-screen-xl mx-auto w-full`. Một cột, mỗi trường một dòng, nhãn trái giá trị phải từ 768px. Không chia 2 cột.
- Khung hỏi có/không dùng `confirm()` của `lib/shared/dialog`, được phép theo `BR-DATA-007`. Kết quả xoá hiện thành dòng chữ trên trang, không bật khung.
- Không dùng `window.confirm` hay `window.alert`. Không dùng `FormModal`, `ModalPortal`, `fixed inset-0` trong `app/admin`.
- Giữ mọi khẳng định của test cũ. Chỉ sửa test cũ chỗ nút "Sửa" hoặc "Xem đơn nhập" đã dời đi, và ghi lý do trong test.

## Review Focus

1. Lọc "vina", sang trang chi tiết, bấm "Chỉnh sửa", Lưu: về trang chi tiết. Bấm "← Nhà cung cấp": danh sách vẫn đang lọc "vina".
2. Bấm vào ô tick hoặc thùng rác: không mở trang chi tiết.
3. Người không phải `ADMIN`: không thấy ô tick, thùng rác, nút "Xoá" ở chi tiết.
4. Xoá từ trang chi tiết thành công: về danh sách đúng bộ lọc. Bị từ chối: ở lại trang, hiện lý do.
5. Gõ tay `/admin/suppliers?page=99`: hiện trang cuối, không trắng trang.

---

### Task 1: Từ chối xoá nhà cung cấp đã có phiếu nhập (Sonnet)

**Files:** sửa `app/admin/suppliers/actions.ts` (`deleteSupplierAction`) và `app/admin/suppliers/actions.test.ts`.

**Interfaces:**
- Produces: `deleteSupplierAction(formData)` trả về:
  - `{ error: "Không xoá được <tên>: đã có <n> phiếu nhập." }` khi `Purchase_Orders` có `supplier_id === id`. Số `n` in theo `formatNumber`.
  - `{ error: "Không tìm thấy nhà cung cấp." }` khi không có mã đó.
  - Còn lại giữ như cũ.

- [ ] Test (đỏ vì giá trị sai: bản cũ gọi `remove` rồi trả lỗi chung). Mock `findAll`:
  - `Suppliers = [{ id: "NCC-029", name: "Vinamilk" }]`, `Purchase_Orders` có 12 dòng `supplier_id: "NCC-029"`.
  - Mong đợi `{ error: "Không xoá được Vinamilk: đã có 12 phiếu nhập." }`, và `remove` không được gọi.
- [ ] Test: nhà cung cấp chưa có phiếu thì `remove("Suppliers", id)` được gọi một lần, trả `ok`.
- [ ] Code: thêm bước kiểm trước `deleteEntity`. Giữ `requireOwner()` đứng đầu.

### Task 2: Mảnh dùng chung cho danh sách (Gemini)

**Files:** tạo trong `components/ui/list/`:
- `paginate.ts` + `paginate.test.ts`
- `ListPageHeader.tsx`
- `FilterCard.tsx`
- `ListPagination.tsx`
- `DataList.tsx` + `DataList.test.tsx`

**Interfaces (Produces):**

```ts
// paginate.ts
export const ROWS_PER_PAGE = 20;
export interface PageSlice<T> { rows: T[]; page: number; pageCount: number; firstIndex: number; lastIndex: number; total: number }
export function paginate<T>(all: T[], rawPage: string | number | undefined, perPage?: number): PageSlice<T>;
// rawPage not an integer >= 1 -> 1; above pageCount -> pageCount; pageCount >= 1 even when empty;
// empty list -> firstIndex 0, lastIndex 0.
export function pageWindow(page: number, pageCount: number): number[]; // at most 5 numbers around page

// ListPageHeader.tsx
export function ListPageHeader(props: { group: string; title: string; action?: React.ReactNode }): JSX.Element;

// FilterCard.tsx -- card around the filter inputs; Enter in an input or select calls onApply
export function FilterCard(props: { children: React.ReactNode; onApply: () => void; onClear: () => void; showClear: boolean }): JSX.Element;

// ListPagination.tsx -- footer "1–20 trên 46 nhà cung cấp", Trước / numbers / Sau as links
export function ListPagination(props: { slice: Omit<PageSlice<unknown>, "rows">; unit: string; pageHref: (page: number) => string }): JSX.Element;

// DataList.tsx
export interface DataColumn<T> { key: string; header: string; render: (row: T) => React.ReactNode; align?: "right"; secondary?: boolean }
export interface RemoveResult { error?: string }
export interface DataListProps<T> {
  rows: T[];                                 // the current page only
  getId: (row: T) => string;
  getName: (row: T) => string;               // used in messages, e.g. "Vinamilk"
  getHref: (row: T) => string;               // whole row / card opens this
  columns: DataColumn<T>[];
  renderCard: (row: T) => React.ReactNode;   // phone card body
  removal?: {                                // omitted -> no tick boxes, no bin
    verb: string;                            // "Xoá" or "Ngừng dùng"
    confirmMessage: (count: number) => string;
    remove: (id: string) => Promise<RemoveResult>;
  };
  empty: React.ReactNode;
}
export function DataList<T>(props: DataListProps<T>): JSX.Element;
```

Cách chạy của `DataList`:
- Máy tính:
  - Bảng có ô tick đầu dòng nếu có `removal`, và một ô "chọn tất cả" ở tiêu đề.
  - Thùng rác ở cột cuối: nút `aria-label="<verb> <tên>"`, tooltip là `verb`.
  - Cả dòng là liên kết bằng lớp `Link` phủ `absolute inset-0`, như `IssueSlipsClient`. Ô tick và thùng rác nằm lớp trên (`relative z-20`) nên bấm vào không mở dòng.
  - Cột `secondary` dùng `hidden xl:table-cell`.
- Điện thoại:
  - Thẻ là `Link`. Thùng rác ở góc phải trên, vùng bấm 44px, nằm ngoài `Link` (đặt tuyệt đối trong một khung `relative`).
  - Nút "Chọn" / "Xong" bật ô tick trên thẻ.
- Xoá:
  - Thùng rác hoặc nút thanh chọn → `confirm({ title: verb, message: confirmMessage(n), variant: "danger" })`.
  - Đồng ý thì gọi `remove` lần lượt từng mã, chờ xong mới gọi mã sau. Thanh hiện "Đang xoá 2/3…".
  - Xong thì hiện một dòng `role="status"` trên bảng:
    - "Đã xoá N dòng."
    - Nếu có lỗi, thêm "Không xoá được <tên>: <lỗi>", mỗi tên một dòng. Lỗi đã có tên ở đầu thì giữ nguyên lỗi, không ghép thêm tên.
  - Bỏ chọn rồi `router.refresh()`.

- [ ] Test `paginate`:
  - 46 dòng, `"3"` → `{ page: 3, pageCount: 3, firstIndex: 41, lastIndex: 46 }`, 6 dòng.
  - `"99"` → trang 3. `"abc"`, `"0"`, `"1.5"`, `undefined` → trang 1.
  - Rỗng → `{ page: 1, pageCount: 1, firstIndex: 0, lastIndex: 0, total: 0 }`.
- [ ] Test `DataList` (đỏ, thiếu module). 3 dòng NCC-029 Vinamilk, NCC-020 The Garden Tea & Coffee, NCC-023 Circle K; `remove` mock: NCC-029 trả `{ error: "Không xoá được Vinamilk: đã có 12 phiếu nhập." }`, còn lại `{}`. Mock `confirm` trả `true`.
  - Tick cả 3 → bấm "Xoá 3 dòng đã chọn" → `remove` gọi đúng 3 lần theo thứ tự → thấy "Đã xoá 2 dòng." và "Không xoá được Vinamilk: đã có 12 phiếu nhập." → `refresh` được gọi.
  - Bấm thùng rác của Circle K → `confirm` được gọi; trả `false` thì `remove` không được gọi.
  - Không truyền `removal` → không có checkbox, không có nút tên bắt đầu bằng "Xoá".
  - Dòng có liên kết `href` bằng `getHref(row)`.
  - Ô tick nằm ngoài phần tử `a` (`closest("a") === null`).

### Task 3: Mảnh dùng chung cho chi tiết (Gemini)

**Files:** tạo trong `components/ui/detail/`:
- `DetailFrame.tsx`
- `DetailHeader.tsx`
- `FieldList.tsx`
- `RemoveRecordButton.tsx` + `RemoveRecordButton.test.tsx`

**Interfaces (Produces):**

```ts
export function DetailFrame(props: { children: React.ReactNode }): JSX.Element; // max-w-screen-xl mx-auto w-full space-y-6
export function DetailHeader(props: { backHref: string; backLabel: string; title: string; subtitle?: React.ReactNode; badge?: React.ReactNode; actions?: React.ReactNode }): JSX.Element;
export interface Field { label: string; value: React.ReactNode }
export function FieldList(props: { fields: Field[] }): JSX.Element; // empty value shows "—"
export function RemoveRecordButton(props: { verb: string; name: string; confirmMessage: string; remove: () => Promise<{ error?: string }>; afterHref: string }): JSX.Element;
```

`FieldList`:
- Khung `bg-surface-card rounded-2xl border`, mỗi trường một dòng có vạch ngăn.
- Từ 768px: lưới `md:grid-cols-[220px_1fr]`, nhãn trái. Dưới 768px: nhãn ở trên.
- Giá trị `""`, `null`, `undefined` hiện "—".

`RemoveRecordButton`:
- Bấm thì `confirm`. Đồng ý thì gọi `remove`.
- Thành công: `router.push(afterHref)` rồi `router.refresh()`.
- Lỗi: hiện `role="alert"` ngay dưới đầu trang, ở lại trang.

- [ ] Test (đỏ, thiếu module):
  - `FieldList` với `{ label: "Mã số thuế", value: "" }` hiện "—".
  - `RemoveRecordButton`:
    - `remove` trả lỗi → thấy lỗi, `push` không được gọi.
    - Trả `{}` → `push(afterHref)` được gọi.

### Task 4: Trang Nhà cung cấp (Gemini)

**Files:**
- Sửa: `app/admin/suppliers/page.tsx`, `components/SuppliersClient.tsx`, `components/SupplierForm.tsx`, `components/return-to.ts`, `[id]/edit/page.tsx`.
- Tạo: `[id]/page.tsx`, `[id]/components/SupplierDetailView.tsx`.
- Test: `SuppliersClient.test.tsx`, `SupplierForm.test.tsx`, `return-to.test.ts`, tạo `[id]/components/SupplierDetailView.test.tsx`.

**Interfaces:**
- Consumes: Task 1 `deleteSupplierAction`; Task 2 `ListPageHeader`, `FilterCard`, `DataList`, `ListPagination`, `paginate`; Task 3 `DetailFrame`, `DetailHeader`, `FieldList`, `RemoveRecordButton`; `getPurchaseOrdersPage(filters)` from `app/admin/inventory/purchase-orders/actions.ts` returning `{ rows: { id; dateText; supplierName; sourceName; status; totalAmount }[]; total; page; pageCount; firstIndex; lastIndex }`.
- Produces:
  - `safeReturnTo(raw)`: nhận thêm `/admin/suppliers/<mã>` (mã khớp `[A-Za-z0-9_-]+`), kèm hoặc không kèm `?…`. `/admin/suppliers/new` vẫn bị loại về `/admin/suppliers`.
  - `SupplierDetailView` props: `{ supplier: DBSupplier; orders: PurchaseOrderListPage; returnTo: string; canDelete: boolean; poPageHref: (page: number) => string }`.

Chi tiết:
- `page.tsx` truyền thêm `initialPage={searchParams?.page}`.
- `SuppliersClient`:
  - Lọc như cũ, rồi `paginate(filtered, page)`.
  - `listUrl(search, page)` chỉ ghi `q` khi có chữ, chỉ ghi `page` khi khác 1. Gõ tìm thì về trang 1.
  - `getHref(s)` là `/admin/suppliers/<encodeURIComponent(id)>?returnTo=<encodeURIComponent(listUrl hiện tại)>`.
  - `removal` chỉ truyền khi `canDelete`:
    - `verb` là "Xoá".
    - `confirmMessage(n)` là "Xoá N nhà cung cấp đã chọn? Nhà cung cấp đã có phiếu nhập sẽ không bị xoá."
    - `remove(id)` gọi `deleteSupplierAction` với `FormData` chứa `id`.
  - Đầu trang `ListPageHeader group="Nhập hàng" title="Nhà cung cấp"`.
  - Ô tìm nằm trong `FilterCard`. Lọc vẫn chạy ngay khi gõ, "Lọc" để giữ khuôn.
- `[id]/page.tsx`:
  - `getSuppliers()` → `find`, không có thì `notFound()`.
  - `getPurchaseOrdersPage({ supplier: id, page: searchParams.poPage })`.
  - `resolveActor()` → `canDelete`.
  - `returnTo = safeReturnTo(searchParams.returnTo)`, nhưng chỉ nhận địa chỉ danh sách: giá trị bắt đầu bằng `/admin/suppliers/` thì dùng `/admin/suppliers`.
- `SupplierDetailView`:
  - `DetailHeader` có `title = supplier.name`, `subtitle = supplier.id`, nhãn "Ngừng hợp tác" nếu `status === "INACTIVE"`.
  - Nút: "Chỉnh sửa" là liên kết `/admin/suppliers/<id>/edit?returnTo=<returnTo>`; `RemoveRecordButton` khi `canDelete`, với `afterHref = returnTo`.
  - `FieldList`: Mã, Tên, Điện thoại, Địa chỉ, Mã số thuế, Ghi chú / liên kết, Trạng thái ("Đang hợp tác" / "Ngừng hợp tác").
  - Mục "Phiếu nhập (N)":
    - Bảng trên máy tính, thẻ trên điện thoại. Bấm dòng thì sang `/admin/inventory/purchase-orders/<poId>`.
    - Dùng `ListPagination` với `unit="phiếu"`.
    - Không có phiếu thì hiện "Chưa có phiếu nhập nào."
    - Liên kết "Xem trong Phiếu nhập".
- `[id]/edit/page.tsx`:
  - Dùng `DetailFrame` + `DetailHeader`: `backHref` là trang chi tiết, `backLabel` là tên nhà cung cấp, `title` là "Chỉnh sửa".
  - Truyền cho `SupplierForm` `returnTo = /admin/suppliers/<id>?returnTo=<encodeURIComponent(list returnTo)>`.
- `SupplierForm`:
  - Bỏ `max-w-2xl`; khung trải theo `DetailFrame`.
  - Mỗi ô một dòng, nhãn trái từ 768px, như `FieldList`.
  - Nút: sửa là "Lưu thay đổi" / "Bỏ thay đổi"; thêm mới giữ chữ cũ.
  - `DeleteSupplierButton` hết người dùng thì xoá khỏi tệp.
  - Không đổi lối từ Phiếu nhập (`returnMode="po"`).
- Trang `new/page.tsx`: bọc bằng `DetailFrame`, đầu trang dùng `DetailHeader`.

- [ ] Test `return-to` (đỏ vì giá trị sai):
  - `safeReturnTo("/admin/suppliers/NCC-029?returnTo=%2Fadmin%2Fsuppliers%3Fq%3Dvina")` trả nguyên giá trị.
  - `safeReturnTo("/admin/suppliers/new")` trả `/admin/suppliers`.
  - `safeReturnTo("https://x.com")` trả `/admin/suppliers`.
- [ ] Test danh sách:
  - `initialSearch="vina"` → dòng Vinamilk có liên kết `/admin/suppliers/NCC-029?returnTo=%2Fadmin%2Fsuppliers%3Fq%3Dvina`.
  - Không có chữ "Sửa", không có "Xem đơn nhập".
  - `canDelete=false` → không có checkbox.
  - 46 nhà cung cấp, `initialPage="3"` → thấy "41–46 trên 46".
- [ ] Test chi tiết (đỏ, thiếu module), Vinamilk với `orders.total = 12`:
  - Thấy "Phiếu nhập (12)".
  - "Chỉnh sửa" trỏ `/admin/suppliers/NCC-029/edit?returnTo=…`.
  - `canDelete=false` thì không có nút "Xoá".
  - Mã số thuế rỗng hiện "—".
- [ ] Test form:
  - `returnTo="/admin/suppliers/NCC-029?returnTo=%2Fadmin%2Fsuppliers"`: "Bỏ thay đổi" thì `push` đúng địa chỉ đó; lưu xong cũng vậy.

### Task 5: Phép kiểm canh, tài liệu (Opus)

- [ ] Viết `app/admin/list-template.test.ts` như mục Thêm. Danh sách CHỜ là 14 tệp đo 2026-10-02:
  - `app/admin/brands/page.tsx`
  - `app/admin/finance/bank-accounts/components/BankAccountsList.tsx`
  - `app/admin/finance/categories/components/CategoriesList.tsx`
  - `app/admin/finance/components/CashEntriesList.tsx`
  - `app/admin/inventory/asset-bands/page.tsx`
  - `app/admin/inventory/categories/page.tsx`
  - `app/admin/inventory/conversions/components/ConversionsClient.tsx`
  - `app/admin/inventory/items/components/ItemsClient.tsx`
  - `app/admin/inventory/units/page.tsx`
  - `app/admin/outlets/components/OutletsList.tsx`
  - `app/admin/products/categories/components/CategoriesClient.tsx`
  - `app/admin/products/components/ProductRowActions.tsx`
  - `app/admin/products/modifiers/components/ModifiersClient.tsx`
  - `app/admin/promotions/components/PromotionsClient.tsx`
  - Cộng tệp `UsersClient` nếu nó liên kết `/admin/users/edit/`. Opus đo lại lúc viết.
- [ ] Chứng minh đỏ: chạy trên bản trước đợt này thì đỏ vì `SuppliersClient.tsx` có liên kết `/edit` mà không có tên trong CHỜ (đỏ vì giá trị sai).
- [ ] Thêm `/admin/suppliers/[id]` vào dòng `routes:` của workflow.
- [ ] Chạy đủ năm lệnh. Mở bằng mắt ở 1568px, 1024px, 390px. Commit.
