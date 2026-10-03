# Khuôn danh sách và chi tiết, đợt 7: Nhân viên & quyền

> **For agentic workers:** UI to Gemini via `agy` (newest generation at the highest level, checked with `agy models` at hand-off); the one comment in `lib/` to Sonnet. No server action change. Opus moves the edit folder with `git mv` before hand-off, proves tests red on the old code, runs the gates, commits.

**Goal:** the staff screen on the template of waves 1–6. Clicking a row opens `/admin/users/[id]`; editing lives there. The edit page moves from `/admin/users/edit/[id]` to `/admin/users/[id]/edit`. Owner asked to keep going through the waves on 2026-10-03 (*"Em cứ cho làm tiếp rồi cho anh danh sách cần kiểm tra là được."*).

**Spec:** `docs/superpowers/specs/2026-10-02-khuon-danh-sach-chi-tiet-design.md` §4 row 7 ("Thông tin", "Theo trang", merge the edit route), §0 (bin per row and tick boxes; rare actions on the detail page), §8 (sort). Examples to copy: `app/admin/outlets/**` (wave 5), `app/admin/finance/bank-accounts/**` (wave 6).

## Hiện trạng

1. **Trạng thái.** An account is `ACTIVE` from creation; no screen changes `status`, and deletion is permanent (`docs/03-workflows/users.md`). So the list gets **no** status filter: there is nothing to filter. Detail page: view (`/admin/users/[id]`) and edit (`/admin/users/[id]/edit`). Unknown id gives 404.
2. **Nút.** "Theo trang": wording and rights as today.
   - **List:** "+ Thêm nhân sự" (ADMIN, MANAGER — the page itself needs `requireAdmin`). Bin "Xoá" per row and tick boxes, **ADMIN only** (`deleteUserAction`, `requireOwner`, `BR-ACCESS-003`), and **never on the account named `admin`** — today the button is hidden on that row; the server does not refuse it. Template's tick-all must therefore skip that row, which the shared list cannot do yet: new optional `removal.canRemove(row)` on `DataList` (rows returning `false` get no tick box and no bin; tick-all covers only removable rows). Removed from the row: "Sửa".
   - **Detail:** "← Nhân viên & quyền", "Chỉnh sửa", "Xoá" (ADMIN only, not on `admin`) with today's confirm wording, back to the list after.
   - **Edit:** the form as today ("Lưu", "Bỏ"), both back to the detail page.
3. **Danh sách.** Every account, 20 per page, newest code first (`BR-DATA-008`). Columns: Mã NV · Tên đăng nhập · Quyền hạn (badge, the role written as today: ADMIN / MANAGER / STAFF) · Ngày tạo (dd/MM/yyyy, Asia/Saigon). No secondary column (four columns fit at 768px). Never the password hash (`BR-ACCESS-002`). Phone: cards.
4. **Ô nhập.** "Tìm nhân sự": username or code, applied by "Lọc" or Enter (today: on every keystroke — template rule). "Quyền hạn": Tất cả quyền (default) / ADMIN / MANAGER / STAFF; unknown → Tất cả; kept in the URL as `role` as today. `page` not an integer ≥ 1 → 1, beyond the last page → last page. `returnTo` (`app/admin/users/components/return-to.ts`) learns `/admin/users/<id>`, refusing `new` and anything off-site. Forms unchanged beyond their frame.
5. **Dữ liệu.** Table `users`, no migration, no server action change. Deliberately not served: the `name` column (no screen writes it; `toClientUser` drops it), self-service password (`/settings/password`, untouched). `DeleteUserButton` (in `UserForm.tsx`) is removed with its last caller.

Thêm, riêng cho việc này:
- **Old address.** `/admin/users/edit/[id]` stops existing (404), no redirect: only the list linked it, and the list now links the detail page.
- **Chọn hết.** With `admin` on the page, tick-all ticks every other account; the bar reads "Xoá N dòng đã chọn" with N excluding `admin`.

**Real figures (measured 2026-10-03, read-only):** 2 accounts, both `ACTIVE`; no other table references `users`.
- `USR-001` · `admin` · ADMIN · tạo 28/06/2026 — no tick box, no bin, no "Xoá" on its detail page.
- `USR-002` · `tuyen2612` · MANAGER · tạo 01/06/2026 — tick box and bin for ADMIN.

**Worked example.** Default list: `USR-002` first, then `USR-001`. Row `tuyen2612` → `/admin/users/USR-002?returnTo=%2Fadmin%2Fusers`; detail shows Mã NV USR-002, Tên đăng nhập tuyen2612, Quyền hạn MANAGER, Ngày tạo 01/06/2026; "Chỉnh sửa" → `/admin/users/USR-002/edit?returnTo=…`; "Lưu" → back to the detail page. Not to be clicked on the real data: "Xoá".

**Menu:** no new entry; one `[id]` route; the `[id]/edit` route replaces `edit/[id]`. **Guard:** PENDING in `app/admin/list-template.test.ts` becomes empty. **Docs:** `docs/03-workflows/users.md` routes line and a dated "Behaviour change" paragraph.

Đã xem: `page.tsx`, `UsersClient.tsx`, `edit/[id]/page.tsx`, `return-to.ts`, `actions.ts` (delete is `requireOwner`, no `admin` guard), `DeleteUserButton`, `EditUserForm` props, the flow doc, `DataList` removal wiring, the `users` columns and foreign keys. Chưa xem: `UserForm` body beyond `DeleteUserButton`; `new/page.tsx` beyond its existence.

## Review Focus

1. The `admin` account can be ticked or binned by no path: per-row bin, tick box, tick-all, detail page.
2. Another list's bins and tick-all are unchanged when `canRemove` is omitted.
3. `EditUserForm` keeps a detail-page `returnTo` (its own `safeReturnTo` must accept it), so "Lưu" lands on the detail page, not the list.
4. A MANAGER sees no tick box, no bin and no "Xoá" anywhere.
5. No server `[id]` page passes a function to a client component.

---

### Task 1 (Gemini): `DataList` `removal.canRemove` + tests.
### Task 2 (Gemini): staff list on the template, `[id]` detail, edit frame, `return-to.ts`, drop `DeleteUserButton`, tests.
### Task 3 (Sonnet): `lib/shared/nav-completeness.ts` comment example `/admin/users/edit/[id]` → `/admin/users/[id]/edit`.
### Task 4 (Opus): `git mv` the edit folder first; guard, docs, five gates, browser check (view only), commit.
