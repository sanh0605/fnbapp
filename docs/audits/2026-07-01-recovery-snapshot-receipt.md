# Recovery Snapshot Receipt

Date: 2026-07-01
Run ID: `recovery-20260701T151428127Z`
Status: `VALID`

## Contents

- Source pairs: 27 Google Sheets tabs and 27 Supabase tables.
- Google Sheets rows: 9,664.
- Supabase rows: 10,646.
- Data files verified: 108.
- Total files including manifest: 109.
- Google Sheets representations: formatted, unformatted, and formula.

## Integrity

- Manifest size: 1,198,489 bytes.
- Manifest SHA-256:
  `7CBA4EB14D8D76946F73C88F13F460AEF880999A705524A66C55CB4A9284CB07`.
- Verification command:
  `node_modules\.bin\vite-node.cmd scripts/verify-recovery-snapshot.ts recovery-20260701T151428127Z`
- Verification result: 108/108 data files matched recorded SHA-256 and byte
  counts.

## Storage And Safety

The full bundle is stored under the local gitignored
`recovery-snapshots/recovery-20260701T151428127Z` directory. It must not be
committed because it contains complete operational data, including sensitive
user fields. No Supabase or Google Sheets data was written during capture or
verification.

This receipt proves the baseline capture. A new immutable snapshot is still
required immediately before any production migration or data repair because
operational data may change after this run.
