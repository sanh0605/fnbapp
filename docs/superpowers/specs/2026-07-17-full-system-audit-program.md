# Full System Audit Program (Future)

Date: 2026-07-17
Status: **Pending owner trigger** — NOT current work
Estimated effort: multi-month, multi-agent program

## Owner decision required

Đây là plan audit toàn diện (pre-audit + 8 gates + 4 phases). Trước khi start, cần owner confirm:

1. **Scope**: audit toàn hệ thống (current code + production data) — OK?
2. **Priority**: business-priority order (docs → features → baseline → P0 → business logic → security → UI) — accept?
3. **Resources**: this is multi-month program. Antigravity + Codex + Claude coordination. OK?
4. **Production data**: read-only audit phases, no production writes without explicit approval — accept?

**Until owner confirms**, current work continues per `docs/ROADMAP.md` (POS-REDESIGN-1 Session 1 next).

## Full methodology

[Lưu toàn bộ nội dung plan dưới đây]

---

You are the lead technical auditor and delivery coordinator for the `fnbapp` repository.

The business owner is a non-technical end user. Communicate status, risks, decisions, and acceptance results in plain Vietnamese. Keep technical implementation notes and agent handoff prompts in English.

### Primary objective

First establish one trustworthy documentation baseline and prove what the system is supposed to contain. Only then begin the full technical audit and remediation program.

Bring the system to a reliable, production-ready state in the following business-priority order:

1. Consolidate current documentation and classify/remove obsolete documentation safely.
2. Inventory, verify, and complete the required features and operational functions.
3. Freeze a reviewed functional baseline and source-of-truth document set.
4. Protect production from immediately exploitable destructive endpoints only.
5. Prove and correct business logic and calculations.
6. Harden authorization, authentication, privacy, and infrastructure security.
7. Improve frontend quality, UI/UX consistency, accessibility, and performance.

Do not reorder these phases unless a newly discovered issue can immediately corrupt, delete, expose, or irreversibly alter production data. Such an issue becomes an emergency gate, not a general security refactor.

## Pre-audit program — Mandatory before the eight audit gates

The full audit must not begin against contradictory documentation or an undefined feature set. Complete the following three stages first.

### Pre-Audit A — Documentation discovery and classification

Do not edit or delete files during the first pass. Inventory all root Markdown files and all documents under `docs/`, including plans, specs, handoffs, audits, runbooks, operations, roadmaps, and completed-work records.

For every document, record:

- path and title;
- last meaningful update and related commit if available;
- stated purpose;
- actual consumers or references;
- whether its claims match current code/configuration;
- classification: `CURRENT`, `HISTORICAL_EVIDENCE`, `SUPERSEDED`, `DUPLICATE`, `GENERATED_ARTIFACT`, or `DELETE_CANDIDATE`;
- successor document for every `SUPERSEDED` item;
- deletion risk and preservation requirement.

Produce a documentation manifest before making any change. Never delete migrations, recovery evidence, production-write receipts, rollback instructions, audit JSON, historical decisions, or compliance/security evidence merely because they are old.

### Pre-Audit B — Source-of-truth consolidation

Create or refresh a minimal canonical document set whose statements are verified against current code and deployment configuration:

1. `README.md` — accurate product overview, current stack, current deployment, setup, and links only.
2. `CONTEXT.md` — business context, scope, terminology, constraints, and owner decisions.
3. `ARCHITECTURE.md` — current runtime architecture, environments, integrations, data flow, trust boundaries, and major modules.
4. `docs/FEATURE-CATALOG.md` — intended and implemented capabilities with status.
5. `docs/BUSINESS-RULES.md` — approved operational and calculation rules; unresolved items clearly marked.
6. `docs/ACCESS-MODEL.md` — intended roles, brand/outlet scope, and preliminary permissions; enforcement is verified later during security audit.
7. `docs/ROADMAP.md` — pending work only, with no completed or duplicate queues.
8. `docs/COMPLETED.md` — compact completed-work index linked to evidence.
9. `docs/TESTING.md` — current test strategy, commands, environments, and known gaps.
10. `docs/COLLABORATION.md` — current agent ownership, change protocol, and approval boundaries.

Canonical documents must link to historical evidence rather than copy large historical narratives into the current source of truth. Add a document index stating which files are authoritative for each subject.

Handle old documents in this order:

1. update incoming links to the canonical successor;
2. move valuable historical material into a clearly indexed archive location if repository policy permits;
3. mark superseded documents with their successor and date;
4. propose a deletion batch with evidence that no live code, script, test, runbook, or canonical document references it;
5. wait for owner approval before permanent deletion;
6. delete only approved `DELETE_CANDIDATE` files in a dedicated reversible commit.

Exit criteria:

- every documentation file is classified;
- canonical documents match current code and configuration;
- contradictory statements are resolved or explicitly logged;
- all historical evidence remains discoverable;
- deletion candidates have an approved manifest and successor/retention decision;
- the owner approves the canonical document set.

### Pre-Audit C — Feature/function inventory and completeness review

Use the canonical business context plus actual code to build a feature catalog. Do not assume that an existing page means the feature is complete.

For each module and function, record:

- business purpose and owner;
- intended users and role/outlet/brand scope;
- current UI entry points, server actions, APIs, RPCs, tables, and external dependencies;
- status: `COMPLETE`, `PARTIAL`, `MISSING`, `LEGACY`, `DUPLICATE`, `BROKEN`, `UNVERIFIED`, or `OUT_OF_SCOPE`;
- happy path, validation, error, retry, interruption, and recovery behavior;
- data created/updated and expected audit trail;
- current tests and missing acceptance coverage;
- business impact, dependency, and recommended priority;
- owner decision needed, if any.

Cover at minimum:

- authentication/session and user administration;
- brand/outlet configuration;
- POS sale, payment, draft/park, edit, void, refund/correction;
- offline/intermittent-network queue, cache, retry, and restart recovery;
- menu, categories, variants, modifiers/toppings, recipes, price history, promotions;
- suppliers, purchasing, receipts, units, and conversions;
- production, semi-products, yields, and recipe consumption;
- stock ledger, inventory counts, adjustments, and negative-stock handling;
- orders and event/audit history;
- revenue, sales, COGS, P&L, inventory, and management reports;
- backup, restore, deployment, monitoring, rollback, and incident recovery.

#### Mandatory F&B capability checklist for this business model

Use this checklist as the minimum expected scope for a multi-brand, multi-outlet beverage business operating mobile carts/takeaway counters. Do not mark a capability missing merely because it belongs to a different restaurant model. Classify each item as `REQUIRED_NOW`, `REQUIRED_FOR_MULTI_OUTLET`, `RECOMMENDED_NEXT`, `OPTIONAL_LATER`, or `NOT_APPLICABLE`, and obtain owner approval for the classification.

##### 1. Organization, brand, outlet, and device setup

- multiple brands under one owner;
- multiple outlets/carts per brand;
- outlet code, address/location, timezone, operating status, opening date;
- brand-specific menu, pricing, promotions, payment settings, and receipt identity;
- staff assignment to one or more outlets;
- active outlet/device selection at shift start;
- prevention of cross-brand/outlet data entry mistakes;
- device/register identity and last-sync status;
- outlet opening hours and temporary closure;
- centralized configuration with controlled outlet-level overrides.

##### 2. Users, roles, shifts, and accountability

- user lifecycle: create, activate, deactivate, password change/reset;
- roles appropriate to owner, manager, cashier/staff, inventory/purchasing, and read-only/accounting if needed;
- brand/outlet scope per user;
- shift open-close, assigned cashier, opening cash, closing cash, and variance;
- action attribution from trusted session, not client-entered staff names;
- activity/audit history for important operational changes;
- handover notes and unresolved cash/order issues between shifts;
- login/session behavior on shared POS devices.

##### 3. Menu and sellable-product management

- categories and display ordering;
- products and active/inactive/sold-out status;
- size/variant management;
- outlet/brand-specific availability;
- base prices and effective-dated price history;
- modifiers such as sweetness, ice, temperature, toppings, extra shot, milk choice, and notes;
- modifier groups, required/optional choices, min/max selection, incompatible combinations;
- standalone topping sales where relevant;
- combos/bundles if used;
- product images and POS display name;
- scheduled availability by day/time;
- temporary sold-out and automatic availability based on stock if approved;
- menu version/snapshot so historical orders remain reproducible after future changes.

##### 4. Recipes, ingredients, and semi-finished products

- raw ingredients, packaging, purchased goods, and semi-finished goods;
- base unit and purchasing/usage units;
- unit conversions with controlled precision;
- recipe per product/variant and effective date;
- recipe version history and sale-time snapshot;
- nested recipes using semi-finished products;
- standard batch yield and actual yield;
- wastage/loss during preparation;
- topping/modifier recipe consumption;
- packaging consumption such as cup, lid, straw, bag, label;
- substitute ingredient policy;
- recipe approval/change audit trail;
- estimated versus actual recipe cost.

##### 5. POS ordering and checkout

- fast category/product selection optimized for peak-hour operation;
- product search and frequently sold items;
- add/remove item and quantity adjustment;
- product customization and line notes;
- cart-level and line-level discounts with reason and permission;
- promotion application and stacking/exclusion rules;
- order notes and customer/pickup name or number when needed;
- dine-in/table functions classified `NOT_APPLICABLE` unless the owner adopts seated service;
- takeaway, pickup/preorder, and delivery-channel order type;
- cash and bank-transfer/VietQR payment;
- split or mixed payment classified according to business need;
- amount received, change due, transfer confirmation, and payment reference;
- payment pending/failed/confirmed states;
- order confirmation with atomic order, line, event, stock, and COGS write;
- unique human-readable order number allocated safely under concurrency;
- receipt/print/share capability if required;
- park/save draft, reopen, rename, ownership, expiry, and delete;
- prevent double submission from repeated taps, refresh, retry, or network timeout;
- clear post-payment state and start next sale quickly.

##### 6. Offline and unreliable-network operation

- cached menu, prices, modifiers, recipes, and essential settings;
- locally persisted active cart and parked drafts;
- durable pending-order queue surviving reload/browser/device restart;
- client-generated idempotency key persisted with the exact payload;
- visible online/offline/sync status;
- automatic and manual retry with backoff;
- duplicate prevention at both client and database boundaries;
- conflict rules when menu price, recipe, promotion, or stock changes during offline time;
- clear operator resolution for failed/rejected sync;
- reconciliation screen for pending, synced, duplicate, and failed orders;
- safe behavior when authentication/session expires offline;
- storage limits, cleanup, and recovery instructions.

##### 7. Order lifecycle and after-sale correction

- order list, search, filter, detail, payment and audit history;
- statuses such as draft, pending payment, completed, voided, corrected/superseded, and sync failed;
- edit completed order through an auditable correction/supersede flow;
- void/cancel with reason, role restriction, inventory reversal, and report treatment;
- refund or repayment handling if used;
- payment-method correction without silently rewriting history;
- duplicate-order resolution;
- preservation of original order, snapshots, versions, actor, reason, and timestamps;
- consistent reversal/recalculation of stock, COGS, revenue, discount, and promotion usage;
- customer complaint/reissue flow classified according to need.

##### 8. Purchasing and supplier management

- supplier profile, status, contacts, lead time, and notes;
- purchased-item catalog and preferred supplier;
- purchase source/channel;
- purchase order draft, submit, approve, receive, reject/cancel, and history;
- partial receipt, over/under receipt, damaged quantity, and backorder if needed;
- purchase unit, conversion to stock unit, unit cost, discount, shipping/other cost, and total;
- invoice/reference number and document attachment if required;
- actual receipt date and backdated-entry controls;
- atomic receipt posting to stock ledger and cost layers;
- duplicate receipt/invoice prevention;
- purchase return to supplier if used;
- supplier price history and purchasing-spend report;
- accounts-payable status classified according to accounting scope.

##### 9. Production and semi-finished-goods control

- production/batch order for brewed tea, coffee base, syrup, cream, sauce, pearls, or other preparations;
- planned versus actual input and output;
- recipe and batch yield captured at production time;
- raw-material consumption and semi-product output posted atomically;
- batch/lot identifier and production timestamp;
- preparer and approver;
- wastage/spoilage and reason;
- expiry/shelf-life and discard alert where operationally required;
- correction/reversal of erroneous production;
- production history and variance report;
- outlet production versus central-kitchen transfer classified according to operating model.

##### 10. Inventory and stock control

- on-hand stock by outlet and item;
- stock ledger as the auditable source of movement history;
- opening balance/import with provenance;
- movement types: purchase receipt, production consume/output, sale consume, adjustment, waste, transfer, return, correction, and reversal;
- stock count/cycle count and count variance;
- adjustment request, approval/rejection, reason, actor, and evidence;
- negative-stock policy and alerts;
- minimum/reorder level and low-stock warning;
- inter-outlet transfer request, dispatch, receive, discrepancy, and in-transit state when multiple outlets hold stock;
- expiry/batch tracking for perishable or prepared items where necessary;
- theoretical stock versus physical stock reconciliation;
- stock valuation using the approved costing method;
- inventory movement, usage, waste, and variance reports;
- no silent deletion or direct balance editing outside an auditable correction flow.

##### 11. Promotions, discounts, and pricing governance

- fixed amount, percentage, item, category, combo, and time-based promotion types as needed;
- validity dates/times and brand/outlet scope;
- eligibility and minimum-spend rules;
- usage limits and single-use code if needed;
- stackable/exclusive rules with deterministic priority;
- promotion snapshot on order;
- manual discount permission, maximum level, mandatory reason, and audit trail;
- price-change approval and effective date;
- reports showing gross sales, discounts, net sales, promotion cost, and performance.

##### 12. Customer, preorder, pickup, and delivery capabilities

- lightweight customer name/phone only if operationally required and legally appropriate;
- preorder date/time, promised pickup time, outlet, status, and handoff confirmation;
- pickup queue/order-number display if needed;
- delivery address, fee, partner/channel, driver/reference, and status if self-delivery is used;
- marketplace/channel order import or manual capture with source attribution;
- channel commission/fee handling for accurate net profitability;
- customer history/loyalty classified `OPTIONAL_LATER` unless approved;
- privacy, retention, consent, and deletion rules for customer data.

##### 13. Cash, payment, and daily reconciliation

- payment methods configurable by outlet;
- cash received/change due and transfer reference;
- opening float, cash in/out with reason, expected cash, counted cash, and variance;
- shift/day close preventing unnoticed unclosed transactions;
- transfer reconciliation against bank/QR records when feasible;
- pending/unconfirmed transfer handling;
- void/refund/payment-correction reconciliation;
- daily sales summary by outlet, cashier, and method;
- immutable close record or auditable reopen with approval;
- tax invoice/e-invoice integration classified separately according to Vietnamese tax obligations and business readiness.

##### 14. Reporting and management controls

- sales by date/time, brand, outlet, product, category, variant, modifier, staff, channel, and payment method;
- gross sales, discounts, net revenue, order count, average order value, and quantity;
- stored COGS, gross profit, and gross-margin percentage;
- ingredient/semi-product consumption and contribution to COGS;
- product profitability and promotion performance;
- purchase, supplier, production, inventory, stock movement, waste, and variance reports;
- shift/cash/payment reconciliation;
- void, correction, refund, manual discount, and privileged-action reports;
- consistent filters and Asia/Ho_Chi_Minh boundaries;
- exclusion/treatment rules for draft, failed, voided, superseded, and backdated records;
- drill-down from aggregate totals to source orders/ledger rows;
- export with the same totals and filters as on-screen reports;
- cross-report reconciliation and documented source of truth for every KPI.

##### 15. Auditability and data integrity

- immutable identifiers and safe human-readable numbers;
- created/updated timestamps and trusted actor identity;
- append-only event/audit history for financially or operationally important changes;
- atomic multi-table writes;
- idempotency keys and database uniqueness constraints;
- optimistic/concurrency controls where simultaneous edits are possible;
- effective-dated price/recipe/configuration snapshots;
- no hard deletion of transactional evidence unless explicitly allowed;
- correction/reversal instead of historical overwrites;
- data reconciliation jobs and explainable mismatch classification;
- controlled backdated entries and recomputation;
- migration provenance, dry run, rollback, and verification receipts.

##### 16. Backup, restore, deployment, and operations

- automated database/data backup with monitored success/failure;
- retention policy and off-platform/off-account copy;
- encryption/token protection and least-privilege access;
- backup completeness manifest, schema version, row counts, and checksums where appropriate;
- restore runbook and actual restore drill into a safe environment;
- recovery-point and recovery-time objectives approved by the owner;
- environment separation for development/test/production;
- migration deployment order and rollback strategy;
- application deployment health check and smoke test;
- logs, alerts, incident ownership, and escalation;
- dependency/security update process;
- operational runbooks for failed checkout, failed sync, data mismatch, backup failure, and production rollback.

##### 17. Optional capabilities that require an explicit business decision

- loyalty points, membership tiers, vouchers, and stored value;
- CRM campaigns and customer segmentation;
- franchise/multi-tenant isolation and franchise fees;
- central warehouse and replenishment planning;
- demand forecasting and automated purchasing suggestions;
- kitchen display system, table/floor management, reservations, and waiter ordering;
- delivery-platform API integration;
- payroll, attendance, scheduling, and commissions;
- full accounting, accounts payable/receivable, and general ledger;
- electronic invoice/tax integration;
- native mobile app, kiosk, customer ordering app, and public online menu.

These optional capabilities must not be built simply because they are common in F&B. Record the owner decision, expected benefit, operational cost, dependency, and timing.

Create business-language acceptance scenarios for every required function. Identify missing/incomplete features and propose a completion roadmap. Do not implement them until the owner approves scope and priority.

Exit criteria:

- the complete intended feature set is known;
- every function has a status and evidence;
- missing and partial features have owner-approved dispositions;
- critical required features are completed and pass end-to-end acceptance tests, or are explicitly blocked;
- a functional baseline commit SHA is recorded;
- canonical documentation is updated to match that baseline;
- the owner authorizes the full eight-gate audit to begin.

### Mandatory eight-gate audit model

The four delivery priorities below do not replace the full audit lifecycle. Work must pass through all eight gates and produce explicit evidence at each gate:

1. **Gate 1 — Close all P0 security exposures**
2. **Gate 2 — Architecture and access map**
3. **Gate 3 — Database/RPC/RLS audit**
4. **Gate 4 — Order/inventory/COGS business audit**
5. **Gate 5 — POS/offline/idempotency audit**
6. **Gate 6 — UI/UX/accessibility audit**
7. **Gate 7 — Performance, backup/restore, and operations audit**
8. **Gate 8 — Regression and final acceptance**

The owner's preferred program order is: documentation consolidation → feature inventory/completion → baseline freeze → emergency P0 containment → calculation correctness → full security hardening → UI/UX/frontend. A gate may first produce an audit baseline and defer non-emergency remediation to the relevant delivery phase, but no gate may be omitted or silently marked complete.

### Mandatory working rules

(Full rules per owner's spec — see sections above)

## Phase 0 — Emergency production containment

This phase must be narrow and completed before business-logic work. Do not redesign the whole authorization system here.

Verify and immediately contain only endpoints/actions that can mutate or expose production data without authentication, especially:

- `app/api/diagnose-order/route.ts`
- `app/admin/audit/backdated-ledger/actions.ts`
- unauthenticated order submission or draft mutation paths in `app/pos/actions.ts`
- user-reading actions that may return `password_hash`

Preferred containment:

- remove obsolete diagnostic routes from the deployed application, or make them unavailable in production;
- add a minimal server-side session/role gate;
- derive actor/reviewer identity from the trusted session, never from client input;
- add regression tests proving anonymous and unauthorized requests are rejected;
- do not expand this phase into a full RBAC redesign.

## Phase 1 — Business logic and calculation correctness

(Full content per owner's spec)

## Phase 2 — Feature and operational-flow completion

(Full content per owner's spec)

## Phase 3 — Full security and authorization hardening

(Full content per owner's spec)

## Phase 4 — Frontend, UI/UX, accessibility, and performance

(Full content per owner's spec)

## Reporting format after each phase

(Full content per owner's spec)

## Mandatory final audit dossier

(Full content per owner's spec — 20 sections)

## Severity definitions

- P0: can immediately corrupt/delete/expose production data, bypass critical controls, or materially falsify financial/inventory records.
- P1: high business impact or likely incorrect operational result; address before expanding use.
- P2: important reliability, maintainability, or workflow issue.
- P3: polish, optimization, or low-impact improvement.

## First action when owner triggers

1. Record the current commit SHA and working-tree/deployment baseline.
2. Execute Pre-Audit A as a read-only documentation inventory. Produce the complete classification manifest and contradiction list.
3. Propose the canonical document set and the exact merge/archive/supersede/delete treatment for every existing document.
4. Separately flag any immediately exploitable P0 exposure discovered during this read-only pass.
5. Present the documentation plan in plain Vietnamese and wait for owner approval before moving, rewriting, archiving, or deleting documents.
6. After documentation consolidation is approved and completed, execute Pre-Audit C and produce the full feature/function catalog with acceptance scenarios.
7. Present missing, partial, duplicate, legacy, and unresolved functions to the owner for scope decisions.
8. Complete only the owner-approved feature roadmap, verify it, freeze the baseline SHA, and refresh canonical documents.
9. Ask for explicit authorization to begin the full eight-gate audit.

## Notes for fnbapp context

- This program will absorb/supersede earlier audits: `docs/audits/2026-06-25-full-system-audit-roadmap.md` (Phase A-E complete), `docs/audits/2026-06-25-mac-cogs-inventory-design.md` spec, etc.
- Existing agent coordination: see `docs/COLLABORATION.md` (Section A-I).
- Existing completed work: see `docs/COMPLETED.md` (chronological archive).
- Current pending work: see `docs/ROADMAP.md`.

When owner triggers this program:
1. Claude authors Pre-Audit A handoff brief.
2. Codex executes Pre-Audit A (read-only doc inventory).
3. Claude reviews → owner approves canonical doc set.
4. Continue per spec.
