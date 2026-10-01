# Bỏ khung ô nhập — đợt 1: Nhà cung cấp — Implementation Plan

> **For agentic workers:** UI work goes to Gemini via `agy` (CLAUDE.md "Ai viết code"). Gemini cannot run shell commands in headless mode; Opus runs tests, proves them red on the old code, and commits. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Thêm và sửa nhà cung cấp mở thành trang riêng thay cho khung bật lên. Bộ lọc của danh sách vẫn giữ sau khi lưu.

**Architecture:**
- Hai trang mới: `app/admin/suppliers/new` và `app/admin/suppliers/[id]/edit`. Cả hai dùng chung `SupplierForm`, đã gỡ `FormModal`.
- Bộ lọc của danh sách (ô tìm, trạng thái) chuyển lên địa chỉ trang (`?q=&status=`).
- Nút Thêm và Sửa mang theo `returnTo` (địa chỉ danh sách kèm bộ lọc). Lưu xong thì `router.push(returnTo)` rồi `router.refresh()`.

**Tech Stack:** Next.js 14 App Router, React 18, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-01-bo-popup-design.md` (mục 2, 3; đợt 1 ở mục 4). Luật: `BR-DATA-007`.

## Hiện trạng

1. **Trạng thái.**
   - Hiện nay: `SupplierForm` giữ `isOpen` để mở và đóng `FormModal`.
   - Sau đợt này: không còn `isOpen`.
     - Trang `new` có form trống.
     - Trang `edit` có form điền sẵn.
     - Nhà cung cấp không tồn tại thì báo 404 (`notFound()`).
2. **Nút.**
   - "+ Thêm nhà cung cấp" và "Sửa" thành liên kết sang trang.
   - Trên trang form:
     - "← Nhà cung cấp" về `returnTo`.
     - "Bỏ" về `returnTo`, không lưu.
     - "Lưu nhà cung cấp" (trang `new`) hoặc "Cập nhật" (trang `edit`).
   - Giữ nguyên, không đổi:
     - "Xoá": khung xác nhận, chỉ ADMIN thấy.
     - "Xem đơn nhập".
     - Câu hỏi "Tên gần giống một mục đã có": khung có/không theo `BR-DATA-007`.
3. **Danh sách.** Không đổi những gì danh sách hiện. Chỉ đổi chỗ đọc bộ lọc: đọc từ địa chỉ trang, gõ thì ghi lại vào địa chỉ bằng `router.replace`.
4. **Ô nhập.**
   - Năm ô giữ nguyên tên và luật: `name` bắt buộc, `phone`, `tax_id`, `address`, `links`.
   - `returnTo` chỉ nhận đường dẫn bắt đầu bằng `/admin/suppliers`. Giá trị khác hoặc thiếu thì dùng `/admin/suppliers`. Chặn để một liên kết lạ không đẩy người dùng ra trang ngoài.
   - Ô `status` của bộ lọc chỉ nhận `ALL`, `ACTIVE`, `INACTIVE`. Giá trị khác coi như `ALL`.
5. **Dữ liệu.** Không đổi server action, không đổi bảng. Trang `edit` lấy nhà cung cấp bằng `getSuppliers()` rồi tìm theo `id`, nên không cần hàm mới phía máy chủ.

Thêm:
- **Phụ chú cũ trên trang tạo phiếu xuất:** "Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." Câu này đã sai từ `BR-INV-014`. Đổi thành "Ghi nhận nguyên liệu lấy ra khỏi kho." (`app/admin/inventory/issue-slips/new/page.tsx`).
- **Menu:** `/admin/suppliers/new` thêm vào `app/admin/nav-allowlist.ts` với lý do "reached from the suppliers list". Trang có `[id]` thì phép kiểm menu không đòi.

Đã xem:
- `app/admin/suppliers/page.tsx`, `components/SupplierForm.tsx`, `components/SuppliersClient.tsx`.
- `components/ui/BackLink.tsx`.
- `app/admin/users/edit/[id]/page.tsx`, `app/admin/inventory/issue-slips/new/page.tsx`.
- `app/admin/nav-allowlist.ts`.

Chưa xem: `app/admin/suppliers/actions.ts` ngoài tên ba hàm `addSupplier`, `editSupplier`, `deleteSupplierAction` và `getSuppliers`.

## Global Constraints

- Chữ hiển thị tiếng Việt, code và chú thích tiếng Anh.
- Import cùng thư mục viết tương đối (`./SupplierForm`). Import khác thư mục viết `@/...`.
- Máy tính và điện thoại đều dùng được (`.claude/rules/ui-devices.md`).
- Khung hỏi có/không và khung báo lỗi giữ nguyên (`BR-DATA-007`, 2026-10-01).

## Review Focus

1. Tìm "Cà phê" (có dấu) rồi bấm Sửa, Lưu. Danh sách phải quay về với ô tìm vẫn là "Cà phê". Kiểm `encodeURIComponent` hai chiều.
2. Mở `/admin/suppliers/SUP-999/edit` (mã không có) thì phải ra 404, không phải trang trắng hay form rỗng.
3. `returnTo=https://evil.example` thì Lưu vẫn về `/admin/suppliers`.
4. Nhà cung cấp "Ngừng hợp tác" vẫn mở trang sửa được.
5. Lưu bị lỗi, ví dụ trùng tên mà bấm "Tôi gõ nhầm", thì ở lại trang và giữ những gì đã gõ.

---

### Task 1: SupplierForm thành form trên trang, hai trang mới

**Files:**
- Modify: `app/admin/suppliers/components/SupplierForm.tsx`
- Create: `app/admin/suppliers/components/return-to.ts`
- Create: `app/admin/suppliers/new/page.tsx`
- Create: `app/admin/suppliers/[id]/edit/page.tsx`
- Modify: `app/admin/nav-allowlist.ts`
- Modify: `app/admin/inventory/issue-slips/new/page.tsx` (phụ chú)
- Test: `app/admin/suppliers/components/SupplierForm.test.tsx`, `app/admin/suppliers/components/return-to.test.ts`

**Interfaces:**
- Produces:
  - `safeReturnTo(raw: string | undefined | null): string` trong `return-to.ts`.
  - `SupplierForm({ initialData?: DBSupplier; returnTo: string })`.
  - `DeleteSupplierButton({ id })` giữ nguyên.

- [ ] **Step 1: Viết test (đỏ)**

`return-to.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { safeReturnTo } from "./return-to";

describe("safeReturnTo", () => {
  it("keeps a suppliers list URL with filters", () => {
    expect(safeReturnTo("/admin/suppliers?q=C%C3%A0%20ph%C3%AA&status=ACTIVE"))
      .toBe("/admin/suppliers?q=C%C3%A0%20ph%C3%AA&status=ACTIVE");
  });
  it("falls back for a missing value", () => {
    expect(safeReturnTo(undefined)).toBe("/admin/suppliers");
    expect(safeReturnTo("")).toBe("/admin/suppliers");
  });
  it("falls back for an outside or other-screen URL", () => {
    expect(safeReturnTo("https://evil.example")).toBe("/admin/suppliers");
    expect(safeReturnTo("//evil.example/admin/suppliers")).toBe("/admin/suppliers");
    expect(safeReturnTo("/admin/users")).toBe("/admin/suppliers");
    expect(safeReturnTo("/admin/suppliersX")).toBe("/admin/suppliers");
  });
});
```

`SupplierForm.test.tsx`: mock `next/navigation` and `../actions` in the same style as `app/admin/inventory/issue-slips/components/IssueSlipDetailClient.test.tsx` lines 21–40. Mock `@/lib/shared/dialog` (`confirm`, `alert`). Cases:
```ts
it("renders the fields on the page, not in a dialog", () => {
  render(<SupplierForm returnTo="/admin/suppliers" />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toBeInTheDocument();
});
it("prefills every field when editing", () => {
  render(<SupplierForm returnTo="/admin/suppliers" initialData={supplier({ name: "Cửa hàng ABC", phone: "0901234567" })} />);
  expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toHaveValue("Cửa hàng ABC");
  expect(screen.getByLabelText("Số Điện Thoại")).toHaveValue("0901234567");
});
it("after a successful add, goes to returnTo and refreshes", async () => {
  mocks.addSupplier.mockResolvedValue({});
  render(<SupplierForm returnTo="/admin/suppliers?q=ABC" />);
  fireEvent.change(screen.getByLabelText("Tên Nhà Cung Cấp"), { target: { value: "Cửa hàng ABC" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/suppliers?q=ABC"));
  expect(refresh).toHaveBeenCalled();
});
it("on error stays on the page, shows the message, keeps the typed name", async () => {
  mocks.addSupplier.mockResolvedValue({ error: "Tên đã tồn tại" });
  render(<SupplierForm returnTo="/admin/suppliers" />);
  fireEvent.change(screen.getByLabelText("Tên Nhà Cung Cấp"), { target: { value: "Cửa hàng ABC" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Tên đã tồn tại"));
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Tên Nhà Cung Cấp")).toHaveValue("Cửa hàng ABC");
});
it("declining the near-duplicate question stays on the page and does not save twice", async () => {
  mocks.addSupplier.mockResolvedValue({ needsDuplicateWarning: { message: "Gần giống ABC" } });
  mocks.confirm.mockResolvedValue(false);
  render(<SupplierForm returnTo="/admin/suppliers" />);
  fireEvent.change(screen.getByLabelText("Tên Nhà Cung Cấp"), { target: { value: "Cửa hàng ABD" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu nhà cung cấp" }));
  await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
  expect(mocks.addSupplier).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
});
it("Bỏ goes to returnTo without saving", () => {
  render(<SupplierForm returnTo="/admin/suppliers?status=INACTIVE" />);
  fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
  expect(push).toHaveBeenCalledWith("/admin/suppliers?status=INACTIVE");
  expect(mocks.addSupplier).not.toHaveBeenCalled();
});
```
Note: a controlled-by-React form posts through `action={handleSubmit}`. If jsdom does not call a function `action`, switch the form to `onSubmit` with `new FormData(e.currentTarget)` and `e.preventDefault()`. That is an implementation choice, not a behaviour change.

- [ ] **Step 2: Opus chạy, xác nhận đỏ** — `npx vitest run app/admin/suppliers`. Kỳ vọng đỏ vì thiếu module `./return-to` và vì form vẫn nằm trong khung (không có nhãn trên trang).

- [ ] **Step 3: Viết code**

`return-to.ts`:
```ts
const LIST = "/admin/suppliers";

// Only a path inside the suppliers screen is accepted, so a crafted link
// cannot send the user off-site after saving.
export function safeReturnTo(raw: string | undefined | null): string {
  if (!raw) return LIST;
  if (raw === LIST || raw.startsWith(`${LIST}?`)) return raw;
  return LIST;
}
```

`SupplierForm.tsx`:
- Bỏ `isOpen`, hai nút mở khung và `FormModal`.
- Form nằm trong một thẻ `bg-surface-card rounded-2xl border border-border p-6 max-w-2xl`.
- Năm ô giữ nguyên `id`, `name`, `label`, `defaultValue`, `placeholder`.
- Cuối form có hàng nút:
  - "Bỏ": `type="button"`, bấm thì `router.push(returnTo)`.
  - `LoadingButton type="submit"`: chữ "Lưu nhà cung cấp" khi thêm, "Cập nhật" khi sửa.
  - Trên điện thoại, hai nút chiếm hết bề ngang.
- Thành công thì `router.push(returnTo); router.refresh();`.
- Giữ nguyên phần hỏi trùng tên và `DeleteSupplierButton`.

`new/page.tsx`:
```tsx
import { SupplierForm } from "../components/SupplierForm";
import { safeReturnTo } from "../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewSupplierPage({ searchParams }: { searchParams: { returnTo?: string } }) {
  const returnTo = safeReturnTo(searchParams.returnTo);
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhà cung cấp" />
      <PageHeader title="Thêm nhà cung cấp" subtitle="Thông tin liên hệ của đối tác cung ứng." />
      <SupplierForm returnTo={returnTo} />
    </div>
  );
}
```

`[id]/edit/page.tsx`: giống trang trên, với các chỗ khác sau:
- Gọi `getSuppliers()`, tìm `s.id === params.id`. Không có thì `notFound()`.
- Tiêu đề `Sửa nhà cung cấp: {supplier.name}`.
- `<SupplierForm initialData={supplier} returnTo={returnTo} />`.

`nav-allowlist.ts`: thêm `{ route: "/admin/suppliers/new", reason: "reached from the suppliers list -- legitimately unlinked" }`.

`issue-slips/new/page.tsx`: subtitle → `"Ghi nhận nguyên liệu lấy ra khỏi kho."`.

- [ ] **Step 4: Opus chạy xanh** — `npx vitest run app/admin/suppliers app/admin/nav-guard.test.ts`.

### Task 2: Danh sách đọc và ghi bộ lọc trên địa chỉ, nút thành liên kết

**Files:**
- Modify: `app/admin/suppliers/page.tsx`
- Modify: `app/admin/suppliers/components/SuppliersClient.tsx`
- Test: `app/admin/suppliers/components/SuppliersClient.test.tsx`

**Interfaces:**
- Consumes:
  - `SupplierForm` không còn được `SuppliersClient` dùng.
  - `DeleteSupplierButton` từ Task 1.
- Produces: `SuppliersClient({ suppliers, canDelete, initialSearch: string, initialStatus: "ALL" | "ACTIVE" | "INACTIVE" })`.

- [ ] **Step 1: Viết test (đỏ)**
```ts
it("starts from the filters in the URL", () => {
  render(<SuppliersClient suppliers={[sup("SUP-001", "Cà phê Phin"), sup("SUP-002", "Sữa Mlekovita")]} canDelete={false} initialSearch="Cà phê" initialStatus="ALL" />);
  expect(screen.getAllByText("Cà phê Phin").length).toBeGreaterThan(0);
  expect(screen.queryByText("Sữa Mlekovita")).toBeNull();
});
it("typing in search writes q to the URL with replace", () => {
  render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="" initialStatus="ALL" />);
  fireEvent.change(screen.getByPlaceholderText("Tên, SĐT, địa chỉ..."), { target: { value: "Cà phê" } });
  expect(replace).toHaveBeenLastCalledWith("/admin/suppliers?q=C%C3%A0+ph%C3%AA", { scroll: false });
});
it("Thêm links to the new page carrying the current list URL", () => {
  render(<SuppliersClient suppliers={[]} canDelete={false} initialSearch="ABC" initialStatus="INACTIVE" />);
  const link = screen.getByRole("link", { name: "+ Thêm nhà cung cấp" });
  expect(link).toHaveAttribute("href", "/admin/suppliers/new?returnTo=" + encodeURIComponent("/admin/suppliers?q=ABC&status=INACTIVE"));
});
it("Sửa links to that supplier's edit page", () => {
  render(<SuppliersClient suppliers={[sup("SUP-001", "Cà phê Phin")]} canDelete={false} initialSearch="" initialStatus="ALL" />);
  const links = screen.getAllByRole("link", { name: "Sửa" });
  expect(links[0]).toHaveAttribute("href", "/admin/suppliers/SUP-001/edit?returnTo=" + encodeURIComponent("/admin/suppliers"));
});
it("an INACTIVE supplier still has a Sửa link", () => {
  render(<SuppliersClient suppliers={[sup("SUP-003", "Cũ", "INACTIVE")]} canDelete={false} initialSearch="" initialStatus="ALL" />);
  expect(screen.getAllByRole("link", { name: "Sửa" }).length).toBeGreaterThan(0);
});
```
Mock `next/navigation` with `useRouter` returning `{ replace, push, refresh }`.

- [ ] **Step 2: Opus chạy, xác nhận đỏ** — kỳ vọng đỏ vì giá trị sai (bộ lọc đầu là rỗng, nút là `button` chứ không phải `link`).

- [ ] **Step 3: Viết code**

`page.tsx`:
```tsx
export default async function SuppliersPage({ searchParams }: { searchParams: { q?: string; status?: string } }) {
  const [suppliers, auth] = await Promise.all([getSuppliers(), resolveActor()]);
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  const status = searchParams.status === "ACTIVE" || searchParams.status === "INACTIVE" ? searchParams.status : "ALL";
  return <SuppliersClient suppliers={suppliers} canDelete={canDelete} initialSearch={searchParams.q ?? ""} initialStatus={status} />;
}
```
(giữ nguyên chú thích BR-ACCESS-003.)

`SuppliersClient.tsx`:
- Thêm hàm `listUrl(search, status)`:
  ```ts
  function listUrl(search: string, status: string): string {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (status !== "ALL") p.set("status", status);
    const qs = p.toString();
    return qs ? `/admin/suppliers?${qs}` : "/admin/suppliers";
  }
  ```
- `useState` khởi tạo từ `initialSearch` và `initialStatus`.
- Mỗi lần đổi bộ lọc: `router.replace(listUrl(...), { scroll: false })`.
- `const back = encodeURIComponent(listUrl(search, status));`.
- Nút "+ Thêm nhà cung cấp" thành `<Link href={`/admin/suppliers/new?returnTo=${back}`}>`, giữ class nút chính. Trên điện thoại nút chiếm hết bề ngang.
- "Sửa" trên bảng và trên thẻ thành `<Link href={`/admin/suppliers/${encodeURIComponent(s.id)}/edit?returnTo=${back}`}>`, kiểu chữ giống "Xem đơn nhập".
- Bỏ import `SupplierForm`, chỉ import `DeleteSupplierButton`.

- [ ] **Step 4: Opus chạy xanh** — `npx vitest run app/admin/suppliers`.

### Task 3: Opus soát và kiểm toàn bộ

- [ ] `npx tsc --noEmit`, `npx vitest run`, `npx vite-node scripts/check-rules-current.ts`, `npx vite-node scripts/doc-checks/run-blocking.ts`, `npm run build`.
- [ ] Phép kiểm tài liệu đòi khai trang mới (`route-coverage`, `map-drift`): Opus cập nhật tài liệu sinh tự động hoặc tài liệu luồng theo lời báo của phép kiểm.
- [ ] Lưu trên nhánh `feat/no-popups`. Không đẩy khi chủ quán chưa duyệt.
- [ ] Danh sách cho chủ quán mở xem, trên máy tính và điện thoại:
  - Nhà cung cấp → "+ Thêm nhà cung cấp".
  - Tìm một tên → Sửa → Cập nhật → ô tìm vẫn giữ.
  - Xoá vẫn bật khung hỏi như cũ.
