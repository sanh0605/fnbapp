# Wave 3 backend brief (Sonnet): `getAssetDetail(id)` read action

Worktree: `C:/tmp/fnbapp-wave3` (branch `feat/list-template-wave3`). Work only there. Plan: `docs/superpowers/plans/2026-10-02-khuon-trang-dot3-tai-san.md`, "Hiện trạng" item 5 and the TS-004 worked example.

## Why
The new asset detail page (`/admin/inventory/assets/[id]`) needs, for one asset: its summary, its monthly depreciation schedule, and its disposals. `getAssetsData()` returns summaries only. Add one read-only action; no writes, no schema change.

## Change — `app/admin/inventory/assets/actions.ts`
Add and export:

```ts
export type AssetDisposalView = { id: string; quantity: number; disposedDate: string; reason: string };
export type AssetDetail = {
  asset: AssetView;                 // same shape as getAssetsData() rows
  schedule: MonthlyCharge[];        // from buildAssetSchedule (import the type from @/lib/assets/asset-depreciation)
  disposals: AssetDisposalView[];   // this asset's disposals, oldest first by disposed_date
  chargedToDate: number;            // totalScheduledCharge(schedule) - asset.remainingValue
};
export async function getAssetDetail(id: string): Promise<AssetDetail | null>
```

- `requireAdmin()` first, same as `getAssetsData` (throw `new Error(auth.error)` when refused, same as there).
- Load `assets` and `asset_disposals` with `findAll` (as the file already does). Asset not found, or `status === "INACTIVE"` → return `null` (the page calls `notFound()`).
- Build the summary exactly as `getAssetsData` does (`summarizeAsset(..., currentSaigonMonth())`) — extract a small shared helper inside the file if that avoids duplicating the field mapping; do not change `getAssetsData`'s output.
- `schedule = buildAssetSchedule({ acquired_date, total_cost, quantity, term_months }, disposalInputs)` using the same numbers.
- `reason` null → `""`.
- Errors: log and rethrow as `getAssetsData` does.

## Tests (red first) — `app/admin/inventory/assets/actions.test.ts`
Use the existing `mocks` (`findAll`, `requireAdmin`). Fix "now" with `vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-15T05:00:00Z"))` so the Saigon month is 2026-10.
1. TS-004 (live data): asset `{ id: "TS-004", name_snapshot: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)", acquired_date: "2026-04-04", unit_cost: 205920, quantity: 2, total_cost: 411840, term_months: 24, status: "ACTIVE" }`, disposal `{ id: "TL-002", asset_id: "TS-004", quantity: 1, disposed_date: "2026-07-02", reason: null }` →
   - `schedule.length === 24`; `schedule[0]` = `{ month: "2026-04", unitsHeld: 2, charge: 17160 }`; month `2026-07` charge `188760` (toBeCloseTo, 6); month `2026-08` `{ unitsHeld: 1, charge: 8580 }` (toBeCloseTo); last month `"2028-03"`.
   - `asset.remainingQuantity === 1`, `asset.remainingValue` ≈ 145860, `chargedToDate` ≈ 265980.
   - `disposals` = `[{ id: "TL-002", quantity: 1, disposedDate: "2026-07-02", reason: "" }]`.
2. Unknown id → `null`. INACTIVE asset → `null`.
3. A disposal of another asset is not included.
4. `requireAdmin` refused → rejects (throws), `findAll` not called.
- Run on the current code first (red from the missing export) and record that; then implement.
- Run `npx vitest run app/admin/inventory/assets` and `npx tsc --noEmit` — both green.

## Do not
- Touch any UI file, `components/`, `scripts/`, `.claude/`, `CLAUDE.md`.
- Change `getAssetsData`, `previewDisposalCharge`, `disposeAsset`, or anything in `lib/assets/`.
- Write to real data, run migrations, push, or deploy. Do not commit — the wave 3 coordinator commits.

Report: files changed, each new test's red reason, green counts.
