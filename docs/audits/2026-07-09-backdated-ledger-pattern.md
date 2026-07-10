# Backdated Ledger Pattern Audit

Date: 2026-07-09
Owner: Codex
Scope: Task 3.2 Phase A historical pattern audit, read-only.

## Methodology

The audit scanned stock ledger rows whose transaction type can increase inventory: PO_RECEIPT, STOCK_ADJUST, and PRODUCTION_YIELD.

PO_RECEIPT rows are precise: the script compares stock_ledger.created_at (effective timestamp) with purchase_orders.created_at (visibility timestamp) through stock_ledger.reference_id = purchase_orders.id. Rows where the ledger timestamp is earlier than the purchase order creation timestamp are treated as historical backdated receipts.

STOCK_ADJUST and PRODUCTION_YIELD lack a sibling source row with an independent creation timestamp, so the script uses a proxy: effective timestamp older than one day before audit runtime. These rows are counted separately as imprecise and should not be treated as proof of operator backdating without manual review.

VND impact is estimated from existing MAC drift replay by matching current mismatched order lines whose sale time falls between each backdated row's effective timestamp and visibility timestamp and whose replay consumption includes the backdated item_reference. This is a review-queue impact estimate, not a data write and not a recovery plan.

## Counts

- Total entries: 123
- Precise PO entries: 110
- Proxy entries: 13
- Impacted current drift lines: 34

### By Month

| month | count |
| --- | --- |
| 2026-06 | 58 |
| 2026-05 | 27 |
| 2026-04 | 26 |
| 2026-03 | 9 |
| 2026-07 | 3 |

### By Source Table

| source_table | count |
| --- | --- |
| purchase_orders | 110 |
| stock_adjustments | 8 |
| production_yields | 5 |

### Top Item References

| item_reference | count |
| --- | --- |
| ING-032 | 13 |
| NNL-007 | 9 |
| ING-003 | 7 |
| NNL-001 | 5 |
| NNL-002 | 5 |
| ING-006 | 4 |
| ING-017 | 4 |
| ING-026 | 4 |
| ING-028 | 4 |
| ING-029 | 4 |

## VND Impact

- Sum of absolute matched current drift: 2.906 VND

## Sample

| stock_ledger_id | transaction_type | source_id | item_reference | effective_timestamp | visibility_timestamp | lag_minutes |
| --- | --- | --- | --- | --- | --- | --- |
| STK-GEN-1782290592715-3831 | PO_RECEIPT | PO-001 | NNL-002 | 2026-03-26T17:00:00+00:00 | 2026-06-01T10:06:25.881+00:00 | 96066 |
| STK-GEN-1782290592715-3896 | PO_RECEIPT | PO-001 | NNL-002 | 2026-03-26T17:00:00+00:00 | 2026-06-01T10:06:25.881+00:00 | 96066 |
| STK-GEN-1782290592716-1248 | PO_RECEIPT | PO-004 | ING-006 | 2026-03-26T17:00:00+00:00 | 2026-06-01T10:46:51.071+00:00 | 96107 |
| STK-GEN-1782290592716-1635 | PO_RECEIPT | PO-008 | NNL-001 | 2026-03-26T17:00:00+00:00 | 2026-06-01T11:07:23.145+00:00 | 96127 |
| STK-GEN-1782290592716-4327 | PO_RECEIPT | PO-002 | ING-002 | 2026-03-26T17:00:00+00:00 | 2026-06-01T10:42:08.96+00:00 | 96102 |

### Sample Impact Lines

| order_no | line_id | sale_time | product_id | stored_cost | expected_cost | delta |
| --- | --- | --- | --- | --- | --- | --- |
| UCK000272 | ol-25ca7886-a401-4ef1-9b55-2f49b4f009e8 | 2026-06-26T07:02:21.813+00:00 | PROD-016 | 23807 | 24511 | 704 |
| UCK000264 | ol-b9b06a57-33b8-4edd-81e7-b1714d01da69 | 2026-06-25T13:52:10.263+00:00 | PROD-016 | 11903 | 12256 | 353 |
| UCK000255 | ol-c5f61a50-1f15-4b7b-ad67-e5a2b671d858 | 2026-06-25T08:14:33.946+00:00 | PROD-016 | 11903 | 12256 | 353 |
| PHD000893 | ol-35ef2d85-9c6b-42e6-a94b-ca822e384423 | 2026-07-06T00:53:29.949+00:00 | PROD-028 | 11280 | 11479 | 199 |
| PHD000827 | ol-2d7494a5-daac-45bd-8e9d-87bdc9fd2787 | 2026-07-01T00:55:32.356+00:00 | PROD-028 | 11394 | 11280 | -114 |

## Coverage Gap

STOCK_ADJUST and PRODUCTION_YIELD do not currently expose a durable independent source-created timestamp in the same way purchase_orders.created_at does for PO_RECEIPT. Their historical detection is therefore proxy-only. INITIAL_BALANCE is included in the future trigger because it can increase inventory, but it is not included in this historical backfill scan because there is no precise sibling source and legacy initial balances can be intentionally old.

## Recommendation

Phase B remains appropriate if the team accepts that future trigger-captured events are the authoritative review queue and historical rows are audit-only. The recompute engine should operate on backdated_ledger_events rows created after migration 0014, while this report stays as evidence for the policy decision and review workflow sizing.

Generated artifact: `docs/audits/2026-07-09-backdated-ledger-pattern.json`
