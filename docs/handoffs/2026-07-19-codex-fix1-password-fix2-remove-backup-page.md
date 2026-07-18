# Task: FIX-1 (đổi mật khẩu hỏng) + FIX-2 (xoá trang Sao lưu & Đồng bộ)

## Tóm tắt cho chủ doanh nghiệp

Hai lỗi/việc dọn dẹp độc lập, gộp chung một lần giao việc vì cả hai đều nhỏ
và đã điều tra xong:

1. **Đổi mật khẩu đang hỏng thật** — ai bấm đổi mật khẩu cũng nhận lỗi
   "không tìm thấy tài khoản", vì code đang đọc/ghi vào một hệ thống cũ
   (Google Sheets) trong khi đăng nhập thật đã chuyển sang hệ mới
   (Supabase) từ lâu. Sửa để dùng đúng hệ đang chạy thật.
2. **Xoá trang "Sao lưu & Đồng bộ"** — trang này viết theo khái niệm cũ
   (đồng bộ dữ liệu lên Google Sheets), không còn đúng với cách sao lưu
   thật hiện tại (tự động mỗi đêm, kéo từ Supabase vào Drive của anh, đã
   xác minh chạy tốt). Nút "sao lưu thủ công" trên trang này không thể
   thật sự tạo bản sao lưu mới (không có quyền ghi vào Drive), nên giữ lại
   sẽ gây hiểu nhầm. Chủ quyết định (2026-07-19): xoá hẳn trang và chức
   năng này, không giữ lại dạng nào khác.

## FIX-1: `changePasswordAction`

File: `app/actions/auth.ts` (toàn bộ file hiện chỉ có hàm này).

### Root cause (confirmed by Claude 2026-07-19)

- `session.user.username` (line 15) is read but never set — `lib/auth.ts`'s
  `session` callback (`lib/auth.ts:121-123`) only assigns `role` and `id` to
  `session.user`, never `username`. So `username` is always `undefined`,
  and the subsequent Sheets row lookup by username always fails, returning
  `"Không tìm thấy tài khoản"` for every user, every time.
- The function also reads/writes a legacy Google Sheets `users` tab via
  `sheets.spreadsheets.values.get/update` and SHA-256 hashing
  (`hashPasswordSHA256`). The actual login system
  (`lib/auth.ts:67-109`, `authorize()`) has used the Supabase `public.users`
  table with `password_hash` (bcrypt) for a while now — these are two
  completely different credential stores. Even if the username bug were
  fixed, this would still change a password nobody's real login checks.

### Fix

Rewrite `changePasswordAction` to match the pattern already used at login
(`lib/auth.ts:67-109`):

- Get the actor from the session the same way the rest of the app does —
  `session.user.id` is reliably set (see `lib/auth.ts:122` and how
  `requireAdmin()`/`resolveActor()` elsewhere use `session.user.id`), so
  look up by `id`, not `username`.
- Query `public.users` via `getSupabaseClient()` (same helper used
  throughout `lib/*-transaction.ts`), fetch `password_hash`.
- Verify the old password with `bcrypt.compare` (same as
  `lib/auth.ts:95`), reject with a clear error if it doesn't match.
- Hash the new password with `bcrypt.hash` (check the existing user-creation
  path — likely `app/admin/users/actions.ts` or similar — for the salt
  rounds already used elsewhere, and match it; don't introduce a new
  constant if one already exists).
- Update `password_hash` on the matched row via Supabase `.update()`.
- Keep the existing return shape (`{ success: boolean, error?: string }`)
  and the existing error message strings where they still apply
  (`"Mật khẩu cũ không chính xác"`, etc.) — `app/settings/password/page.tsx`
  already calls this correctly and expects this shape; do not change the
  UI or the call signature.
- Remove the now-unused `sheets`/`SPREADSHEET_ID`/`hashPasswordSHA256`
  imports once nothing in the file uses them.

### Out of scope

- Don't touch `lib/auth.ts`'s login flow itself — it's already correct.
- Don't touch `app/settings/password/page.tsx` — its call site and error
  handling are already correct for the existing return shape.

## FIX-2: remove the "Sao lưu & Đồng bộ" admin page entirely

### Confirmed scope (Claude 2026-07-19)

- `app/admin/backup/actions.ts`'s `triggerBackup` calls the legacy
  `backup-to-sheets` Edge Function — confirmed the **only** caller of that
  function anywhere in the app (`grep` for `backup-to-sheets` found no
  other callers besides the function's own directory and historical docs).
- The actual production backup (`docs/operations/apps-script-drive-backup.md`)
  is a pull model: Google Apps Script, running under the Drive owner's own
  Google account on a daily trigger, calls the `backup-to-drive` Edge
  Function and writes the JSON result to the owner's Drive itself.
  `backup-to-drive`'s handler (`supabase/functions/backup-to-drive/handler.ts`)
  only returns the JSON bundle in the HTTP response — it does not write to
  Drive. The Next.js server has no Google Drive write credentials at all,
  so no version of a "manual backup" button on this page can actually
  create a new Drive backup file. Owner decision: don't try to build that
  capability now — remove the page instead of keeping something that can't
  do what it claims.
- `supabase/migrations/0003_sync_state.sql`'s `sync_state` table is **not**
  part of this cleanup — it's still actively used by the current
  `backup-to-drive` system (`supabase/functions/backup-to-drive/core.ts`,
  `lib/drive-backup.test.ts`). Do not touch it.

### What to delete

- `app/admin/backup/` — the whole directory (`page.tsx`, `actions.ts`,
  `loading.tsx`, `components/BackupClient.tsx`).
- The nav entry at `app/admin/layout.tsx:80`
  (`{ name: "Sao lưu & Đồng bộ", href: "/admin/backup" }`).

### What to flag, not delete, in this task

- The `backup-to-sheets` Edge Function (`supabase/functions/backup-to-sheets/`)
  becomes unreachable dead code once the page above is deleted, but it's
  still a deployed Supabase Edge Function — undeploying/removing deployed
  infrastructure is a separate, more consequential action than deleting
  frontend files. Note in your commit/report that it's now orphaned and
  candidate for removal, but don't undeploy or delete the function
  directory in this task — that needs its own explicit go-ahead.

## Verification

1. `npx tsc --noEmit`: 0 errors.
2. `npx vitest run`: full suite passes (baseline: 491, from Gate 4 Phase B).
3. Manually confirm (or add a small test if one doesn't already exist)
   that `changePasswordAction` succeeds for a real Supabase-backed user with
   the correct old password, and fails with the old-password-mismatch error
   otherwise — using a mocked Supabase client, not a live write.
4. Confirm `/admin/backup` no longer exists as a route and the nav link is
   gone — a build (`next build`) should not reference the deleted page.
5. `git diff --check`: clean.

## Priority / model

Both are small, already root-caused — no architecture design needed.

Model per `docs/COLLABORATION.md` Section G: `gpt-5.4` Medium — standard
fix with an existing pattern already in the codebase (auth: not eligible
for a mini/flash tier per Section D rule 7; page removal is mechanical but
bundled in the same handoff).
