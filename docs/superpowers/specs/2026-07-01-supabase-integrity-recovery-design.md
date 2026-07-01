# Supabase Integrity Recovery Design

Date: 2026-07-01
Status: Approved for phased implementation
Owners: Codex (engine/data), Claude (coordination review), Antigravity (UI review)

## 1. Objective

Stabilize the Supabase migration without losing historical or newly-created data.
Supabase remains the operational source of truth. Google Sheets remains an
independent recovery source and human-readable backup.

The implementation must:

- prevent new incorrect writes before repairing historical data;
- preserve raw source exports from both systems before any recovery write;
- compare content at field level, not only row counts and IDs;
- make every recovery script read-only by default and require `--apply`;
- avoid destructive deletes during recovery;
- produce enough evidence to reconstruct or roll back every applied change.

## 2. Data Preservation Contract

Literal bit-for-bit preservation across Google Sheets and PostgreSQL is not a
meaningful cross-system guarantee because both systems normalize numbers,
timestamps, booleans, and JSON differently. The enforceable contract is:

1. Preserve an immutable raw export from each source before mutation.
2. Preserve every source row, field name, field value, and source identifier.
3. Canonicalize values only for comparison; never replace the raw export.
4. Record before/after values for every applied field change.
5. Never delete source data as part of recovery.
6. Make apply operations transactional and idempotent.
7. Verify row, ID, field, relationship, and domain invariants after apply.

No recovery apply may run unless the snapshot and manifest steps complete
successfully.

## 3. Recovery Architecture

### 3.1 Immutable Snapshot Bundle

Before each data phase, create a timestamped bundle outside operational tables:

- raw Google Sheets export;
- raw Supabase export;
- canonical JSON representation;
- SHA-256 hash per file;
- row count and ID-set summary per table;
- schema and column manifest;
- recovery run identifier.

The bundle is append-only. Existing bundles are never overwritten.

### 3.2 Field-Level Reconciliation

Reconciliation uses explicit per-table mappings. It classifies every field as:

- `MATCH`: equivalent after canonical normalization;
- `SOURCE_ONLY`: present in Sheets, absent in Supabase;
- `TARGET_ONLY`: present only in Supabase;
- `KNOWN_TRANSFORM`: expected representation change;
- `CONFLICT`: both sides contain different non-empty values;
- `KNOWN_CORRUPTION`: target value matches a proven migration defect.

Automatic recovery is allowed only for `SOURCE_ONLY` and
`KNOWN_CORRUPTION`. `CONFLICT` requires a reviewed rule or manual decision.

### 3.3 Apply And Rollback

Apply writes use a Supabase transaction function. Each run stores:

- recovery run ID;
- table, row ID, and field name;
- previous target value;
- applied value;
- source hash;
- applied timestamp and actor.

Re-running the same recovery plan must produce zero changes. Rollback restores
the recorded previous values in one transaction.

## 4. Implementation Phases

### Phase A: Stop New Regressions

- Make the compatibility adapter preserve legacy boolean semantics or migrate
  all callers to typed booleans in one bounded change.
- Select recipes deterministically by active status, effective date, end date,
  and creation time.
- Align price-history types and UI with `old_price`, `new_price`, and
  `effective_at`.
- Add missing authorization guards to all admin mutation actions.
- Freeze test time so promotion tests do not depend on the wall clock.

Verification:

- focused regression tests fail before each fix and pass afterward;
- complete test suite and TypeScript pass;
- no remote data writes.

### Phase B: Purchase Order Integrity

- Preserve decimal `Stock_Ledger.unit_cost`; round only BIGINT money columns.
- Replace delete-and-reinsert PO updates with one Supabase transaction.
- Generate IDs without read-max race conditions.
- Add rollback, concurrency, and decimal-cost tests.

Verification:

- purchase ledger audit has no material mismatch;
- failed PO update leaves the original PO, lines, and ledger unchanged;
- no remote data writes until the transaction migration is reviewed.

### Phase C: Migration Content Recovery

Create field-aware audits and recovery plans for:

- `Product_Price_History`;
- `Stock_Ledger.order_event_id` and `cost_at_sale`;
- `Units.description`;
- `Suppliers.phone` and `parent_id`;
- `Promotions.min_order_value`;
- POS draft metadata;
- any additional mismatch discovered by the content audit.

The phase first produces snapshots and a dry-run recovery manifest. Applying
the manifest is a separate user-approved step.

Verification:

- raw snapshot hashes remain unchanged;
- zero unresolved `KNOWN_CORRUPTION` entries;
- every conflict is explicitly reported;
- field-level parity report is retained as an audit artifact.

### Phase D: Backup Reliability

- Track changes by `updated_at`, with a stable `(updated_at, id)` cursor.
- Upsert backup rows by ID instead of blind append.
- checkpoint Orders and Lines as one logical run;
- require a dedicated backup secret, not only the public anon key;
- log partial failures without advancing the cursor.

Verification:

- create, edit, supersede, and void scenarios reach Sheets exactly once;
- retry after an injected failure produces no duplicates or omissions.

### Phase E: Business Data Reconciliation

Diagnose before applying:

- negative inventory;
- MAC COGS drift;
- order-ledger drift;
- purchase-ledger drift;
- order-total mismatch including `UCK000269`;
- Phase 9 balancing rows and their raw-material implications.

Corrections must use historical timestamps and deterministic ordering. A
balancing row cannot be treated as proof that production occurred.

Verification:

- current stock has no unexplained negative item;
- MAC drift is zero or every remaining row is approved and classified;
- order, purchase, and total-consistency audits are clean;
- P&L total and breakdown remain internally consistent.

### Phase F: Workspace Cleanup

- classify all untracked scripts and screenshots;
- archive evidence needed for recovery;
- delete obsolete scratch scripts only after review;
- reject any write script without dry-run and `--apply`;
- keep the worktree and TypeScript gate clean.

## 5. Commit And Approval Boundaries

- One commit represents one verified outcome.
- Do not combine code fixes, schema changes, and production data apply.
- Do not push.
- Schema migrations and data recovery applies require review after dry-run.
- Production data apply requires explicit user approval.
- A failed verification stops the phase; later phases do not continue.

## 6. Acceptance Criteria

The recovery is complete only when:

- tests and TypeScript pass from a clean tracked workspace;
- raw source snapshots and hashes are retained;
- content parity checks compare values, not only IDs;
- no unreviewed conflict was overwritten;
- all write scripts are gated and idempotent;
- backup retries do not duplicate or omit rows;
- inventory, order, purchase, MAC, and P&L audits meet their invariants;
- the final report lists every changed field and its rollback record.

