# Access Model

Status: canonical intent and evidence boundary; enforcement verification pending Phase 3

Last verified: 2026-07-17

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này tách hai việc khác nhau: “ai nên được làm gì” và “hệ thống hiện đã chặn đúng hay chưa”. Tên vai trò kinh doanh gồm chủ quán, quản trị, thu ngân và kho. Code hiện chỉ có các vai trò kỹ thuật `ADMIN`, `STAFF` và tài khoản nội bộ `SYSTEM`, vì vậy chưa thể nói hệ thống đã phân quyền đúng theo bốn vai trò kinh doanh.

Ma trận dưới đây là định hướng để kiểm tra, không phải chứng nhận bảo mật. Phase 3 sẽ kiểm tra từng đường thao tác, quyền dữ liệu và lớp bảo vệ trước khi chuyển trạng thái sang `VERIFIED`.

## Evidence labels

| Label | Meaning |
|---|---|
| `INTENDED` | Owner-approved or proposed business access outcome; implementation not proven |
| `OBSERVED` | Current code contains the stated guard, role, or behavior |
| `VERIFIED` | A security review/test demonstrates enforcement, including direct invocation and failure paths |
| `GAP` | Intended access and observed implementation differ, or sensitive data crosses a boundary |
| `UNRESOLVED` | Owner or security decision is still required |

No route, action, RPC, or Edge Function should be called secure solely because the UI hides its button.

## Current operating scope

- One business brand at one operating shop.
- Brand/outlet-specific isolation is not a verified current control.
- Multi-brand, multi-outlet, and franchise access are future scope in [`ROADMAP.md`](ROADMAP.md).
- Cross-shop permissions must be designed before the operating scope expands.

## Business roles

### Owner

**Intent:** Full business authority, including policy approval, user/access decisions, high-risk production operations, backup/restore approval, and financial visibility.

**Current technical mapping:** `ADMIN` (`INTENDED`, not a distinct current code role).

### Admin

**Intent:** Day-to-day administration of catalog, orders, purchasing, inventory, production, reports, and users within owner-approved boundaries. Historical recovery, restore, secrets, and policy changes still require owner approval.

**Current technical mapping:** `ADMIN` (`INTENDED`; exact action coverage pending Phase 3).

### Cashier

**Intent:** Operate POS, manage the active cart/drafts, submit sales, and perform only the limited order follow-up needed at the counter. No user administration, historical recovery, or unrestricted financial/inventory administration.

**Current technical mapping:** `STAFF` (`INTENDED`; middleware behavior is `OBSERVED`).

### Inventory

**Intent:** Work with suppliers, purchase orders, receipts, stock adjustments, production, and stock review without receiving unrelated user/security or recovery authority.

**Current technical mapping:** `UNRESOLVED`. There is no distinct `INVENTORY` technical role in the reviewed auth type. Mapping this role directly to `ADMIN` would grant broader access than the business intent.

### System actor

**Intent:** Identify trusted internal automation or reviewed maintenance execution; never represent a human permission tier.

**Current technical mapping:** `SYSTEM` (`OBSERVED`). Some CLI and fallback paths use it. Phase 3 must verify that external callers cannot obtain SYSTEM authority and that fallbacks do not hide missing sessions.

## Business-to-technical mapping

| Business role | Current technical role | Mapping status | Main limitation |
|---|---|---|---|
| Owner | `ADMIN` | `INTENDED` | Owner and admin are not technically distinct |
| Admin | `ADMIN` | `INTENDED` | Action-level enforcement is not fully verified |
| Cashier | `STAFF` | `INTENDED` + route behavior `OBSERVED` | Direct server-action coverage requires Phase 3 |
| Inventory | None | `UNRESOLVED` | Separate least-privilege role does not exist |
| Internal automation | `SYSTEM` | `OBSERVED` | Must not be assignable as a human role |

## Preliminary permission intent

This table is a review baseline, not final authorization. `Allowed` means intended business access; `Owner approval` means a separate owner decision is required for the operation; `No` means the role should not receive the capability.

| Capability | Owner | Admin | Cashier | Inventory | Current enforcement |
|---|---|---|---|---|---|
| Use POS and manage drafts | Allowed | Allowed | Allowed | No | `OBSERVED` route protection; detailed checks pending |
| Submit normal sales | Allowed | Allowed | Allowed | No | `OBSERVED`; actor fallback review pending |
| View operational orders | Allowed | Allowed | Limited/UNRESOLVED | No | Phase 3 pending |
| Edit or void completed orders | Owner approval/policy | Allowed within policy | No | No | Selected admin checks observed; full inventory pending |
| Manage catalog, recipes, prices, promotions | Allowed | Allowed | No | Limited/UNRESOLVED | Phase 3 pending |
| Manage suppliers and purchase orders | Allowed | Allowed | No | Allowed | Inventory role not technically available |
| Submit stock adjustments | Allowed | Allowed | No | Allowed within policy | Admin-oriented checks observed; mapping unresolved |
| Manage production/BTP | Allowed | Allowed | No | Allowed | Inventory role not technically available |
| View revenue/COGS/P&L reports | Allowed | Allowed | No/UNRESOLVED | Limited/UNRESOLVED | Phase 3 pending |
| Manage users and technical roles | Allowed | Allowed within owner policy | No | No | Admin UI exists; SEC-1 open |
| Approve backdated event recompute | Owner approval | Allowed within reviewed policy | No | No/UNRESOLVED | Route protection observed; action-local hardening pending |
| Run historical recovery/apply | Owner approval only | No by default | No | No | Separate reviewed tooling, not normal UI permission |
| Rotate secrets or deploy backup function | Owner approval | Designated maintainer only | No | No | Operational process, not application role |
| Restore production data | Owner approval only | No by default | No | No | Separate restore plan required |

Any change to this table that broadens access requires owner approval and an implementation/security task. Phase 3 may narrow the table based on actual risk.

## Observed authentication and route boundary

- NextAuth Credentials authenticates application users against Supabase-stored user records.
- The session carries a technical role.
- `middleware.ts` protects `/admin/**` and `/pos/**`.
- STAFF is redirected away from `/admin/**`.
- `requireAdmin()` accepts `ADMIN` and internal `SYSTEM`; `resolveActor()` supports session/CLI actor resolution.
- A privileged Supabase server client can bypass RLS, so server-side authorization and response shaping are essential.

These observations do not prove every Server Action, RPC, API route, or Edge Function has an equivalent guard.

## Sensitive data and secrets

### Intended rules

- Password hashes remain server-side and are used only for authentication/password updates.
- Supabase privileged keys, NextAuth secret, Google credentials, Telegram tokens, and backup pull token remain in approved secret stores.
- Browser payloads and logs contain only the minimum fields needed by the user-facing flow.
- Documentation, screenshots, audit JSON, and test output never include live secret values.

### Known gaps

- **SEC-1 (`GAP`):** raw Users rows can include `password_hash` when passed to authenticated admin Client Components. It is protected by login but violates the server-only sensitive-field rule.
- **System fallback (`UNRESOLVED`):** selected POS actions can attribute an operation to SYSTEM if a session is absent. Phase 3 must determine reachability and business impact.
- **Action-local guards (`UNRESOLVED`):** some admin mutation actions rely on protected routes without an internal role check. Phase 3 must test direct invocation boundaries.
- **RLS coverage (`UNRESOLVED`):** this document does not certify policy coverage, especially because server code uses privileged credentials.

## Verification requirements for Phase 3

Phase 3 should produce an evidence matrix covering:

1. every user-reachable route and Server Action;
2. direct invocation without a session;
3. wrong-role invocation;
4. brand/shop/outlet data scope;
5. RPC execution and privileged server-client use;
6. API route and Edge Function authentication;
7. sensitive-field serialization/logging;
8. SYSTEM/CLI-only paths;
9. RLS policies and bypass assumptions;
10. session expiry, disabled users, and role changes.

Only rows with reproducible evidence should become `VERIFIED`. Findings and implementation changes belong in the security task, not in silent edits to this document.

## Supporting documents

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — runtime/trust boundaries
- [`BUSINESS-RULES.md`](BUSINESS-RULES.md) — approved access and write-safety rules
- [`FEATURE-CATALOG.md`](FEATURE-CATALOG.md) — capability evidence
- [`ROADMAP.md`](ROADMAP.md) — SEC-1 and future security work
- [`COLLABORATION.md`](COLLABORATION.md) — risk-boundary ownership and production-write protocol
- [`audits/2026-07-17-pre-audit-b-owner-decisions.md`](audits/2026-07-17-pre-audit-b-owner-decisions.md) — D1–D8 approval record

Update this document when business roles, technical roles, data scope, authentication, protected surfaces, secrets, or Phase 3 verification results change.
