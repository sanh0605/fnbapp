# Legacy Code (Pre-V2)

These files are the original V1 implementations, kept for reference.

**DO NOT IMPORT FROM PRODUCTION CODE.**

Files were moved here in WS-5 after V2 equivalents were verified:
- `pos.ts` → replaced by `app/actions/pos-v2.ts`
- `order-edit.ts` → replaced by `app/actions/order-edit-v2.ts`
- `orders.ts` → replaced by `app/actions/orders-v2.ts`
- `reports.ts` → replaced by `app/actions/reports-v2.ts`
- `index.ts` → legacy scaffold from project init, unused

These can be safely deleted after WS-6 verification if no rollback needed.

Reference: `docs/superpowers/plans/2026-06-19-orders-reports-rebuild-ws5-migration-cutover.md`
