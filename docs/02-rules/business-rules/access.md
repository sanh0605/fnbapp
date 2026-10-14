# Access and security rules

### BR-ACCESS-001 — Intended roles do not prove enforcement

**Status:** `APPROVED`

Business roles and their intended permissions form a documented role matrix, but that intent is not proof of enforcement. Only a security review can label a path verified; a menu item or route guard alone is insufficient.

### BR-ACCESS-002 — Secrets and password hashes stay server-side

**Status:** `APPROVED`

Credentials, service keys, backup tokens, and password hashes must not be serialized to the browser or recorded in documentation/logs.

**Extended 2026-09-03 (owner):** committed/public docs must not even **enumerate the names** of secret environment variables — not only their values. The authoritative list of variable names lives in the secret manager. **Why:** the owner flagged that a README listing exact variable names is "a map for an attacker" — it tells a reader precisely what to target. Naming secrets publicly is itself the exposure, values or not. Application code may reference the names it needs (unavoidable); prose docs must not shopping-list them.


### BR-ACCESS-003 — Permanent deletion is ADMIN-only

**Status:** `APPROVED` — owner decision 2026-09-08.

Every role below `ADMIN` may create, edit and **cancel** a record. Only `ADMIN`
may delete one permanently. Enforcement is server-side (`requireOwner()`), not a
hidden button: a hidden button is a UI preference, not a permission.

Cancelling is the ordinary way to undo. A cancelled row stays visible, marked
"Đã huỷ", and is excluded from every total. Deletion removes the row from the
database and is not recoverable.

**Scope.** The rule governs records the shop's business depends on. The one
exception the owner named is the POS draft order (`POS_Drafts`): a half-typed
order a cashier abandons is scratch paper, touches neither money nor stock, and
staff must be able to discard it mid-shift. Making that ADMIN-only would stall
the register.

**What the permission does not do.** ADMIN rights do not override data
integrity. Deleting an ingredient used in a recipe, or a product already sold,
still fails — the `RESTRICT` foreign keys refuse it. The role decides who may
press the button; the data decides whether the button can succeed.

**Staff accounts (Opus 2026-10-14, gap G4 of the master plan).** Deleting a staff
account refuses two cases on the server: the account that is signed in ("Không
thể xoá tài khoản đang đăng nhập.") and the last active `ADMIN` ("Không thể xoá
tài khoản chủ quán cuối cùng."). A stopped `ADMIN` cannot sign in, so it does not
count. Without this, the owner could lock everyone out of owner-only screens.
Code: `deleteUserAction` in `app/admin/users/actions.ts`.

**Why:** the owner replaced the earlier per-table exception with one system-wide
rule so that "who can erase history" has a single answer instead of one answer
per screen.

### BR-ACCESS-004 — Only the owner touches the owner role

**Status:** `APPROVED` — owner 2026-10-14, audit item E2, chose *"Chỉ chủ quán đụng vai Chủ quán"*. Not built yet.

**Why.** A manager could open Nhân sự, raise their own account to `ADMIN` or reset the owner's password, and then do everything kept for the owner: delete for good, undo or edit a stocktake. They could edit the very count that checks them.

- A `MANAGER` keeps Nhân sự: adding and editing `STAFF` and `MANAGER` accounts, including resetting their passwords.
- Only an `ADMIN` may give the `ADMIN` role (create or change), and only an `ADMIN` may edit an account that is already `ADMIN` (role or password). Checked on the server with `requireOwner()`, not by hiding buttons.
- For a manager the role list offers only Nhân viên and Quản lý, and an `ADMIN` account shows no edit button.

### BR-ACCESS-005 — The public API roles hold no table or function rights

**Status:** `APPROVED` — technical decision, audit item E9, 2026-10-14. Measured that day: 6 tables still granted every right to both roles, 2 functions callable by `anon`, 0 sequences. Migration `0117` not yet run on the server.

The `anon` and `authenticated` roles hold no right on any table, function or sequence in `public`. Tables and sequences created later get none either. A function created later still gets the global "everyone may run it" default, so each migration that creates one must revoke it from `public`, `anon` and `authenticated` itself, as every migration since `0091` does. Row-level security already blocks their rows; this also closes `TRUNCATE` and function calls. The app uses only the service-role key on the server, whose rights are untouched.
