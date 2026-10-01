# Khuôn danh sách và chi tiết, đợt 2: Hàng hoá, Phân loại hàng, Đơn vị tính, Bảng quy đổi

> **For agentic workers:** UI goes to Gemini via `agy --model gemini-3.8-flash-high --mode accept-edits` (CLAUDE.md "Ai viết code"; `agy models` checked 2026-10-02). Backend (two delete actions + tests) goes to Sonnet, brief in `docs/superpowers/plans/dot2-backend-brief.md`. Gemini cannot run shell headless; Opus runs tests, proves them red, commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Bốn trang kho theo khuôn đợt 1. Bấm dòng thì mở trang chi tiết. Sửa chỉ từ trang chi tiết. Xoá ở danh sách (từng dòng, hoặc chọn nhiều) và ở trang chi tiết. Lịch sử nhập của một hàng hoá chuyển vào trang chi tiết hàng hoá.

**Architecture:**
- Dùng lại mảnh chung đợt 1: `components/ui/list/*`, `components/ui/detail/*`. Không sửa chúng.
- Bốn trang chi tiết mới: `/admin/inventory/items/[id]`, `/admin/inventory/categories/[id]`, `/admin/inventory/units/[id]`, `/admin/inventory/conversions/[id]`.
- Trang sửa và trang thêm có sẵn, chỉ đổi khung (`DetailFrame` + `DetailHeader`) và chỗ quay về. Không viết lại form (spec §0).
- Trang `/admin/inventory/items/[id]/history` bị gỡ; nội dung của nó (`PurchaseHistoryView`) nằm trong trang chi tiết hàng hoá.
- `safeReturnTo` của kho (`app/admin/inventory/components/return-to.ts`) nhận thêm địa chỉ trang chi tiết `<danh sách>/<mã>` kèm hoặc không kèm `?…`, trừ `new`. Lý do: cả bốn form tự lọc `returnTo` bằng hàm này, nên không mở rộng thì "Lưu" sẽ về danh sách thay vì về trang chi tiết.
- Phân trang làm ở trình duyệt, 20 dòng một trang, như đợt 1.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind, Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` (§4 dòng đợt 2). Mẫu: đợt 1, `app/admin/suppliers/**`, kế hoạch `docs/superpowers/plans/2026-10-02-khuon-trang-dot1-nha-cung-cap.md`.

## Hiện trạng

1. **Trạng thái.**
   - Bốn danh sách hiện chỉ có "đang xem". Sau đợt này có thêm "đang chọn" (ít nhất 1 ô tick), giữ trong bộ nhớ trang; đổi trang hoặc đổi bộ lọc thì bỏ chọn.
   - Trang chi tiết là trạng thái mới, đặt bằng địa chỉ `/[id]`. Mã không có thì `notFound()`. Đơn vị tính có tên bắt đầu `DELETED_` cũng coi như không có, như trang sửa hiện nay.
   - Trang sửa và trang thêm giữ địa chỉ cũ.
2. **Nút.**
   - **Danh sách (cả bốn):** nút tạo ở đầu trang ("+ Thêm Hàng Mua Vào", "+ Phân loại Hàng Hoá", "+ Thêm Đơn vị", "+ Thêm Quy Đổi" — giữ chữ cũ); ô tick mỗi dòng và "chọn tất cả" của trang đang xem; thùng rác cuối dòng; thanh "Đã chọn N · Xoá N dòng đã chọn · Bỏ chọn"; nút "Chọn" trên điện thoại.
     - Ô tick, thùng rác, "Chọn" chỉ hiện khi `canDelete` (vai `ADMIN`, `BR-ACCESS-003`, như hiện nay).
     - Bỏ khỏi dòng: "Sửa", "Lịch sử nhập", "Xóa" (nút chữ).
     - Hàng hoá: giữ nút "Bảng quy đổi" cạnh nút tạo.
     - Hàng hoá và Bảng quy đổi có "Lọc", "Xoá lọc" trong khung lọc. Phân loại hàng và Đơn vị tính hiện không có ô lọc nào, giữ không có.
   - **Trang chi tiết:** "← Hàng hoá" / "← Phân loại hàng" / "← Đơn vị tính" / "← Bảng quy đổi" về `returnTo`; "Chỉnh sửa" sang `/[id]/edit?returnTo=<danh sách>`; "Xoá" chỉ hiện khi `canDelete`.
     - Hàng hoá thêm "Xem trong Bảng quy đổi" sang `/admin/inventory/conversions?q=<tên hàng>`.
     - Phân loại hàng thêm "Xem hàng hoá" sang `/admin/inventory/items?category=<mã>`.
     - Quy đổi: tên hàng hoá là liên kết sang trang chi tiết hàng hoá đó.
   - **Trang sửa:** "Lưu thay đổi"/"Bỏ thay đổi" (chữ của từng form giữ nguyên). Cả hai về trang chi tiết, kèm cùng `returnTo` của danh sách.
   - Chữ nút xoá giữ "Xoá" ở cả bốn trang ("Theo trang"). Không trang nào trong bốn trang có nút ngừng dùng hôm nay.
3. **Danh sách.** Không thêm, không bớt dòng; thứ tự như hàm đọc trả về.
   - Hàng hoá: mọi hàng hoá; lọc theo tên (`q`) và phân loại (`category`), như nay. Cột: Mã · Tên · Phân loại · Quy đổi (cột phụ, ẩn dưới 1280px; mỗi quy đổi một dòng "1 Hộp = 1000 ml").
   - Phân loại hàng: mọi phân loại. Cột: Mã · Tên · Đặc tính.
   - Đơn vị tính: mọi đơn vị trừ tên bắt đầu `DELETED_` (như nay). Cột: Tên · Ghi chú.
   - Bảng quy đổi: mọi quy đổi, kể cả đã ngừng (như nay); lọc theo tên hàng hoá (`q`). Cột: Hàng hoá · Đơn vị mua (kèm nhãn "Chỉ cách mua") · Tỷ lệ · Đơn vị gốc. Quy đổi `INACTIVE` có nhãn "Ngừng dùng" cạnh tên hàng.
   - Số trang và bộ lọc nằm trên địa chỉ: `?q=&category=&page=`.
4. **Ô nhập.**
   - Ô tìm như cũ; Enter hoặc "Lọc" thì lọc (như đợt 1). Phân loại là ô chọn, chọn là lọc ngay (như nay).
   - `page` không phải số nguyên ≥ 1 thì về trang 1; lớn hơn số trang thì về trang cuối (`paginate`).
   - Ô trong trang sửa giữ luật của từng form (tên trùng, khoá đổi đơn vị gốc khi đã có lịch sử — `lib/catalog/unit-lock.ts`).
   - `returnTo` chỉ nhận đúng danh sách đó, `danh sách?…`, hoặc `danh sách/<mã>` kèm hoặc không kèm `?…` (không nhận `new`). Lạ thì về danh sách.
5. **Dữ liệu.** Không đổi bảng, không chạy migration. Đổi hai server action (Sonnet):
   - `deletePurchasedItemAction`: đếm dòng phiếu nhập, lần xuất kho, quy đổi, tài sản của hàng hoá trước khi xoá. Có thì từ chối bằng câu tiếng Việt nêu tên và lý do. Hiện nay khoá ngoại `RESTRICT` từ chối và người dùng chỉ thấy câu chung "Có lỗi xảy ra…".
   - `deleteItemCategory`: đếm hàng hoá thuộc phân loại; có thì từ chối bằng câu tiếng Việt. Hiện nay trả nguyên văn lỗi Postgres (`fail(error.message)`) — tiếng Anh, ra thẳng màn hình.
   - `deleteUnit` đã có câu từ chối tiếng Việt (`findUnitDeleteBlocker`), giữ nguyên. `deleteConversionAction` giữ nguyên (quy đổi đã dùng trong phiếu nhập thì chuyển `INACTIVE`, chưa dùng thì xoá hẳn).

Thêm, riêng cho đợt này:
- **Ví dụ bằng số thật (đo 2026-10-02, truy vấn chỉ đọc):**
  - 151 hàng hoá (đều ACTIVE): 148 đã có dòng phiếu nhập, 69 đã có lần xuất kho, 84 tài sản trỏ tới hàng hoá. **Cả 151 đều có ít nhất 1 quy đổi**, nên hôm nay không hàng hoá nào xoá được; máy chỉ báo câu chung.
  - 3 hàng hoá chưa có phiếu nhập lẫn xuất kho, mỗi cái 1 quy đổi: Túi lọc đa năng 200x300mm (SPM-103), Thảm bar pha chế 300x400mm (SPM-106), Chai xịt (nhựa, 900ml) (SPM-126).
  - Chọn 2 dòng Sữa tươi Mlekovita (SPM-002) và Túi lọc đa năng 200x300mm rồi "Xoá 2 dòng đã chọn". Máy xoá 0 dòng, báo:
    - "Không xoá được Sữa tươi Mlekovita: đã có 5 dòng phiếu nhập, 35 lần xuất kho, 1 quy đổi."
    - "Không xoá được Túi lọc đa năng 200x300mm: đã có 1 quy đổi."
    - Muốn xoá hẳn Túi lọc thì xoá quy đổi QD-117 (1 Túi = 1 Túi, chưa dùng trong phiếu nhập nào) ở Bảng quy đổi trước.
  - 3 phân loại, đều đang dùng: Nguyên liệu (NHH-001, RAW, 56 hàng hoá), Vật tư tiêu hao (NHH-002, CONSUMABLE, 27), Dụng cụ (NHH-003, EQUIPMENT, 68). Xoá Nguyên liệu: "Không xoá được Nguyên liệu: còn 56 hàng hoá thuộc phân loại này."
  - 24 đơn vị, 23 hiện trên danh sách (DELETED_gram bị ẩn) → 2 trang (20 + 3). Chỉ lít (U-004) và Bộ (UNT-002) không có gì trỏ tới.
  - 180 quy đổi (đều ACTIVE, 0 "Chỉ cách mua"), 154 đã dùng trong phiếu nhập → 9 trang.
  - Danh sách hàng hoá 151 dòng → 8 trang (7 × 20 + 11).
  - **Trang chi tiết Sữa tươi Mlekovita (SPM-002):** khối thông tin Mã · Tên · Phân loại (Nguyên liệu) · Tính tồn kho (Có) · Trạng thái (Đang dùng). Bảng "Quy đổi (1)": Hộp · 1000 · ml. Bảng "Lịch sử nhập": 5 phiếu đã hoàn thành, mới nhất ở trên: PO-066 (20/08/2026), PO-029, PO-010, PO-009, PO-008 (27/03/2026). Dòng mới nhất: 60 Hộp × 27.084đ = 1.625.040đ (dòng POL-0086ff53-4002-49a9-a072-dd846e3f8bc9).
  - Ví dụ chỉ để đối chiếu. Không ai bấm xoá thật trên máy chủ thật khi nghiệm thu.
- Truy vấn không cho thấy: ai đang mở trang sửa cùng lúc; số dòng `DELETED_` sẽ có sau này. Hàng có nhiều dòng phiếu nhập nhất có 32 dòng, nhiều quy đổi nhất có 4, nên hai bảng trong trang chi tiết hàng hoá hiện hết, không phân trang.
- **Menu:** không thêm mục. Trang `[id]` không vào `app/admin/nav-allowlist.ts`.
- **Tài liệu:** dòng `routes:` của `docs/03-workflows/inventory-catalog.md` thêm bốn trang `[id]`, bỏ `/admin/inventory/items/[id]/history`.
- **Phép kiểm canh:** bỏ bốn dòng đợt 2 khỏi CHỜ trong `app/admin/list-template.test.ts`.
- **Code chết do đợt này sinh ra, gỡ luôn:** `DeleteBtn` trong `app/admin/inventory/components/InventoryForms.tsx` (chỉ trang Phân loại dùng) và `DeleteBtn` trong `app/admin/inventory/units/UnitForm.tsx` (chỉ trang Đơn vị dùng), cùng `DeleteItemButton`/`DeleteConversionButton` trong hai client cũ. Test "Combo 2" của `DeleteBtn` đơn vị chuyển sang test danh sách đơn vị (lời từ chối hiện đúng), không mất ý.
- **Va chạm với đợt 3 (Tài sản):** `return-to.ts` của kho dùng chung với Tài sản. Thay đổi viết chung cho mọi danh sách kho; người gộp nhánh xử lý nếu đợt 3 sửa cùng chỗ.

Đã xem: bốn trang danh sách, trang thêm, trang sửa, trang lịch sử nhập (mã nguồn); bốn server action xoá; `return-to.ts`; mảnh chung đợt 1; khoá ngoại và số dòng trên máy chủ thật.
Chưa xem: bốn trang trên trình duyệt (người gộp nhánh xem sau khi gộp); bên trong `PurchasedItemForm` ngoài phần ô nhập và nút.

## Review Focus

1. Lưu ở trang sửa phải về trang chi tiết, không về danh sách (form tự lọc `returnTo`).
2. Trang `[id]` máy chủ không được truyền hàm sang component máy khách (lỗi đợt 1).
3. Xoá nhiều dòng mà mọi dòng đều bị chặn: báo từng tên kèm lý do, không báo "Đã xoá 0 dòng" trống.
4. Lọc theo phân loại rồi mở chi tiết rồi quay lại: còn đúng bộ lọc và số trang.
5. Mã lạ trên địa chỉ (`/admin/inventory/items/KHONG-CO`) ra 404.

---

### Task 1 (Sonnet): câu từ chối tiếng Việt cho xoá hàng hoá và xoá phân loại

Brief: `docs/superpowers/plans/dot2-backend-brief.md`.

### Task 2 (Gemini): `returnTo` + Hàng hoá

**Files:**
- Modify: `app/admin/inventory/components/return-to.ts`, `return-to.test.ts`
- Modify: `app/admin/inventory/items/components/ItemsClient.tsx`, `ItemsClient.test.tsx`, `app/admin/inventory/items/page.tsx`
- Create: `app/admin/inventory/items/[id]/page.tsx`, `page.test.tsx`, `[id]/components/ItemDetailView.tsx`, `ItemDetailView.test.tsx`
- Move: `[id]/history/components/PurchaseHistoryView.tsx` (+ test) → `[id]/components/`; delete `[id]/history/page.tsx`
- Modify: `[id]/edit/page.tsx`, `new/page.tsx`, `components/PurchasedItemForm.tsx` (chỉ bỏ `max-w-2xl`)

- [ ] Test trước, chạy đỏ trên bản cũ: `safeReturnTo("/admin/inventory/items/SPM-002?returnTo=x", "/admin/inventory/items")` trả nguyên; `…/items/new` trả danh sách; trang `[id]` không truyền hàm; ItemsClient không còn "Sửa"/"Lịch sử nhập", dòng trỏ `/admin/inventory/items/SPM-002?returnTo=…`; ItemDetailView của SPM-002 có "Quy đổi (1)", "Chỉnh sửa" trỏ `/edit?returnTo=…`, không có "Xoá" khi `canDelete=false`.
- [ ] Gemini làm theo mẫu `app/admin/suppliers/**`.
- [ ] Chạy test xanh, `tsc`.

### Task 3 (Gemini): Phân loại hàng, Đơn vị tính, Bảng quy đổi

**Files:**
- Modify: `app/admin/inventory/categories/page.tsx`; Create `categories/components/CategoriesClient.tsx` (+test), `categories/[id]/page.tsx` (+test), `categories/[id]/components/CategoryDetailView.tsx` (+test); Modify `categories/[id]/edit/page.tsx`, `categories/new/page.tsx`
- Modify: `app/admin/inventory/units/page.tsx`; Create `units/components/UnitsClient.tsx` (+test), `units/[id]/page.tsx` (+test), `units/[id]/components/UnitDetailView.tsx` (+test); Modify `units/[id]/edit/page.tsx`, `units/new/page.tsx`, `units/UnitForm.tsx` (gỡ `DeleteBtn`), `UnitForm.test.tsx`
- Modify: `app/admin/inventory/conversions/components/ConversionsClient.tsx` (+test), `conversions/page.tsx`; Create `conversions/[id]/page.tsx` (+test), `conversions/[id]/components/ConversionDetailView.tsx` (+test); Modify `conversions/[id]/edit/page.tsx`, `conversions/new/page.tsx`
- Modify: `app/admin/inventory/components/InventoryForms.tsx` (gỡ `DeleteBtn`), `CategoryForm.tsx`, `ConversionForm.tsx` (chỉ bỏ `max-w-2xl`)

- [ ] Test trước, chạy đỏ; Gemini làm; chạy xanh.

### Task 4 (Opus): canh, tài liệu, năm cổng, commit

- [ ] Bỏ bốn dòng đợt 2 khỏi CHỜ; sửa dòng `routes:`; chạy đủ năm lệnh; soát diff theo kế hoạch; commit.
