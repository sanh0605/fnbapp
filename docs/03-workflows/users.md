# Users and access flow

```flow-decl
routes: /login, /admin/users, /admin/users/edit/[id], /settings/password
files: app/actions/auth.ts, app/admin/users/actions.ts
tables: users, Users
brCodes: BR-ACCESS-001, BR-ACCESS-002, BR-U-003
```

This flow covers who can sign in and what account each person holds: logging in at
`/login`, an administrator creating and editing accounts under `/admin/users`, and
any signed-in person changing their own password at `/settings/password`. Two
files write the account record. Account management (create, change role, reset
password, delete) goes through `app/admin/users/actions.ts`, which uses the
`sheets_db` adapter and therefore writes the `Users` table. The self-service
password change goes through `app/actions/auth.ts`, which writes the same account
record directly via `supabase.from("users").update(...)` — the lowercase `users`
table. The two casings are the same physical table reached two different ways;
see SYSTEM-OVERVIEW for the naming trap.

## Five-question current-state description

1. **States, and how each is set.** An account carries a `role` and a `status`.
   `status` is set to `ACTIVE` when the account is created and is not changed by any
   screen in this flow. `role` is chosen at creation and can be changed later from
   the edit screen. There is no draft, approval, or suspended state — an account
   either exists (and is `ACTIVE`) or is deleted outright. A password has no state
   of its own; it is stored only as a bcrypt hash and is overwritten in place.

2. **Buttons per screen, and when to hide them.** `/login` presents the sign-in
   form only. `/admin/users` lists accounts and offers create, edit, and delete;
   these actions require an administrator (`requireAdmin`), so the management
   screen should not be reachable by a non-admin. `/admin/users/edit/[id]` saves a
   changed role and, optionally, a new password. `/settings/password` offers a
   single change-password action for the signed-in person's own account. Delete is
   a hard delete with no self-protection guard — an administrator can remove any
   account, including the last one, so this button warrants care rather than being
   hidden.

3. **What each list contains, and what is excluded.** `/admin/users` lists every
   account row in the `Users` table, one row per account. It shows the username and
   role; it deliberately never shows the password hash (`BR-ACCESS-002`). There is
   no separate list of deleted or inactive accounts, because deletion is permanent
   rather than a status flag.

4. **Valid inputs, and what happens outside the range.** Creating an account
   requires a username, a role, and a password; any blank field is rejected before
   writing, and a duplicate username is rejected. Editing requires an id and a
   role; the password field is optional on edit and is applied only when non-blank,
   so leaving it empty keeps the existing password. Changing your own password
   requires the correct current password (checked with bcrypt) before the new one
   is accepted; a wrong current password is rejected and nothing is written.

5. **Which data it serves, and which it deliberately does not.** This flow serves
   authentication and account administration: who exists, what role each holds, and
   each person's own password. It deliberately does not enforce or define the
   full permission matrix. Role names are recorded, but what each role may actually
   do is `UNRESOLVED` (`BR-U-003`): permissions here are intended and observed, not
   verified. Per `BR-ACCESS-001`, a menu item or route guard alone never proves a
   path is enforced — only a security review can label a permission verified.

## Where it writes

`app/admin/users/actions.ts` writes the `Users` table through the `sheets_db`
adapter for all account create, role/password update, and delete operations.
`app/actions/auth.ts` writes the same account record directly through
`supabase.from("users").update(...)` when a person changes their own password —
the one place in this flow that bypasses the `sheets_db` adapter and reaches the
table by its lowercase `users` name. The generated map at
`docs/generated/system-map.md` confirms both write relations.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
