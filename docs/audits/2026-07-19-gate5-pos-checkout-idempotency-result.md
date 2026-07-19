# Gate 5 POS Checkout Idempotency Result

Date: 2026-07-19

Scope: POS checkout idempotency, light POS draft retry review, and read-only offline-capability documentation check.

Verdict: Gate 5 implementation and verification complete; ready for Claude review. No push or merge was performed.

## Step 1: fresh correctness baseline

The starting state is recorded in [`2026-07-19-gate5-pos-idempotency-baseline.md`](2026-07-19-gate5-pos-idempotency-baseline.md).

Key baseline evidence:

| Check | Baseline result |
|---|---:|
| Orders / lines / stock-ledger rows | 1,580 / 2,256 / 8,128 |
| Known order-ledger replay mismatches | 301 |
| Orphan order-ledger rows | 0 |
| Negative-stock item IDs | `ING-021`, `ING-024`, `ING-003` |
| P&L MAC delta | 0 VND |

The MAC drift audit was not rerun because its current implementation writes a same-day evidence artifact. Gate 5 preserved the frozen baseline JSON instead; its SHA-256 remains `cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3`.

## Step 2: checkout idempotency

### Implementation

- The browser creates one request token for a canonical checkout payload and reuses it for an identical retry.
- A changed cart, payment method, discount, or promotion creates a new attempt token. A successful checkout clears the token.
- `submitOrderV2` and `savePosOrderAtomic` accept the token optionally, preserving legacy callers that do not send one.
- Migration `0023_pos_checkout_idempotency.sql` adds nullable `orders_v2.client_request_id`, a partial unique index, and a compatible six-argument `create_pos_order_atomic` RPC.
- The RPC serializes same-token requests with a transaction-scoped advisory lock. A retry returns the original order, line count, and ledger count before any new business row is created.
- Missing tokens retain the previous behavior, so older deployed clients and CLI probes remain compatible.

### Forced ambiguous-retry probe

The production probe called the RPC twice with request ID `gate5-idempotency-dd9d2852-c4f8-4d9f-af60-fc742a2db513`. The second call deliberately supplied different generated row IDs while retaining the same checkout token.

| Assertion | Result |
|---|---:|
| Orders with request ID | 1 |
| Persisted order lines | 1 |
| Persisted order events | 1 |
| Persisted `SALES_CONSUME` rows | 1 |
| Rows using retry-only generated IDs | 0 |
| Probe rows remaining after cleanup | 0 |

This reproduces the success-with-lost-response retry scenario and confirms the second request returns the first committed sale instead of duplicating revenue or inventory consumption. The probe uses an isolated `G5T` order-number prefix and cleans all transient rows in `finally`.

Migration listing after apply shows local and remote versions matched through `0023`.

## Step 3: POS draft retry

The detailed verdict is recorded in [`2026-07-19-gate5-pos-draft-retry-check.md`](2026-07-19-gate5-pos-draft-retry-check.md).

- Once the first response supplies a draft ID, later saves update that same draft.
- A new cart without an active draft receives its own UUID-backed ID.
- If the very first save commits but its response is lost, a manual retry can create a second harmless draft. It does not create revenue, COGS, or stock-ledger rows and can be ignored or deleted.

No draft idempotency mechanism was added because the observed residual behavior is low-stakes clutter, not a correctness failure.

## Step 4: offline-capability claim

Repository-wide inspection found:

- `navigator.onLine` and browser `online`/`offline` events provide connectivity status only.
- Both checkout buttons and `handleConfirmCheckout` block submission when offline.
- The offline banner explicitly says the order cannot be sent.
- No POS `localStorage`, `sessionStorage`, IndexedDB, service worker, Workbox, background sync, outbox, or offline order queue exists.
- `app/manifest.ts` provides install metadata only; it does not provide caching or offline execution.

Therefore `docs/FEATURE-CATALOG.md` (`POS-OFFLINE = PLANNED`) and `ARCHITECTURE.md` (`Offline POS capability is UNVERIFIED`) remain accurate. The toast phrase “POS đang chạy ở chế độ ngoại tuyến” describes detected connectivity state, not an offline-order capability; the same screen disables checkout. No offline/PWA work or UI copy change was made.

## Final live verification

Two real business orders were recorded while Gate 5 was in progress. The population changed, but the known correctness classifications did not.

| Check | Final result | Comparison with baseline |
|---|---:|---|
| Orders / lines / stock-ledger rows | 1,582 / 2,258 / 8,137 | Live activity only |
| Orders carrying a request ID | 0 | Probe cleaned; currently deployed legacy client remains compatible |
| Duplicate non-null request IDs | 0 | Clean |
| Known order-ledger replay mismatches | 301 | Unchanged |
| Orphan order-ledger rows | 0 | Unchanged |
| Negative-stock item IDs | `ING-021`, `ING-024`, `ING-003` | Same known set |
| P&L orders / total COGS | 1,561 / 21,854,371 VND | Live activity; COGS increased 17,152 VND |
| P&L MAC delta | 0 VND | Clean |

`ING-003` moved from approximately -131 g to -201 g during live sales. This is continuation of the already logged physical-inventory issue, not a new mismatch category or a Gate 5 write.

## Verification commands

| Command | Result |
|---|---|
| `vitest run` | 98 files, 523 tests passed |
| `tsc --noEmit` | 0 errors |
| `next build` | Passed; 40 routes generated |
| `git diff --check` | Clean |
| `supabase migration list` | Local/remote matched through `0023` |
| `audit-pos-checkout-idempotency.ts` | 0 duplicate request IDs; read-only |
| `audit-order-ledger.ts` | 301 known replay mismatches; 0 orphans; read-only |
| `audit-current-stock.ts` | Same three known negative items; read-only |
| `audit-pnl-mac-consistency.ts` | 0 VND delta; read-only |

The first two sandboxed build attempts timed out because the existing `.next` artifacts were not writable in that sandbox context. Running the same build with access to those generated artifacts completed successfully in 10.3 seconds. No source or build configuration change was needed.

## Stop-and-ping review

- No cashier product/UX decision was required for checkout idempotency.
- The forced retry found no partial-transaction gap in the atomic RPC.
- No new or unlogged audit drift category appeared.
- TypeScript and production build passed; the intermediate build timeout was isolated to generated-artifact permissions.

None of the handoff's stop-and-ping conditions remained active.
