# Purchase Cost Recovery Result

Date: 2026-07-02
Status: Completed and reversible
Recovery run: `PURCHASE-COST-ROUNDING-2026-07-02`

## User-facing result

Three historical purchase receipt costs that had been rounded to whole numbers
were corrected. Purchase quantities were not changed.

| Purchase order | Ingredient | Before | After | Inventory value change |
|---|---|---:|---:|---:|
| PO-047 | ING-032 | 69 | 68.541667 | -2,199.9984 VND |
| PO-048 | ING-012 | 98 | 98.412698 | +1,299.9987 VND |
| PO-048 | ING-022 | 20 | 19.6 | -10,000 VND |

Net purchase inventory value change: approximately -10,900 VND.

## Data protection

- Immediate pre-apply snapshot: `recovery-20260702T022940392Z`.
- Snapshot verification: 108/108 files valid.
- Snapshot manifest SHA-256:
  `9C0CBDA8CB077E4F684C696B11CDBC7584A36B8F746DD4D8CBAE857AB17DD4C6`.
- Reviewed plan SHA-256:
  `96857b9ad9a1c2cb773881388588f2c83934b08ba1c0031e8f8b5855134c8da5`.
- Recovery audit log rows: 3.
- Re-running the apply command: 0 changes, `already_applied=true`.
- A transactional rollback function is available for this recovery run.

## Verification

- Material purchase-cost mismatches remaining: 0.
- Remaining purchase audit differences: 22, all below 0.003 VND and caused
  by six-decimal storage precision.
- Inventory quantities: unchanged; the same 3 negative-stock ingredients
  remain for separate diagnosis.
- Full tests: 242/242 passed across 41 files.
- MAC audit after corrected input costs: 164 historical lines, aggregate delta
  +119,036 VND. These lines require a separate historical COGS recovery plan.
