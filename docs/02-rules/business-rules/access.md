# Access and security rules

### BR-ACCESS-001 — Intended roles do not prove enforcement

**Status:** `APPROVED`

Business roles and their intended permissions form a documented role matrix, but that intent is not proof of enforcement. Only a security review can label a path verified; a menu item or route guard alone is insufficient.

### BR-ACCESS-002 — Secrets and password hashes stay server-side

**Status:** `APPROVED`

Credentials, service keys, backup tokens, and password hashes must not be serialized to the browser or recorded in documentation/logs.

**Extended 2026-09-03 (owner):** committed/public docs must not even **enumerate the names** of secret environment variables — not only their values. The authoritative list of variable names lives in the secret manager. **Why:** the owner flagged that a README listing exact variable names is "a map for an attacker" — it tells a reader precisely what to target. Naming secrets publicly is itself the exposure, values or not. Application code may reference the names it needs (unavoidable); prose docs must not shopping-list them.

