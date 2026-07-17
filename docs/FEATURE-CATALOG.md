# Feature Catalog

Status: canonical contract; detailed feature assessment pending Pre-Audit C

Last verified: 2026-07-17

## Tóm tắt cho chủ doanh nghiệp

Tài liệu này quy định cách ghi nhận một tính năng là đang hoạt động, hoạt động một phần, mới chỉ có kế hoạch hoặc đã ngừng dùng. Danh sách chi tiết chưa được điền trong Pre-Audit B vì chỉ nhìn thấy màn hình/code chưa đủ để kết luận tính năng thật sự hoạt động.

Pre-Audit C sẽ kiểm tra từng nhóm chức năng, gắn bằng chứng và điền trạng thái. Cho đến lúc đó, không dùng tài liệu này để quảng cáo một tính năng là đã có.

## Purpose

This catalog will become the evidence-backed inventory of business capabilities. It is separate from:

- [`ROADMAP.md`](ROADMAP.md), which tracks pending work;
- [`COMPLETED.md`](COMPLETED.md), which indexes completed outcomes;
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md), which describes system boundaries;
- audit evidence, which proves a specific check at a specific time.

Pre-Audit B defines the contract only. Pre-Audit C owns the first complete population.

## Approved status vocabulary

| Status | Meaning | Minimum evidence |
|---|---|---|
| `LIVE_VERIFIED` | Available in the current operating scope and verified through current code plus a suitable test, audit, or operator check | Entry point, data path, and successful verification evidence |
| `LIVE_UNVERIFIED` | Appears available in current code/runtime but lacks enough current evidence to call verified | Current entry point or callable path, with the missing verification named |
| `PARTIAL` | Some intended behavior is available, but a material limitation or missing path remains | Working subset and explicit limitation |
| `PLANNED` | Approved future work that is not currently available | Roadmap/owner decision; no claim of runtime capability |
| `DEFERRED` | Intentionally postponed or out of current scope | Decision, reason, and revisit condition |
| `RETIRED` | No longer an active capability | Removal/decommission evidence and successor if any |

Do not use `COMPLETE`, `MISSING`, “implemented,” or a page's existence as a substitute for this evidence-aware vocabulary.

## Evidence rules

A feature record must distinguish these evidence types:

1. **Route/UI evidence:** a current user entry point exists.
2. **Server/data evidence:** the action, query, RPC, or external integration exists.
3. **Automated verification:** relevant unit, property, component, integration, or audit checks pass.
4. **Operator verification:** a real user completed the critical flow in the intended environment.
5. **Policy evidence:** owner-approved business/access rules define the expected behavior.

`LIVE_VERIFIED` requires evidence appropriate to the risk. For example, a backup feature needs schema/retention and restore-input evidence; an access-control feature needs role/enforcement evidence, not only a visible page.

## Feature record schema

Pre-Audit C should create one record per independently understandable capability:

| Field | Required content |
|---|---|
| Feature ID | Stable identifier such as `POS-CHECKOUT` or `INV-PURCHASE-ORDER` |
| Business capability | Plain description of the outcome for the user/business |
| Intended users | Business roles from [`ACCESS-MODEL.md`](ACCESS-MODEL.md) |
| Current entry points | Routes, actions, scripts, or scheduled integration |
| Status | One approved status from the table above |
| Evidence | Tests, audits, operator result, policy, or commit links |
| Known limitations | Material gaps, scope boundaries, or unsafe assumptions |
| Data affected | Main business records or external destination |
| Last verified | Date and environment |
| Owner/maintainer | Risk-boundary owner from [`COLLABORATION.md`](COLLABORATION.md) |

## Pre-Audit C module scope

The paths below seed discovery only. They do not assign a feature status.

| Module group | Seed entry points | Assessment status |
|---|---|---|
| Authentication and sessions | `app/login`, `app/api/auth`, `lib/auth.ts` | Status to be assigned by Pre-Audit C |
| Business scope and brand/outlet data | `app/admin/brands`, relevant schema/reference data | Status to be assigned by Pre-Audit C |
| POS and drafts | `app/pos` | Status to be assigned by Pre-Audit C |
| Orders and order lifecycle | `app/admin/orders` | Status to be assigned by Pre-Audit C |
| Products, variants, modifiers, recipes | `app/admin/products`, related libraries | Status to be assigned by Pre-Audit C |
| Promotions and pricing | `app/admin/promotions`, price-history paths | Status to be assigned by Pre-Audit C |
| Purchasing and suppliers | `app/admin/inventory/purchase-orders`, `app/admin/suppliers` | Status to be assigned by Pre-Audit C |
| Inventory and stock ledger | `app/admin/inventory`, ledger/audit libraries | Status to be assigned by Pre-Audit C |
| Production and semi-products | `app/admin/production`, `app/admin/semi-products` | Status to be assigned by Pre-Audit C |
| Revenue, COGS, and reports | `app/admin/reports`, report/audit libraries | Status to be assigned by Pre-Audit C |
| Backdated-ledger review and data audit | `app/admin/audit`, `scripts/audit-*` | Status to be assigned by Pre-Audit C |
| User administration and access | `app/admin/users`, user-admin function | Status to be assigned by Pre-Audit C |
| Backup, retention, and restore readiness | backup Edge Function, Apps Script, Drive policy | Status to be assigned by Pre-Audit C |
| Notifications and external integrations | Edge Functions and integration actions | Status to be assigned by Pre-Audit C |
| Settings and maintenance tools | `app/settings`, selected admin maintenance routes | Status to be assigned by Pre-Audit C |

## Cross-cutting assessment matrix

Pre-Audit C must evaluate these claims across modules rather than infer them from one route:

- mobile usability;
- offline behavior;
- multi-brand/outlet scope;
- role and data-scope enforcement;
- audit trail and actor attribution;
- historical snapshot behavior;
- export/notification behavior;
- failure recovery and idempotency;
- backup completeness and restore readiness;
- Vietnamese user-facing language and accessibility.

Offline ordering and multi-brand/outlet operation start with no live status. Owner decision D1 places multi-brand/outlet in future scope, and D2 requires offline behavior to remain unverified or planned until evidence exists.

## Population and maintenance workflow

1. Pre-Audit C enumerates current routes, actions, scripts, migrations, integrations, and tests.
2. It groups technical paths into business capabilities rather than making one record per file.
3. It assigns the most conservative supported status.
4. It links evidence and records missing verification.
5. Owner/Claude reviews business-facing claims; Codex reviews engine/data claims; UI ownership reviews user-facing behavior.
6. Later feature launches, retirements, or material limitations update the record and `last verified` date.

No feature entry should be populated from assumption or historical documentation alone.
