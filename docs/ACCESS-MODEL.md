# Access Model

Status: canonical intent plus Gate 2 source-level access evidence; remediation and deeper enforcement verification remain open

Last verified: 2026-07-18

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này tách hai việc khác nhau: “ai nên được làm gì” và “hệ thống hiện đã chặn đúng hay chưa”. Tên vai trò kinh doanh gồm chủ quán, quản trị, thu ngân và kho. Code hiện chỉ có các vai trò kỹ thuật `ADMIN`, `STAFF` và tài khoản nội bộ `SYSTEM`, vì vậy chưa thể nói hệ thống đã phân quyền đúng theo bốn vai trò kinh doanh.

Gate 2 đã lập bản đồ 81 thao tác phía máy chủ và 5 cổng API. Kết quả cho thấy 25 thao tác chưa tự chặn đầy đủ khi bị gọi trực tiếp. Đây là bằng chứng để chia việc sửa, chưa phải chứng nhận toàn hệ thống đã an toàn; quyền dữ liệu, thời hạn đăng nhập và phạm vi nhiều chi nhánh vẫn cần các đợt kiểm tra sau.

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
| Manage users and technical roles | Allowed | Allowed within owner policy | No | No | Credential response exposure closed in Gate 1; read-action direct invocation remains in the Gate 2 findings |
| Approve backdated event recompute | Owner approval | Allowed within reviewed policy | No | No/UNRESOLVED | ADMIN action-local guards and direct rejection tests verified in Gate 1 |
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
- Supabase privileged keys, NextAuth secret, Google credentials, and backup pull token remain in approved secret stores.
- Browser payloads and logs contain only the minimum fields needed by the user-facing flow.
- Documentation, screenshots, audit JSON, and test output never include live secret values.

### Known gaps

- **SEC-1 (`VERIFIED`):** Gate 1 removed raw credential material from the identified admin client/JSON responses and added regression coverage.
- **System fallback (`GAP`):** Gate 2 confirmed that `submitOrderV2` and `savePOSDraft` do not reject a missing session and instead attribute the operation to SYSTEM. SYSTEM is therefore not currently CLI-only.
- **Action-local guards (`GAP`):** Gate 2 found 4 mutation access findings and 21 unguarded read actions. The full per-export evidence is in [`audits/2026-07-18-gate2-access-map.md`](audits/2026-07-18-gate2-access-map.md).
- **Edge Function boundary (`UNRESOLVED`):** `backup-to-drive` has a verified dedicated token, while three legacy/unused functions still depend on deployment JWT settings or incomplete local checks that are not repository-verifiable.
- **RLS/RPC boundary (`EVIDENCE_BACKED`, Gate 3 Phase A):** all 32 live public tables have RLS enabled with zero policies (default-deny for ordinary roles), and a publishable-key `users` probe returned zero rows. The ten live repository RPCs are `SECURITY DEFINER` but EXECUTE is limited to `service_role`; `exec_sql` does not exist live. The server's privileged client remains the intentional bypass. See [`audits/2026-07-19-gate3-database-rls-audit.md`](audits/2026-07-19-gate3-database-rls-audit.md).

## Verification requirements and current evidence

| # | Requirement | Current disposition |
|---:|---|---|
| 1 | Every user-reachable route and Server Action | `EVIDENCE_BACKED` for the current repository: 21 Server Action files / 81 exports and 4 API files / 5 handlers are inventoried in Gate 2 |
| 2 | Direct invocation without a session | `GAP`: 3 POS mutations and 21 reads lack a rejecting local guard; guarded rows have source-level early-exit evidence |
| 3 | Wrong-role invocation | `PARTIAL/GAP`: 56 mutations have matching local gates; `submitStockAdjustment` accepts any authenticated technical role; unguarded admin reads have no local role gate |
| 4 | Brand/shop/outlet data scope | Open; one-shop operation does not prove future multi-branch isolation |
| 5 | RPC execution and privileged server-client use | `EVIDENCE_BACKED` for current live state: 16 live repository RPCs (10 at Gate 3 Phase A, +6 from Gate 4 Phase B's atomic-write conversions, 2026-07-19) are service-role-only; `exec_sql` is absent; the server client intentionally bypasses RLS. G3-A7 (Gate 3 Phase A, Low severity): every service-role-only RPC body has no internal caller/role check of its own — the database EXECUTE grant is the sole backstop, not defense-in-depth. Claude judgment (2026-07-19, technical call, not escalated): acceptable as-is since the grant boundary is the intentional design (server-only architecture), revisit adding an internal check only if an RPC's grant is ever widened beyond `service_role`. Phase B grant/RLS hardening (G3-A4/A5/A6) remains separately scoped, see `docs/ROADMAP.md`. |
| 6 | API route and Edge Function authentication | API inventory evidence-backed with 0 undocumented gaps; Edge Functions remain partial as recorded in the Gate 2 report |
| 7 | Sensitive-field serialization/logging | Gate 1 closed the named credential leak; broad review remains open |
| 8 | SYSTEM/CLI-only paths | `GAP`: unauthenticated POS fallback can currently obtain SYSTEM attribution |
| 9 | RLS policies and bypass assumptions | `EVIDENCE_BACKED` for current live state: 32/32 public tables have RLS enabled, zero policies produce default-deny for ordinary roles, and service-role server traffic bypasses RLS. |
| 10 | Session expiry, disabled users, and role changes | Open for Gate 3 or later |

Only rows with reproducible failure-path evidence should become `VERIFIED`. Gate 2 source evidence identifies what must be tested or remediated next; it does not silently certify unresolved rows.

## Supporting documents

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — runtime/trust boundaries
- [`BUSINESS-RULES.md`](BUSINESS-RULES.md) — approved access and write-safety rules
- [`FEATURE-CATALOG.md`](FEATURE-CATALOG.md) — capability evidence
- [`ROADMAP.md`](ROADMAP.md) — pending access remediation and future security work
- [`audits/2026-07-18-gate2-access-map.md`](audits/2026-07-18-gate2-access-map.md) — per-action, API-route, Edge Function, and SYSTEM evidence
- [`audits/2026-07-19-gate3-database-rls-audit.md`](audits/2026-07-19-gate3-database-rls-audit.md) — live RLS, table grants, RPC execution grants, and browser-key evidence
- [`COLLABORATION.md`](COLLABORATION.md) — risk-boundary ownership and production-write protocol
- [`audits/2026-07-17-pre-audit-b-owner-decisions.md`](audits/2026-07-17-pre-audit-b-owner-decisions.md) — D1–D8 approval record

Update this document when business roles, technical roles, data scope, authentication, protected surfaces, secrets, or Phase 3 verification results change.
