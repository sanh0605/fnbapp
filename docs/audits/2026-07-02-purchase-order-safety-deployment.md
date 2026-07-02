# Purchase Order Safety Deployment

Date: 2026-07-02
Status: Completed

## User-facing result

Creating or editing a purchase order now has only two outcomes:

1. The purchase order, its item lines, and its inventory receipt are all saved.
2. If any part fails, the previous data remains unchanged.

The application no longer deletes and recreates these records in separate
steps.

## Data protection evidence

- Pre-deployment snapshot: `recovery-20260701T152243267Z`.
- Snapshot files verified: 108/108.
- Google Sheets rows captured: 9,664.
- Supabase rows captured: 10,646.
- Manifest SHA-256:
  `64C5D86CFF5973D84F9B13E35DF1756B2B59AC2210B856C42623F5A4BCF1EE21`.
- Supabase migration `0006_atomic_purchase_order_write.sql`: deployed.
- Remote safety status: `READY`.

## Failure test

The verification intentionally caused PO-048 to fail after the save process
started. PostgreSQL rolled back the transaction.

- Before SHA-256:
  `4d012dca8a7831985d551ff3bd49133984f24979dda5042436fa705be4965986`.
- After SHA-256:
  `4d012dca8a7831985d551ff3bd49133984f24979dda5042436fa705be4965986`.
- Result: `UNCHANGED`.

No historical purchase order, inventory quantity, or COGS value was corrected
as part of this deployment.

## Verification

- Full tests: 234/234 passed across 39 files.
- Purchase conversions: 0 ambiguous and 0 missing.
- Existing business-data issues remain separate:
  - 3 negative-stock ingredients;
  - 129 historical MAC COGS drift lines;
  - 3 material historical purchase-cost rounding mismatches.
