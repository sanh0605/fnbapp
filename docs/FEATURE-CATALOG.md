# Feature Catalog

Status: canonical contract; first evidence-backed inventory populated by Pre-Audit C, refreshed 2026-07-20 against the completed eight-gate audit

Last verified: 2026-07-20

## Tóm tắt cho chủ doanh nghiệp

Pre-Audit C đã lập danh sách chức năng dựa trên màn hình, luồng xử lý, bài kiểm tra, công cụ kiểm tra dữ liệu và bằng chứng vận hành hiện có. Trạng thái được ghi thận trọng: có màn hình nhưng thiếu kiểm chứng thực tế vẫn được xem là chưa xác minh; chức năng có giới hạn quan trọng được ghi là chỉ hoạt động một phần. Bản này (2026-07-20) đã cập nhật lại sau khi 8 bước audit hoàn tất — nhiều hạn chế ghi trong bản gốc (đổi mật khẩu dùng luồng dữ liệu cũ, các luồng ghi dữ liệu không atomic, thiếu xác nhận cấu hình JWT) đã được sửa và xác minh, không còn là hạn chế hiện tại.

Hệ thống có nền tảng bán hàng, nhập hàng, tồn kho, giá vốn, báo cáo và sao lưu đã được kiểm chứng ở các phần cốt lõi, và 5 luồng ghi dữ liệu quan trọng (huỷ đơn, sửa đơn, lưu sản phẩm, phiếu sản xuất, duyệt cân bằng kho) nay đều atomic. Các điểm còn cần xem xét tiếp: phục hồi từ file sao lưu chưa được diễn tập, bán hàng khi mất mạng, và mô hình nhiều chi nhánh chưa có — cả ba đều đã được chốt là việc làm sau, theo đúng thứ tự ưu tiên đã thống nhất.

## Purpose

This catalog will become the evidence-backed inventory of business capabilities. It is separate from:

- [`ROADMAP.md`](ROADMAP.md), which tracks pending work;
- [`COMPLETED.md`](COMPLETED.md), which indexes completed outcomes;
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md), which describes system boundaries;
- audit evidence, which proves a specific check at a specific time.

Pre-Audit B defined the contract. Pre-Audit C populated the first complete module-level inventory on 2026-07-17.

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
| Authentication and sessions | `app/login`, `app/api/auth`, `lib/auth.ts` | Populated below |
| Business scope and brand/outlet data | `app/admin/brands`, relevant schema/reference data | Populated below |
| POS and drafts | `app/pos` | Populated below |
| Orders and order lifecycle | `app/admin/orders` | Populated below |
| Products, variants, modifiers, recipes | `app/admin/products`, related libraries | Populated below |
| Promotions and pricing | `app/admin/promotions`, price-history paths | Populated below |
| Purchasing and suppliers | `app/admin/inventory/purchase-orders`, `app/admin/suppliers` | Populated below |
| Inventory and stock ledger | `app/admin/inventory`, ledger/audit libraries | Populated below |
| Production and semi-products | `app/admin/production`, `app/admin/semi-products` | Populated below |
| Revenue, COGS, and reports | `app/admin/reports`, report/audit libraries | Populated below |
| Backdated-ledger review and data audit | `app/admin/audit`, `scripts/audit-*` | Populated below |
| User administration and access | `app/admin/users`, user-admin function | Populated below |
| Backup, retention, and restore readiness | backup Edge Function, Apps Script, Drive policy | Populated below |
| Notifications and external integrations | Edge Functions and integration actions | Populated below |
| Settings and maintenance tools | `app/settings`, selected admin maintenance routes | Populated below |

## Pre-Audit C feature inventory

The inventory below is a repository-and-evidence assessment, originally populated by Pre-Audit C on 2026-07-17 and refreshed on 2026-07-20 against the completed eight-gate audit (Gates 1-8, all closed — see `docs/COMPLETED.md`). `Repository/test environment` means the current checked-out code and the full automated suite (562 tests as of 2026-07-20). Production evidence is named explicitly when available. UI-only capabilities without a current operator walkthrough remain `LIVE_UNVERIFIED` even when their routes exist.

| Status | Capability count |
|---|---:|
| `LIVE_VERIFIED` | 22 |
| `LIVE_UNVERIFIED` | 21 |
| `PARTIAL` | 3 |
| `PLANNED` | 4 |
| `DEFERRED` | 0 |
| `RETIRED` | 2 |
| `REMOVED` | 1 |
| **Total** | **53** |

### 1. Authentication and sessions

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `AUTH-CREDENTIALS` | Sign in with an active username and password and create a JWT-backed session | Owner, administrator, cashier/service staff, inventory/production staff | `/login`; `app/api/auth/[...nextauth]/route.ts`; `lib/auth.ts` | `LIVE_UNVERIFIED` | `app/login/page.tsx`; `lib/auth.ts` selects active Supabase `users` rows and verifies bcrypt hashes | No dedicated authentication integration test or current operator walkthrough is recorded; session revocation after role/status changes is unverified; offline sign-in is unavailable | `users`; encrypted session token | 2026-07-17; repository inspection | Codex (server/data); Antigravity (UI); Claude review |
| `AUTH-SESSION-AUTHZ` | Restrict protected pages and sensitive actions by session and technical role | Owner and administrator; staff restricted to POS | `middleware.ts`; `resolveActor`; `requireAdmin`; protected `/admin/*` and `/pos/*` routes | `PARTIAL` | Gate 2 map; Wave 1 and Wave 2 direct-rejection tests; comprehensive action-guard audit; Gate 3 Phase A (2026-07-19) confirmed all 32 tables have RLS enabled with zero policies (default-deny for `anon`/`authenticated`), independently verified live with a probe SELECT returning zero rows | All 83 action exports have matching local gates, full admin reads are ADMIN-only, POS SYSTEM attribution is CLI-only, and RLS default-deny is now directly confirmed; session lifecycle (revocation after role/status change) remains open | Sessions and all guarded business records | 2026-07-19; repository/tests, audit, and live RLS probe | Codex (server paths); Claude (access policy); Antigravity (UI) |

### 2. Business scope and brand/outlet data

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `ORG-BRAND-MASTER` | Create, edit, list, and delete brands used by catalog, POS, and reports | Owner and administrator | `/admin/brands`; `app/admin/brands/actions.ts` | `LIVE_UNVERIFIED` | Current route and ADMIN-guarded mutations in `app/admin/brands/actions.ts` | No brand CRUD test or current operator walkthrough; deletion impact on historical references is not verified; UI mobile/accessibility verification is incomplete | `brands` | 2026-07-17; repository inspection | Codex (data path); Antigravity (UI); Claude review |
| `ORG-BRAND-SCOPED-OPERATIONS` | Select a brand for POS and filter financial reports by brand | Owner, administrator, cashier/service staff | Admin POS launcher; `/pos?brandId=...`; report filters | `LIVE_UNVERIFIED` | `app/admin/layout.tsx`; `app/pos/page.tsx`; `app/admin/reports/actions.test.ts` verifies `brandId` filtering | One-shop operation is the approved scope; data isolation between independently operated brands/outlets is not certified; POS brand-selection walkthrough is missing | `brands`, products, orders, report results | 2026-07-17; repository/tests | Codex (data); Antigravity (UI); Claude review |
| `ORG-MULTI-OUTLET` | Operate multiple outlets with outlet-specific data and permissions | Future owner, outlet managers | No current canonical entry point | `PLANNED` | Owner decision D1 in `docs/audits/2026-07-17-pre-audit-b-owner-decisions.md`; `CONTEXT.md`; owner sequencing decision 2026-07-18 (`docs/ROADMAP.md` "Future direction" item 4) places this before `ORG-FRANCHISE`, after the current audit + feature-completeness + UI/UX phases | No outlet entity, tenant isolation, outlet-scoped roles, consolidated reporting contract, or verified cross-outlet workflow | Future outlet and tenant records | 2026-07-18; policy review | Claude (scope/policy); Codex (future data model); Antigravity (future UI) |
| `ORG-FRANCHISE` | Operate franchised outlets with franchisee roles, fee/royalty model, and stronger tenant isolation than plain multi-outlet | Future owner, franchisees | No current canonical entry point | `PLANNED` | Owner sequencing decision 2026-07-18 (`docs/ROADMAP.md` "Future direction" item 5); explicitly ordered after `ORG-MULTI-OUTLET`, not concurrent | No franchisee role, fee/royalty model, tenant isolation stronger than multi-outlet, or design work has started | Future franchisee, fee, and tenant records | 2026-07-18; policy review | Claude (scope/policy); Codex (future data model); Antigravity (future UI) |

### 3. POS and drafts

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `POS-CATALOG` | Browse active products, variants, modifiers, promotions, and current inventory context while selling | Cashier/service staff, administrator | `/pos`; `app/pos/page.tsx`; `components/POSScreen.tsx` | `LIVE_UNVERIFIED` | Current POS route and data-loading code; Wave 2 tests verify authenticated best-seller IDs and compact `{id, current_stock}` status reads | No current end-to-end operator walkthrough for catalog completeness, mobile usability, Vietnamese labels, or accessibility; multi-outlet scope is absent | Catalog reference data and compact inventory state | 2026-07-18; repository/tests and access audit | Antigravity (UI); Codex (data); Claude review |
| `POS-CHECKOUT` | Calculate totals, discounts, snapshots, COGS, inventory consumption, and save a completed sale atomically, safe against duplicate submission on retry | Cashier/service staff, administrator | POS checkout in `/pos`; `submitOrderV2`; `savePosOrderAtomic`; migration `0023` | `LIVE_VERIFIED` | Transaction/math tests and production review remain valid; Wave 1 regression test proves anonymous checkout stops before reads or the atomic write; Gate 5 (2026-07-19) added a client-generated idempotency token verified live in production (2 identical retries produced exactly 1 order/line/event/ledger-row) | Financial persistence, local session enforcement, and retry-safe idempotency are verified; online access and one-shop scope remain limitations | `orders_v2`, `order_lines_v2`, `order_events`, `stock_ledger` | 2026-07-19; repository/tests, access audit, and Gate 5 live verification | Codex (transaction/data); Antigravity (UI); Claude review |
| `POS-DRAFTS` | Save, resume, list, and delete in-progress carts by brand | Cashier/service staff, administrator | POS draft controls; `getPOSDrafts`; `savePOSDraft`; `deletePOSDraft` | `LIVE_UNVERIFIED` | Wave 1 tests prove all three actions reject anonymous calls before storage access and preserve explicit CLI SYSTEM saves; `pos_drafts` is in the backup allowlist | Local session enforcement is verified; operator walkthrough, conflict handling, and expiry policy are still missing | `pos_drafts` | 2026-07-18; repository/tests and access audit | Codex (data); Antigravity (UI); Claude review |
| `POS-OFFLINE` | Continue taking orders while disconnected and reconcile safely later | Cashier/service staff | No verified entry point | `PLANNED` | Owner decision D2; `BR-U-001` in `docs/BUSINESS-RULES.md` | No offline queue, conflict policy, local encryption, bill-number reconciliation, inventory reconciliation, or operator acceptance evidence | Future local queue and reconciled order records | 2026-07-17; policy review | Claude (business decision); Codex (future sync); Antigravity (future UI) |

### 4. Orders and order lifecycle

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `ORD-LIST-DETAIL` | Search and inspect current and historical orders with line snapshots | Owner and administrator | `/admin/orders`; `getOrdersV2`; `getOrderDetailV2` | `LIVE_UNVERIFIED` | Current route, action, and snapshot coercion paths; Wave 2 audit verifies local ADMIN guards on both reads; Gate 7 (2026-07-19) rescoped `getOrderDetailV2` to fetch only the viewed order's chain instead of full-table scans, with row-set parity confirmed live (identical results, bounded reads) | No current UI/operator verification for filtering, export, mobile cards, or sensitive-field minimization; large-volume behavior is now bounded per the Gate 7 fix rather than an open concern | `orders_v2`, `order_lines_v2`, catalog snapshots | 2026-07-19; repository inspection, access audit, and Gate 7 live parity check | Antigravity (UI); Codex (data); Claude review |
| `ORD-EDIT-SUPERSEDE` | Edit a completed order by creating a new version, reversing the old inventory effect, and preserving history, in one atomic database transaction | Owner and administrator | Order edit modal; `editOrderV2`; `supersedeOrderV2`; migration `0020` | `LIVE_VERIFIED` | `lib/order-edit-cart.test.ts`; `lib/sheets-db-v2-edit.test.ts`; `app/admin/orders/actions.test.ts`; `lib/order-ledger-audit.test.ts`; Gate 4 Phase B (2026-07-19) converted this to a single atomic RPC, closing the sequential-write/best-effort-rollback gap | ADMIN guard, optimistic version check, snapshots, actor fields, and atomicity are now verified; no production failure drill or current operator walkthrough | Orders, lines, events, reversal and consume ledger rows | 2026-07-19; repository/tests | Codex (transaction/data); Antigravity (UI); Claude review |
| `ORD-VOID` | Void a completed order with reason, reversal ledger, event trace, and actor attribution, in one atomic database transaction | Owner and administrator | Order detail; `voidOrderV2`; `scripts/audit-void-orders.ts`; migration `0017` | `LIVE_VERIFIED` | ADMIN guard and fail-safe/idempotency checks in `app/admin/orders/actions.ts`; `lib/order-ledger-audit.test.ts`; read-only audit script; Gate 4 Phase B (2026-07-19) converted reversal/event/status to one atomic RPC, closing the duplicate-reversal-on-retry gap | Reversal, event, status, and atomicity are now verified; no dedicated current action test beyond the forced-failure suite, no production rollback drill, no notification/export behavior | `orders_v2`, `order_events`, `stock_ledger` | 2026-07-19; repository/tests | Codex (transaction/data); Antigravity (UI); Claude review |
| `ORD-SNAPSHOTS` | Preserve sale-time product, variant, modifier, promotion, recipe, price, and cost evidence | POS staff, owner, administrator, reporting/audit users | Checkout and edit builders; stored line snapshots | `LIVE_VERIFIED` | `lib/order-snapshot.test.ts`; `lib/order-edit-cart.test.ts`; `lib/order-cart.test.ts`; `lib/order-cogs.test.ts`; MAC policy artifacts | BTP recipe replay can legitimately shift after later recipe edits; stored `cost_at_sale` remains authoritative under policy; no general snapshot export UI | Snapshot JSON and `cost_at_sale` in `order_lines_v2` | 2026-07-17; repository/tests and reviewed MAC evidence | Codex (engine/data); Claude policy review |

### 5. Products, variants, modifiers, recipes

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `PROD-CATALOG-MASTER` | Manage product categories, products, variants, status, images, and prices | Owner and administrator | `/admin/products`; `/admin/products/categories`; `saveProduct`; category actions; migration `0021` | `LIVE_UNVERIFIED` | Current routes and ADMIN-guarded mutations; Gate 4 Phase B (2026-07-19) made `saveProduct`'s price/price-history write one atomic RPC, closing the silent-audit-history-loss gap | No complete CRUD/operator test; historical-reference deletion behavior and mobile/accessibility are not fully verified; price/price-history atomicity is now verified | `product_categories`, `products`, `product_variants`, `product_price_history` | 2026-07-19; repository inspection and tests | Codex (data); Antigravity (UI); Claude review |
| `PROD-RECIPE-VERSIONING` | Select effective recipes and create a new version only when ingredients change | Owner and administrator | Product, modifier, and semi-product save actions; `lib/recipe-selection.ts` | `LIVE_VERIFIED` | `lib/recipe-selection.test.ts`; `app/admin/products/modifiers/actions.test.ts`; `lib/recipe-history-audit.test.ts`; `scripts/audit-recipe-history.ts`; `docs/audits/2026-07-04-recipe-audit.md` | Versioning logic is verified, but multi-write UI saves are not universally atomic; later BTP recipe versions can change replay expectations by policy | `recipes`; product/modifier/semi-product references | 2026-07-17; repository/tests | Codex (engine/data); Antigravity (UI); Claude review |
| `PROD-MODIFIERS` | Manage modifier groups, prices, recipes, status, and standalone topping behavior | Owner and administrator | `/admin/products/modifiers`; `/admin/products/toppings`; modifier/topping actions | `LIVE_UNVERIFIED` | Current routes; ADMIN guards; modifier recipe regression tests; topping verification script exists | No full modifier CRUD/operator walkthrough; UI behavior and standalone mapping are not covered by a current end-to-end test; save operations are multi-step | `modifiers`, `recipes`, product/category links | 2026-07-17; repository/tests | Codex (data); Antigravity (UI); Claude review |
| `PROD-COGS-ESTIMATE` | Preview the current estimated recipe cost for menu items | Owner and administrator | `/admin/products/cogs-estimate`; `app/admin/products/cogs-estimate/CogsCalculator.tsx`; `app/admin/products/cogs-estimate/page.tsx` | `LIVE_UNVERIFIED` | Current calculator route; `lib/mac-cogs.ts`; `lib/recipe-selection.ts` | It is a planning estimate, not the pinned historical COGS contract; no direct calculator test/operator walkthrough; BTP shortfall and later recipe changes can differ from sale snapshots | Read-only catalog, recipes, and stock ledger inputs | 2026-07-17; repository inspection | Codex (calculation); Antigravity (UI); Claude review |

### 6. Promotions and pricing

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `PRICE-HISTORY` | Preserve variant price changes as effective-dated history | Owner and administrator; audit/report consumers | Product save action; `lib/price-history.ts`; migration `0021` | `LIVE_UNVERIFIED` | `lib/price-history.test.ts`; price-history insertion in `app/admin/products/actions.ts`; migration parity artifacts; Gate 4 Phase B (2026-07-19) made this part of `saveProduct`'s atomic RPC | The timeline helper is tested and the write path is now atomic with the price update; there is no dedicated history review/export workflow or current operator verification | `product_variants`, `product_price_history` | 2026-07-19; repository/tests | Codex (data); Antigravity (UI); Claude review |
| `PROMO-ADMIN` | Create, edit, scope, activate, and delete promotions | Owner and administrator | `/admin/promotions`; `savePromotion`; `deletePromotionAction` | `LIVE_UNVERIFIED` | Current route and ADMIN-guarded mutations in `app/admin/promotions/actions.ts`; Gate 7 (2026-07-19) added server-side validation (enums, bounded name/code, positive discount, percent ceiling, non-negative minimum order, valid dates, valid per-product values) with tests, closing the gap where direct calls bypassed all browser-only checks | No full CRUD integration test covering every field combination, or operator walkthrough; delete is physical removal; historical sales rely on snapshots rather than the current promotion row; UI/accessibility unverified | `promotions` | 2026-07-19; repository inspection and tests | Codex (data); Antigravity (UI); Claude review |
| `PROMO-CHECKOUT` | Apply eligible flat-price, flat-cash, manual item, and manual order discounts with exact allocation | Cashier/service staff, administrator | POS cart calculation; order builder | `LIVE_VERIFIED` | `lib/order-cart.test.ts`; `lib/order-math.test.ts`; `lib/order-math.property.test.ts`; `lib/order-snapshot.test.ts`; `scripts/audit-order-discounts.ts` | No operator-facing promotion explanation/export; eligibility depends on stored dates/scopes and online reference data; current UI walkthrough is not recorded | Order totals, discount allocations, promotion snapshots | 2026-07-17; repository/tests | Codex (financial logic); Antigravity (UI); Claude review |

### 7. Purchasing and suppliers

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `PUR-SUPPLIERS` | Create, edit, list, and delete supplier records | Owner and administrator; inventory/purchasing staff by intended policy | `/admin/suppliers`; supplier actions | `LIVE_UNVERIFIED` | Current route and ADMIN-guarded mutations; Gate 7 (2026-07-19) added server-side validation (trim, reject blank/overlong name, bound phone/tax-ID/address/links) with tests, closing a gap where whitespace-only names and unbounded text could be stored | No supplier CRUD integration test/operator walkthrough; intended inventory role is not a technical role; deletion reference safety and mobile/accessibility are unverified | `suppliers` | 2026-07-19; repository inspection and tests | Codex (data); Antigravity (UI); Claude review |
| `PUR-PURCHASE-ORDER` | Create or edit a purchase order and its receipt ledger atomically | Owner and administrator | `/admin/inventory/purchase-orders`; `savePurchaseOrder`; `savePurchaseOrderAtomic` | `LIVE_VERIFIED` | `lib/purchase-order-write-plan.test.ts`; `lib/purchase-order-transaction.test.ts`; `lib/purchase-order-transaction-migration.test.ts`; `lib/purchase-order-action-integration.test.ts`; `lib/purchase-order-rpc-readiness.test.ts`; production deployment `docs/audits/2026-07-02-purchase-order-safety-deployment.md`; Gate 8 (2026-07-20) fixed a stale audit-script column reference and reconfirmed 0 missing/0 mismatched ledger entries across all 55 completed POs live | ADMIN-only in current technical model; no current mobile operator walkthrough; corrections to historical purchase cost require a separate reviewed recovery | `purchase_orders`, `purchase_order_lines`, `stock_ledger` | 2026-07-20; production and live audit rerun | Codex (transaction/data); Antigravity (UI); Claude review |
| `PUR-SOURCES-CONVERSIONS` | Maintain purchase sources and unit conversions used to translate receipts into stock quantities | Owner and administrator | Purchase-order form; item/conversion routes and actions | `LIVE_UNVERIFIED` | Current ADMIN-guarded actions; `lib/purchase-ledger-rebuild.test.ts`; purchase-ledger audit tooling; Gate 7 (2026-07-19) added validation requiring a finite conversion rate greater than zero on create/update, closing a gap where zero/negative/infinite/non-numeric rates could be stored | Core conversion calculations have tests, but current CRUD/operator workflow and reference-deletion safety are not verified end to end | `purchase_sources`, `uom_conversions`, purchased items, receipt ledger | 2026-07-19; repository/tests | Codex (data); Antigravity (UI); Claude review |

### 8. Inventory and stock ledger

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `INV-MASTER-DATA` | Manage item categories, base ingredients, purchased items, units, and conversions | Owner and administrator; inventory staff by intended policy | `/admin/inventory/*`; inventory action modules | `LIVE_UNVERIFIED` | Current routes; ADMIN guards; `lib/sheets_db.test.ts` covers data helper pagination/update behavior | No complete CRUD/operator walkthrough; several dependent updates are sequential; intended inventory role is not technically distinct; mobile/accessibility unverified | Inventory reference tables and selected historical PO-line labels | 2026-07-17; repository/tests | Codex (data); Antigravity (UI); Claude review |
| `INV-STOCK-BALANCE` | Derive current quantity and sale-time consumption from the append-style stock ledger | Owner, administrator, inventory/production staff, POS | Inventory/report routes; `lib/inventory-consumption.ts`; stock and ledger audit scripts | `LIVE_VERIFIED` | `lib/inventory-consumption.test.ts`; `lib/order-ledger-audit.test.ts`; `lib/pos-inventory-state.test.ts`; `scripts/audit-current-stock.ts`; production POS comparison in `docs/audits/2026-07-02-pos-checkout-performance-review.md` | Current balance is ledger-derived rather than a physical-count guarantee; known negative-stock items remain unresolved; no offline balance | `stock_ledger` and inventory reference data | 2026-07-02 production; 2026-07-17 tests | Codex (engine/data); Antigravity (UI); Claude review |
| `INV-STOCK-ADJUSTMENT` | Submit, approve, or reject stock corrections with reason and actor fields, in one atomic database transaction | Owner and administrator | `/admin/inventory/stock-adjustments`; adjustment actions; migration `0019` | `LIVE_VERIFIED` | Wave 1 regression tests verify ADMIN-only submission, immediate approval, and ledger creation; `scripts/audit-stock-adjustments.ts`; Gate 4 Phase B (2026-07-19) converted approval to one atomic RPC handling both the always-APPROVED and PENDING-then-approved paths, closing the "approved but no ledger effect" stuck-state gap | Policy narrowed on 2026-07-18: STAFF can no longer submit adjustments. Historical PENDING rows remain reviewable; atomicity is now verified; current operator verification is still missing | `stock_adjustments`, `stock_ledger` | 2026-07-19; repository tests and access audit | Codex (transaction/data); Antigravity (UI); Claude review |
| `INV-NEGATIVE-STOCK` | Detect, classify, and plan correction for negative inventory | Owner, administrator, inventory/production staff | Read-only audit/diagnosis scripts; inventory reports | `PARTIAL` | `lib/negative-stock-resolution.test.ts`; `scripts/audit-negative-stock-periods.ts`; `scripts/audit-current-stock.ts`; `docs/audits/2026-06-26-negative-stock-diagnosis.json` | Diagnosis exists, but physical counts and owner-approved corrections for known items remain unresolved; no automated correction is authorized | `stock_ledger` and affected items | 2026-07-17; repository/tests and historical evidence | Codex (audit/data); owner decides physical corrections |
| `INV-LEGACY-SYNC` | Apply the former V1 inventory synchronization/correction workflow | Administrator | `/admin/inventory/sync`; `/api/inventory/sync/execute` | `RETIRED` | Execute endpoint returns HTTP 410 with explicit instruction to use V2 ledger audit/correction scripts | The scan endpoint and old UI remain discoverable, but no mutation is performed; successor corrections require reviewed V2 scripts rather than this flow | No writes through the retired execute endpoint | 2026-07-17; repository inspection | Codex (retirement/data); Antigravity (remaining UI); Claude review |

### 9. Production and semi-products

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `BTP-RECIPE-MASTER` | Manage semi-product definitions, batch yields, and effective recipe versions | Owner and administrator; production staff by intended policy | `/admin/semi-products`; semi-product actions | `LIVE_UNVERIFIED` | Current ADMIN-guarded actions; shared recipe-selection tests; recipe-history audit | No semi-product action integration test/operator walkthrough; save closes/inserts recipe rows sequentially; current technical roles do not provide a distinct production role | `semi_products`, `recipes` | 2026-07-17; repository/tests | Codex (engine/data); Antigravity (UI); Claude review |
| `BTP-CONSUMPTION` | Consume available semi-product stock first and explode shortages through the effective recipe without double counting COGS | POS, owner, administrator, reporting/audit users | Checkout consumption engine; report/MAC engine | `LIVE_VERIFIED` | `lib/inventory-consumption.test.ts`; `lib/mac-cogs.test.ts`; `lib/order-ledger-audit.test.ts`; reviewed `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md` | Historical replay may shift after recipe changes; pinned sale COGS remains authoritative; negative stock and missing production yield require separate investigation | Sale consumption rows, BTP/base-ingredient ledger, `cost_at_sale` | 2026-07-17; repository/tests and production audit evidence | Codex (engine/data); Claude policy review |
| `BTP-PRODUCTION-ORDER` | Record a production batch, consume ingredients, and add semi-product yield, in one atomic database transaction | Owner and administrator; production staff by intended policy | `/admin/production`; `saveProductionOrder`; `scripts/audit-production-stock.ts`; migration `0018` | `LIVE_VERIFIED` | Current route and ADMIN guard; production ledger audit script; Gate 4 Phase B (2026-07-19) converted this to one atomic RPC, closing the no-cleanup/no-idempotency gap that could silently double-consume ingredients on retry | Production order, item, consume, and yield atomicity are now verified; no action test, rollback drill, or current operator walkthrough | `production_orders`, `production_items`, `stock_ledger` | 2026-07-19; repository inspection and tests | Codex (transaction/data); Antigravity (UI); Claude review |

### 10. Revenue, COGS, and reports

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `RPT-SALES` | Report sales totals and product/modifier detail with date, brand, and category filters | Owner and administrator | `/admin/reports/sales`; `getSalesDataV2` | `LIVE_VERIFIED` | `app/admin/reports/actions.test.ts` sales and ADMIN-rejection cases; `lib/report-time.test.ts`; order-math tests; Gate 7 (2026-07-19) scoped the underlying order/line reads to the report window instead of full-table loads, with row-set parity confirmed | No CSV/spreadsheet export or scheduled delivery; UI mobile/accessibility operator walkthrough is missing; large-table performance is now bounded per the Gate 7 fix | Read-only orders, lines, products, modifiers | 2026-07-19; repository/tests, access audit, and Gate 7 live parity check | Codex (report math/data); Antigravity (UI); Claude review |
| `RPT-PNL-MAC` | Report revenue, pinned MAC COGS, gross profit, and breakdowns without double counting | Owner and administrator | `/admin/reports/pnl`; `getPnLDataV2`; P&L audit scripts | `LIVE_VERIFIED` | `app/admin/reports/actions.test.ts` including direct ADMIN rejection; `lib/report-v2-allocators.test.ts`; `lib/mac-cogs.test.ts`; `scripts/audit-pnl-mac-consistency.ts`; reviewed MAC audit artifacts; Gate 7 (2026-07-19) scoped the underlying order/line reads to the report window, reconfirmed 0 VND delta live on Gate 8 (2026-07-20) | Stored COGS is authoritative while replay differences may be informational; no export/notification; malformed reference data can fail the report rather than silently guess; large-table performance is now bounded | Orders, lines, snapshots, stock ledger, report aggregates | 2026-07-20; repository/tests and reviewed live audits | Codex (financial engine/data); Antigravity (UI); Claude review |
| `RPT-HOURLY` | Show an hourly sales heatmap within the selected period | Owner and administrator | Sales report; `getHourlyHeatmapV2` | `LIVE_VERIFIED` | `app/admin/reports/actions.test.ts` verifies completed-status and UTC-range query; `lib/report-time.test.ts`; Wave 2 action-guard audit | No current visual/operator regression, export, or notification; one-shop scope only | Read-only completed orders | 2026-07-18; repository/tests and access audit | Codex (query/data); Antigravity (UI); Claude review |
| `RPT-STOCK` | View current stock quantities and inventory status | Owner and administrator; POS receives compact stock status only | `/admin/reports/stock`; `getRealtimeStock`; POS `getPOSStockStatus` | `LIVE_UNVERIFIED` | Current ledger-derived stock action; Wave 2 tests verify full ADMIN rejection and narrow authenticated POS shape; stock audit scripts exist; Gate 7 (2026-07-19) reviewed this path and deliberately kept the full-ledger read (current stock requires complete history, not a windowed query) | No report-specific operator walkthrough; physical stock is not certified by ledger balance; export and future inventory-role scope remain unverified | Stock ledger and inventory references; compact POS status | 2026-07-19; repository/tests and access audit | Codex (data); Antigravity (UI); Claude review |
| `RPT-PROMOTION-PERFORMANCE` | Compare promotion usage and attributed revenue/discount outcomes | Owner and administrator | Sales/P&L data actions; `getPromotionPerformanceV2` | `LIVE_UNVERIFIED` | Current server action and promotion/order snapshot data; Wave 2 action-guard audit verifies local ADMIN enforcement; Gate 7 (2026-07-19) scoped the underlying order read to completed orders in range instead of the full table | No dedicated calculation test, current UI entry confirmation, operator walkthrough, export, or historical-policy review | Orders, lines, promotion snapshots, promotions | 2026-07-19; repository inspection and access audit | Codex (report math/data); Antigravity (UI); Claude review |

### 11. Backdated-ledger review and data audit

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `AUD-BACKDATE-DETECT` | Detect stock rows created materially after their effective time and preserve an event for review | Owner, administrator, data/audit maintainer | Migration trigger; `backdated_ledger_events`; audit route | `LIVE_VERIFIED` | Migration `0014_backdated_ledger_detection.sql`; `lib/backdated-ledger/detection.test.ts`; `lib/backdated-ledger/find-affected-lines.test.ts`; Task 3.8 report artifacts | Historical rows before the trigger can be gaps; detection does not itself authorize recomputation; ordinary operator notification is not implemented | `stock_ledger`, `backdated_ledger_events`, affected order-line references | 2026-07-16 production evidence; 2026-07-17 tests | Codex (engine/data); Claude policy review |
| `AUD-BACKDATE-REVIEW` | Review, reject, or explicitly recompute an approved backdated event | Owner approval; designated administrator/data maintainer | `/admin/audit/backdated-ledger`; recompute/reject actions and RPCs | `LIVE_UNVERIFIED` | `lib/backdated-ledger/recompute.test.ts`; `app/admin/audit/backdated-ledger/actions.test.ts`; migration `0015_backdated_event_recompute.sql` | Approve and reject both require an action-local ADMIN session and use its actor as reviewer; current UI/operator walkthrough and notification are still missing | Event status, selected line COGS, recovery change log | 2026-07-18; repository/tests | Codex (recompute/data); Antigravity (UI); Claude review |
| `AUD-MAC-COHORT` | Classify current MAC replay differences into operationally actionable and informational cohorts | Owner, administrator, data/audit maintainer | `scripts/audit-mac-drift-baseline.ts`; `lib/mac-drift-baseline.ts` | `LIVE_VERIFIED` | `lib/mac-drift-baseline.test.ts`; `docs/audits/2026-07-09-mac-drift-baseline-audit.md`; `docs/audits/2026-07-16-btp-recipe-replay-drift-policy.md`; first cohort-aware run was operationally clean | Command-line/operator capability rather than normal UI; requires current production credentials; replay shifts do not imply stored-money errors | Read-only orders, lines, ledger, locks, reviewed artifacts | 2026-07-16 production; 2026-07-17 tests | Codex (audit engine/data); Claude policy review |
| `AUD-HISTORICAL-LOCKS` | Protect reviewed historical COGS rows and require a narrow reviewed escape path for any change | Owner approval; data/audit maintainer | `audit_baseline_locks`; migrations `0012` and `0016`; cohort lock scripts | `LIVE_VERIFIED` | Task 3.7/3.9 planner and script tests; result artifacts; production trigger-block verification summarized in `docs/COMPLETED.md` | Locking classifies/protects history but does not make replay values immutable; any future recovery still needs a separate approved dry-run/apply plan | `audit_baseline_locks`, protected `order_lines_v2.cost_at_sale` | 2026-07-16 production; 2026-07-17 repository review | Codex (engine/data); owner/Claude approve policy |

### 12. User administration and access

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `USR-ADMIN` | Create, edit, delete, and reset technical ADMIN/STAFF users | Owner and administrator | `/admin/users`; user actions; `user-admin` Edge Function | `LIVE_VERIFIED` | ADMIN read/mutation guards and safe projections have tests; Wave 1 rejects a forged service-role payload and accepts only the exact runtime service key for `/migrate`; SEC-4 (2026-07-20) confirmed the deployed platform JWT flag directly via `supabase functions list` (`verify_jwt: false`) and verified this is safe regardless — `/migrate` uses the constant-time secret comparison, and every other route independently calls `admin.auth.getUser()` plus requires `role === 'owner'` | SEC-1 and all local app-action gaps are closed; deployment JWT settings are now directly confirmed rather than assumed unverifiable. Operator/session-invalidation checks remain open | `users` and active sessions | 2026-07-20; repository/tests, access audit, and live deployment check | Codex (server/data); Antigravity (UI); Claude security coordination |
| `USR-ROLE-ENFORCEMENT` | Enforce technical ADMIN/STAFF/SYSTEM roles while documenting intended business roles separately | Owner, administrator, cashier/service staff, inventory/production staff | `middleware.ts`; `resolveActor`; `requireAdmin`; admin action guards | `PARTIAL` | Gate 2 map; Wave 1 and Wave 2 direct-rejection tests; comprehensive action-guard audit; Gate 1 tests; `docs/ACCESS-MODEL.md`; Gate 3 Phase A/B (2026-07-19) confirmed RLS default-deny live and removed unnecessary broad grants (28 tables down to 0) | All 83 actions have matching local gates, POS SYSTEM is CLI-only, and RLS/grants are now directly confirmed; session lifecycle and a future distinct Inventory role remain unresolved | Authorization decisions across all business data | 2026-07-19; repository/tests and audit | Claude (access policy); Codex (server enforcement); Antigravity (UI visibility) |

### 13. Backup, retention, and restore readiness

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `BKP-FULL-SNAPSHOT` | Produce an authenticated, schema-versioned full snapshot of all 32 approved tables | Owner and backup maintainer | Deployed `backup-to-drive` Edge Function; Apps Script POST pull | `LIVE_VERIFIED` | `lib/drive-backup.test.ts`; `lib/drive-backup-contract.test.ts`; `lib/drive-backup-handler.test.ts`; production HTTP/file verification in `DEVELOPMENT-TRACKING.md` and `docs/COMPLETED.md` | Full snapshot includes sensitive tables and must remain in the owner-controlled folder; capacity migration starts at 20 MB warning/25 MB destination threshold; no database write occurs | Full 32-table database snapshot in JSON | 2026-07-16 production; 2026-07-17 tests | Codex (backup architecture); Claude final policy approval |
| `BKP-DRIVE-RETENTION` | Store daily snapshots for 180 days, one monthly snapshot indefinitely, validate completeness, replace idempotently, and alert on failure | Owner and backup maintainer | `scripts/apps-script/backup-to-drive.gs`; owner Drive trigger around 02:30 Asia/Ho_Chi_Minh | `LIVE_VERIFIED` | Apps Script contract tests; `docs/audits/2026-07-16-drive-backup-policy.md`; `docs/operations/apps-script-drive-backup.md`; owner manual run and Drive file verified in `DEVELOPMENT-TRACKING.md` | One successful manual/production setup does not prove every future scheduled run; owner must monitor executions/alerts and rotate the pull token when needed; monthly restore drill remains separate | Daily/monthly JSON files and Apps Script execution metadata | 2026-07-16 production; 2026-07-17 repository review | Codex (architecture/operations); owner operates; Claude policy approval |
| `BKP-ADMIN-MANUAL` | ~~Start a backup manually from the admin backup page~~ — page fully removed 2026-07-19 (FIX-2). Investigation found the button could never have worked (server has no Drive-write credentials; the real backup is a pull model driven by the owner's own Google Apps Script trigger), so the owner chose full removal over relabeling. The real daily backup is `BKP-DRIVE-RETENTION` above, unaffected by this removal | N/A | N/A (route removed, confirmed absent from the production route table) | `RETIRED` | Commit `fe04f4a`; production build confirms `/admin/backup` no longer in the route table; 3 new tests prove the legacy Sheets code path is never invoked | N/A | N/A | 2026-07-19; repository/tests and build verification | Codex (removal); Antigravity (UI); Claude review |
| `BKP-RESTORE` | Validate and restore a snapshot into an approved target with dry-run and reconciliation | Owner approval; backup/data maintainer | Restore checks in the operations runbook; no production restore command | `PLANNED` | `BR-BACKUP-005`; restore section in `docs/operations/apps-script-drive-backup.md`; owner decision `BR-U-004` | Backup creation is verified, but no scheduled restore drill, approved restore target, row-level reconciliation tool, or production restore authorization exists | Future target database and restored business records | 2026-07-17; policy review | Codex (restore planning); owner/Claude approve any restore |

### 14. Notifications and external integrations

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `EXT-TELEGRAM-ORDER` | ~~Send an order summary to a configured Telegram chat~~ — feature removed 2026-07-19 at owner's request (no longer needed); `supabase/functions/notify-order` deleted | N/A | N/A | `REMOVED` | Owner instruction 2026-07-19; Claude removed the Edge Function and its references | N/A | N/A | 2026-07-19 | Claude (removal) |

### 15. Settings and maintenance tools

| Feature ID | Business capability | Intended users | Current entry points | Status | Evidence | Known limitations | Data affected | Last verified | Owner/maintainer |
|---|---|---|---|---|---|---|---|---|---|
| `SET-PASSWORD` | Let a signed-in user change their own password | All signed-in users | `/settings/password`; `changePasswordAction` | `LIVE_VERIFIED` | Commit `fe04f4a` (2026-07-19, FIX-1): `changePasswordAction` now looks up the actor via `session.user.id` (the field the session callback actually sets) and writes to the live Supabase `users` table with bcrypt (10 rounds, matching `app/admin/users/actions.ts`); 3 new tests | Previously completely non-functional (every attempt returned "account not found") because it read a legacy Google Sheet expecting a session field that was never set; now uses the same auth path as login/admin user management | Supabase `users.password_hash` | 2026-07-19; repository/tests | Codex (auth/data); Antigravity (UI); Claude security review |
| `MAINT-CACHE` | Clear or revalidate selected application caches | Administrator | `/admin/clear-cache`; `/api/revalidate` | `LIVE_UNVERIFIED` | Local ADMIN guard and rejection/authorized-path regressions in `app/api/revalidate/route.test.ts` | The formerly open API route is now session-guarded; no current operator walkthrough; affected cache tags use legacy names, so practical cache coverage remains unverified | Next.js cache only | 2026-07-18; repository/tests | Codex (server path); Antigravity (UI); Claude security review |
| `MAINT-INVENTORY-SCAN` | Scan V2 order-ledger discrepancies without applying a correction | Administrator and data/audit maintainer | `/admin/inventory/sync`; `/api/inventory/sync/scan`; `auditOrderLedger` | `LIVE_UNVERIFIED` | `lib/order-ledger-audit.test.ts`; local ADMIN guard and route regressions in `app/api/inventory/sync/scan/route.test.ts`; execute endpoint is retired with HTTP 410 | The formerly open read-only endpoint is now session-guarded; no current operator walkthrough; there is deliberately no automatic correction or export | Read-only orders, lines, stock ledger, inventory names | 2026-07-18; repository/tests | Codex (audit/data); Antigravity (UI); Claude security review |
| `MAINT-ACTIVITY-LOG` | Review recorded order events and actor/activity history | Owner and administrator | `/admin/activity-log`; `Order_Events` queries | `LIVE_UNVERIFIED` | Current protected route and order-event records written by checkout/edit/void flows | No dedicated test/operator walkthrough; coverage is not a complete system-wide audit log; actor attribution gaps remain in selected workflows; export/retention policy unverified | `order_events` and selected actor fields | 2026-07-17; repository inspection | Codex (data); Antigravity (UI); Claude review |
| `OPS-CLIENT-ERROR-LOG` | Capture client-side crashes (message, stack, digest, URL, timestamp) from both error boundaries and log them server-side for later retrieval | Any signed-in user (source of the report); owner/administrator (reader, via Vercel logs) | `POST /api/client-errors`; `app/error.tsx`; `app/global-error.tsx`; `lib/client-error-report.ts` | `LIVE_VERIFIED` | `app/api/client-errors/route.test.ts`; `lib/client-error-report.test.ts`; `app/client-error-boundaries.test.ts` | Requires the reporting session to still be authenticated when the crash occurs (a crash before session establishment isn't captured); no dashboard/alerting, only searchable Vercel Runtime Logs; log retention is Vercel's, not a dedicated table | Structured `[ClientError]` log lines only; no database row created | 2026-07-19; repository/tests | Codex (route/logging); Claude (added the boundaries this depends on) |

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
