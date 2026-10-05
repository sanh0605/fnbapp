# Bỏ khung ô nhập — đợt 2: Thu chi — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm và sửa ở ba màn Sổ thu chi, Nhóm thu chi, Tài khoản ngân hàng mở thành trang riêng thay cho khung bật lên. Lưu hoặc Bỏ thì quay về danh sách, khoảng ngày của Sổ thu chi giữ nguyên.

**Architecture:**
- Sáu trang mới, mỗi màn một cặp `new` và `[id]/edit`. Mỗi cặp dùng chung form cũ, đã gỡ `FormModal`.
- Form nhận `returnTo`. Lưu xong `router.push(returnTo)` rồi `router.refresh()`. Bỏ thì `router.push(returnTo)`.
- Một hàm `safeReturnTo(raw, list)` chung cho cả ba màn, đặt ở `app/admin/finance/components/return-to.ts`.
- Sổ thu chi đã giữ khoảng ngày trên địa chỉ (`?preset=&start=&end=`, `FinanceFilterBar`). Trang danh sách dựng lại địa chỉ đó rồi đưa xuống danh sách làm `returnTo`.

**Tech Stack:** Next.js 14 App Router, React 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` (mục 2; đợt 2 ở mục 4). Luật: `BR-DATA-007`. Mẫu đã làm: đợt 1, `docs/superpowers/plans/2026-10-01-no-popups-wave1-suppliers.md`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay: `CashEntryForm`, `CategoryForm`, `BankAccountForm` mỗi cái giữ `isOpen` để mở, đóng `FormModal`. Nút mở nằm ngay trong form.
   - Sau đợt này: không còn `isOpen`, form luôn hiện trên trang.
     - Trang `new` có form trống. Sổ thu chi mặc định ngày hôm nay (giờ Sài Gòn), như cũ.
     - Trang `edit` có form điền sẵn.
     - Dòng sổ, nhóm, hoặc tài khoản không tồn tại thì 404 (`notFound()`).
     - Dòng sổ đã huỷ (`status === "CANCELLED"`) cũng 404: danh sách không hiện nút Sửa cho dòng đã huỷ, và máy chủ cũng từ chối sửa ("Dòng đã huỷ, không sửa được").
2. **Nút.**
   - "+ Ghi khoản mới", "+ Thêm nhóm", "+ Thêm tài khoản" và mọi nút "Sửa" thành liên kết (`next/link`) sang trang.
   - Trên trang form:
     - `BackLink` "← Sổ thu chi" / "← Nhóm thu chi" / "← Tài khoản ngân hàng" về `returnTo`.
     - "Bỏ" về `returnTo`, không lưu. (Khung cũ gọi nút này là "Huỷ"; đổi thành "Bỏ" cho khớp đợt 1, và để không lẫn với nút "Huỷ" dòng sổ trên danh sách.)
     - Nút lưu giữ chữ cũ: "Lưu" / "Lưu nhóm" / "Lưu tài khoản" ở trang `new`, "Cập nhật" ở trang `edit`.
   - Giữ nguyên, không đổi:
     - "Huỷ" dòng sổ, "Ngừng dùng"/"Dùng lại", "Xoá" (khung hỏi có/không, xoá chỉ ADMIN thấy).
     - Câu hỏi "Đổi cách tính lãi lỗ" trong form nhóm: khung có/không theo `BR-DATA-007`.
3. **Danh sách.** Không đổi những gì ba danh sách hiện, không đổi ai thấy nút nào. Dòng sổ đã huỷ vẫn không có nút Sửa.
4. **Ô nhập.**
   - Mọi ô giữ nguyên tên, luật, và cách khoá: ô "Bên" khoá khi nhóm đã có dòng sổ; ô "Tài khoản" chỉ hiện khi chọn Chuyển khoản; ô tiền là `MoneyInput`.
   - `returnTo` chỉ nhận đúng địa chỉ danh sách của màn đó, có hoặc không kèm `?…`. Giá trị khác hoặc thiếu thì dùng địa chỉ danh sách. Ví dụ với danh sách `/admin/finance`: nhận `/admin/finance?preset=THIS_MONTH`, bỏ `/admin/finance/categories` và `https://evil.example`.
5. **Dữ liệu.** Không đổi server action, không đổi bảng, không migration.
   - Trang `edit` dòng sổ lấy dòng bằng `findById("Cash_Entries", id)`, cùng lúc gọi `getCashCategories()` và `getBankAccounts()`. Hai hàm này có `requireAdmin()`, nên người không đủ quyền vẫn bị chặn như ở trang danh sách.
   - Trang `edit` nhóm tìm trong `getCashCategories()`. `hasEntries` tính giống `categories/page.tsx`: có dòng `Cash_Entries` nào (kể cả đã huỷ) trỏ tới nhóm này.
   - Trang `edit` tài khoản tìm trong `getBankAccounts()`.

Thêm:
- **Đang gõ dở mà bấm Bỏ hoặc ←:** mất, giống đóng khung hiện nay (spec mục 1).
- **Menu:** ba trang `new` thêm vào `app/admin/nav-allowlist.ts`. Trang có `[id]` thì phép kiểm menu không đòi.
- **Tài liệu:** `docs/03-workflows/cash-book.md` dòng `routes:` thêm sáu địa chỉ mới.
- **Địa chỉ `/admin/finance/[id]/edit`** không đụng `/admin/finance/categories` hay `/admin/finance/bank-accounts`: Next.js ưu tiên thư mục tên cố định trước `[id]`, và trang sửa nằm sâu thêm một cấp `edit`.

Đã xem:
- `app/admin/finance/page.tsx`, `actions.ts` (phần đọc), `components/CashEntryForm.tsx`, `CashEntriesList.tsx` (chỗ nút Sửa, Huỷ), `FinanceFilterBar.tsx`.
- `app/admin/finance/categories/page.tsx`, `components/CategoryForm.tsx`, `CategoriesList.tsx` (chỗ nút Sửa), `page.test.ts`, `CategoryForm.test.tsx`.
- `app/admin/finance/bank-accounts/page.tsx`, `components/BankAccountForm.tsx`, `BankAccountsList.tsx` (chỗ nút Sửa).
- `lib/db/tables.ts` `findById`. Trang đợt 1 `app/admin/suppliers/new/page.tsx`, `app/admin/suppliers/[id]/edit/page.tsx`.

Chưa xem: phần ghi của ba file `actions.ts` ngoài tên hàm; `CashEntryForm.test.tsx`, `BankAccountForm.test.tsx` ngoài vài dòng đầu.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Import cùng thư mục viết tương đối, khác thư mục viết `@/...`.
- Máy tính và điện thoại đều dùng được (`.claude/rules/ui-devices.md`): form một cột, nút cao tối thiểu 44px trên điện thoại.
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).
- Không thêm tính năng ngoài kế hoạch.

## Review Focus

1. Sửa một dòng sổ khi đang xem "Tháng trước": lưu xong phải về đúng "Tháng trước", không về tháng này.
2. Gõ tay địa chỉ sửa một dòng sổ đã huỷ: phải 404, không mở form.
3. Sửa nhóm đã có dòng sổ: ô "Bên" vẫn khoá trên trang mới.
4. Trên điện thoại: nút Sửa trong thẻ vẫn bấm được (vùng bấm 44px), form không tràn ngang.
5. Lưu bị máy chủ từ chối (tên trùng, số tiền 0): dòng đỏ hiện trên trang, không rời trang.

---

### Task 1: `safeReturnTo` chung cho Thu chi

**Files:** Create `app/admin/finance/components/return-to.ts`, `app/admin/finance/components/return-to.test.ts`.

**Produces:** `export type FinanceList = "/admin/finance" | "/admin/finance/categories" | "/admin/finance/bank-accounts";` và `export function safeReturnTo(raw: string | undefined | null, list: FinanceList): string`.

- [ ] Test (đỏ vì thiếu module):
  - thiếu, rỗng → `list`;
  - `"/admin/finance"` và `"/admin/finance?preset=LAST_MONTH"` với list `/admin/finance` → giữ nguyên;
  - `"/admin/finance/categories"` với list `/admin/finance` → `/admin/finance`;
  - `"https://evil.example"`, `"//evil.example"` → `list`;
  - `"/admin/finance/bank-accounts?x=1"` với list `/admin/finance/bank-accounts` → giữ nguyên.
- [ ] Code: `if (!raw) return list; if (raw === list || raw.startsWith(\`${list}?\`)) return raw; return list;`

### Task 2: Tài khoản ngân hàng

**Files:**
- Modify `app/admin/finance/bank-accounts/components/BankAccountForm.tsx`, `BankAccountsList.tsx`, `BankAccountForm.test.tsx`, `../page.tsx`.
- Create `app/admin/finance/bank-accounts/new/page.tsx`, `app/admin/finance/bank-accounts/[id]/edit/page.tsx`.

- [ ] Test form (đỏ vì khung đang đóng): `render(<BankAccountForm returnTo="/admin/finance/bank-accounts" />)` thì thấy ngay ô "Tên gợi nhớ", không cần bấm gì. Bấm "Bỏ" thì `push("/admin/finance/bank-accounts")`. Sửa test cũ (M6) cho hợp: bỏ bước bấm mở khung. Mock `useRouter` trả `{ push, refresh }`.
- [ ] Test danh sách: nút Sửa của tài khoản `BA-001` là liên kết `href="/admin/finance/bank-accounts/BA-001/edit"` (danh sách này không có bộ lọc nên không cần `returnTo`).
- [ ] Code form: bỏ `isOpen`, nút mở, `FormModal`. Bọc form trong thẻ giống `SupplierForm` đợt 1 (`bg-surface-card rounded-2xl border border-border p-6 max-w-2xl`), nút Bỏ và nút lưu ở cuối form (`flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border`). Prop mới `returnTo?: string`, qua `safeReturnTo(raw, "/admin/finance/bank-accounts")`.
- [ ] Code danh sách: hai chỗ `<BankAccountForm account={account} />` thành `<Link href={\`/admin/finance/bank-accounts/${encodeURIComponent(account.id)}/edit\`}>Sửa</Link>`, cùng class chữ cũ.
- [ ] Trang danh sách: `actions` thành `<Link href="/admin/finance/bank-accounts/new">+ Thêm tài khoản</Link>` cùng class nút cũ, thêm `inline-flex items-center justify-center min-h-[44px]`.
- [ ] Trang `new`: `BackLink` "Tài khoản ngân hàng", `PageHeader` "Thêm tài khoản ngân hàng", form.
- [ ] Trang `edit`: `getBankAccounts()` rồi `find`, không có thì `notFound()`. `PageHeader` "Sửa tài khoản: {name}".

### Task 3: Nhóm thu chi

**Files:**
- Modify `app/admin/finance/categories/components/CategoryForm.tsx`, `CategoriesList.tsx`, `CategoryForm.test.tsx`, `../page.tsx`, `../page.test.ts` (chỉ nếu mock `CategoryForm` không còn khớp).
- Create `app/admin/finance/categories/new/page.tsx`, `app/admin/finance/categories/[id]/edit/page.tsx`.

- [ ] Test form (đỏ): `render(<CategoryForm returnTo="/admin/finance/categories" />)` thấy ngay ô "Tên nhóm". Sửa các test cũ (I3, BR-CASH-006): bỏ bước bấm "Sửa"/"Thêm nhóm", hàm `open` chỉ còn `render`. Giữ nguyên mọi điều các test đó khẳng định.
- [ ] Test danh sách: nút Sửa của nhóm `CFC-001` là liên kết `/admin/finance/categories/CFC-001/edit`.
- [ ] Code form: như Task 2, giữ nguyên `shouldConfirmAffectsPnlChange` và câu hỏi `confirm` "Đổi cách tính lãi lỗ". `returnTo` qua `safeReturnTo(raw, "/admin/finance/categories")`.
- [ ] Code danh sách, trang danh sách: như Task 2. Trang danh sách vẫn tính `usedCategoryIds` cho danh sách (nút Xoá cần).
- [ ] Trang `edit`: `Promise.all([getCashCategories(), findAll("Cash_Entries")])`, tìm nhóm, không có thì `notFound()`. `hasEntries = entries.some((e) => e.category_id === category.id)`.

### Task 4: Sổ thu chi

**Files:**
- Modify `app/admin/finance/components/CashEntryForm.tsx`, `CashEntriesList.tsx`, `CashEntryForm.test.tsx`, `CashEntriesList.test.tsx`, `app/admin/finance/page.tsx`.
- Create `app/admin/finance/new/page.tsx`, `app/admin/finance/[id]/edit/page.tsx`, `app/admin/finance/[id]/edit/page.test.ts`.

- [ ] Test form (đỏ): `render(<CashEntryForm categories={CATEGORIES} accounts={[]} today="2026-09-11" returnTo="/admin/finance?preset=LAST_MONTH" />)` thấy ngay ô "Ngày" mang `2026-09-11`; bấm "Bỏ" thì `push("/admin/finance?preset=LAST_MONTH")`. Sửa test cũ (BR-CASH-005, M7): bỏ bước bấm mở khung.
- [ ] Test danh sách: với `returnTo="/admin/finance?preset=LAST_MONTH"`, nút Sửa của `CE-001` có `href="/admin/finance/CE-001/edit?returnTo=%2Fadmin%2Ffinance%3Fpreset%3DLAST_MONTH"`; dòng `CE-002` (đã huỷ) không có liên kết Sửa.
- [ ] Test trang `edit` (mock `findById`, `getCashCategories`, `getBankAccounts`, `notFound` ném lỗi như Next): dòng `CANCELLED` → gọi `notFound`; không có dòng → gọi `notFound`; dòng `ACTIVE` → trả trang có `CashEntryForm` mang `entry` đó.
- [ ] Code form: như Task 2. `returnTo` qua `safeReturnTo(raw, "/admin/finance")`.
- [ ] Code danh sách: prop mới `returnTo: string`. Hai chỗ `CashEntryForm` thành `<Link href={\`/admin/finance/${encodeURIComponent(entry.id)}/edit?returnTo=${encodeURIComponent(returnTo)}\`}>Sửa</Link>`. Bỏ import `CashEntryForm`.
- [ ] Trang danh sách: dựng `listHref` từ `searchParams` đúng như `FinanceFilterBar` ghi: `preset` luôn có nếu địa chỉ có; `start`, `end` chỉ khi `preset === "CUSTOM"`. Không có `preset` trên địa chỉ thì `listHref = "/admin/finance"`. Nút "+ Ghi khoản mới" thành liên kết `/admin/finance/new?returnTo=${encodeURIComponent(listHref)}`. Truyền `returnTo={listHref}` xuống `CashEntriesList`.
- [ ] Trang `new`: `today` như trang danh sách (`toSaigonIsoString(new Date()).slice(0, 10)`), `getCashCategories()`, `getBankAccounts()`. `BackLink` "Sổ thu chi", `PageHeader` "Ghi khoản thu chi".
- [ ] Trang `edit`: như mô tả ở Hiện trạng mục 5. `PageHeader` "Sửa dòng sổ".

### Task 5: Menu, tài liệu, kiểm

- [ ] `app/admin/nav-allowlist.ts`: thêm `/admin/finance/new`, `/admin/finance/categories/new`, `/admin/finance/bank-accounts/new`, lý do "reached from the … list -- legitimately unlinked".
- [ ] `docs/03-workflows/cash-book.md` dòng `routes:` thêm sáu địa chỉ mới.
- [ ] Opus: chạy test mới trên bản cũ (stash phần component), ghi đỏ vì gì; rồi chạy đủ năm lệnh trong CLAUDE.md.
- [ ] Commit trên `feat/no-popups`, không đẩy.
