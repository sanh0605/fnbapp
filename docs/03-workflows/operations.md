# Operations flow (POS sync, outlets, brands, activity log, cache)

```flow-decl
routes: /admin/pos-sync, /admin/outlets, /admin/brands, /admin/activity-log, /admin/clear-cache
files: app/admin/pos-sync/actions.ts, app/admin/outlets/actions.ts, app/admin/brands/actions.ts
tables: Pos_Sync_Failures, Outlets, Brands
brCodes: BR-SALE-006
```

**Reviewed, no behaviour change — 2026-09-04:** Phase 6 dead-reference cleanup touched a declared source file's comments only (dead docs/... citations repointed or stripped); no logic changed.

This flow covers the operational back-office screens: the two **outlets** (`001`
and `002`), the two **brands** they carry, the **POS sync failure** log, the
**activity log**, and the **cache** tool. The shop runs two outlets, each bound
to exactly one brand — outlet `001`/`002` carry Phin Đi and Uchako — over a
single shared warehouse (`docs/superpowers/specs/2026-09-02-project-reset-design.md`
§10). A brand always follows the outlet, never the reverse: the order code is
`YYMMDD` + outlet + sequence and `brand_id` is derived server-side from the
outlet at the moment of sale (`BR-SALE-006`). Outlet and brand records are
edited from `app/admin/outlets/actions.ts` and `app/admin/brands/actions.ts`.
POS sync failures are recorded in `Pos_Sync_Failures` by
`app/admin/pos-sync/actions.ts` and surfaced on the pos-sync screen so an
operator can see which device sends did not land. The activity-log and
clear-cache screens are operational tools that read or reset runtime state and
write no business table.

## Five-question current-state description

1. **States, and how each is set.** An outlet and a brand are simple records:
   each exists and is either active or not, set from its admin screen. A
   `Pos_Sync_Failures` row represents one recorded sync failure — it is written
   when a POS device send fails to land, and read back on the pos-sync screen; it
   is a log entry, not a workflow with draft/approval stages. The activity log
   and the cache tool hold no persisted business state of their own: the activity
   log reflects events that already happened, and the cache tool only clears
   cached data on demand.
2. **Buttons per screen, and when to hide them.** The outlets screen at
   `/admin/outlets` and the brands screen at `/admin/brands` each offer create
   and edit for their records. The pos-sync screen at `/admin/pos-sync` lists
   recorded failures for review; its actions concern acknowledging or retrying a
   failed sync rather than editing sales data. The clear-cache screen at
   `/admin/clear-cache` offers a single action to clear cached data — a
   deliberately blunt operational tool. The activity-log screen at
   `/admin/activity-log` is read-only and offers no create/edit/delete, because
   it is a record of what already happened.
3. **What each list contains, and what is excluded.** The outlets list contains
   the outlets (`001`, `002`); the brands list contains the brands each outlet
   carries. The pos-sync list contains recorded sync failures — successful sends
   are not logged here, only failures, since the screen exists to surface what
   needs attention. The activity log contains operational events for review. None
   of these lists contains sales, stock, or cost figures — those live in their
   own flows (sales, stock issue, reports).
4. **Valid inputs, and what happens outside the range.** An outlet needs its
   identifying fields and a brand binding; a brand needs its identifying fields.
   The clear-cache tool takes no data input — it performs one reset action. The
   pos-sync screen operates on already-recorded failure rows rather than
   accepting free-form new data. Because outlet and brand are referenced by
   orders, they are not hard-deleted while orders depend on them; an outlet or
   brand no longer in use is deactivated, not removed, so historical orders stay
   explainable.
5. **Which data it serves, and which it deliberately does not.** This flow serves
   the operational configuration of the shop — its outlets, its brands, and the
   visibility of POS sync health — plus two runtime tools (activity log, cache).
   It deliberately does not serve the sale itself: the completed sale is written
   by the POS device sync, not by these screens. It does not compute cost or
   stock, and the activity-log and clear-cache screens deliberately write no
   business table at all.

## Where it writes

The three write-path files map to exactly three business tables:
`app/admin/pos-sync/actions.ts` writes `Pos_Sync_Failures`,
`app/admin/outlets/actions.ts` writes `Outlets`, and
`app/admin/brands/actions.ts` writes `Brands`. The generated map at
`docs/generated/system-map.md` confirms these three write relations.

The activity-log (`/admin/activity-log`) and clear-cache (`/admin/clear-cache`)
routes have real screens but no entry in the generated map's write relations,
because they write no business table — the activity log reads events and the
cache tool resets cached data. This is why their pages appear under `routes:` but
their files do not appear under `files:`.

> Measured against source: 2026-09-03 — via docs/generated/system-map.md
