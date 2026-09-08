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

**Why:** the owner replaced the earlier per-table exception with one system-wide
rule so that "who can erase history" has a single answer instead of one answer
per screen.
