# Production Deploy Plan: 63 Commits (2026-07-27 → 2026-07-29)

> **For agentic workers:** the owner performs the deploy itself. Claude Sonnet 5 runs the pre-flight and drives the verification; it must not push or promote a deployment.

**Goal:** Get 63 local commits onto production safely, and be able to undo it, before Phase 4 rebuilds any data.

**Why this must happen before Phase 4:** the non-inventory engine fix (stop writing `SALES_CONSUME` rows for Nước, Nước sôi, Đá viên) lives in these commits and is not deployed. Rebuilding first would clean those rows and the still-old production code would start re-writing them on the next sale. Deploy, let it run a day, then rebuild.

## Scope

Last deployed commit: `6ebe8a0` (2026-07-27). Since then: 66 code files, +3,039 / −76 lines, plus 27 docs-only commits.

| Change | Blast radius | Notes |
|---|---|---|
| **POS offline resilience** (tasks 1–9 + review fixes) | **The selling path** | IndexedDB order queue, background sync sweep, service worker. The largest behavioral change and the one to verify hardest. |
| Non-inventory engine fix | Ledger writes | Stops emitting consumption rows for flagged ingredients |
| Promotion timing fix | Pricing | Resolves promo eligibility against sale time, not sync-time clock |
| PO subtotal guard | Purchase entry | Rejects a COMPLETED save whose header total disagrees with its lines |
| Admin edit of completed POs + edit trail | Purchase entry | New capability, `?edit=1` opt-in, ADMIN only |
| Audit tooling | None at runtime | `scripts/` and `lib/*-audit.ts` only |

**Schema is already ahead of code.** Migrations 0040 and 0041 were applied to production on 2026-07-29. Deploying now brings code up to the schema — the safe direction. No migration in this batch is unapplied; confirm in step 1 anyway.

## Timing

After close, with no open shift and no order in progress. Not the same night as Phase 4 — one change at a time, so a problem has one candidate cause.

---

### Step 1: Pre-flight (Claude Sonnet 5, before the owner pushes)

- [x] `npx tsc --noEmit` — no output, clean.
- [x] `npm test` — 151 test files, 859 tests, all passed.
- [x] `next build` — compiled successfully, all 40 routes generated.
- [x] Confirm every migration in `supabase/migrations/` is applied to production. `npx supabase migration list` shows local 0001-0041 all matched by remote 0001-0041 — nothing pending.
- [x] Fresh backup snapshot taken (dry run, no writes): 40/40 tables, 52,253 rows, 32.9 MB. Recorded in `docs/audits/2026-07-29-preflight-backup-snapshot.json`.
- [x] Reported to the owner (see below).

---

### Step 2: OWNER ACTION — push

**This step is the owner's. Do not perform it.**

> **Deviation, 2026-07-29:** owner explicitly asked Claude Sonnet 5 to run this push instead of doing it himself. Confirmed once via AskUserQuestion before running (this is a production-deploy trigger, not a default-autonomous action) and the owner chose "push luôn". Pushed `9ae2ce5` (`6ebe8a0..9ae2ce5`). Recorded here rather than silently overriding the plan's own written instruction.

```bash
git push origin main
```

Vercel builds and deploys from `main`. Confirm in the Vercel dashboard that the deployment is building, then that it succeeds. **If the build fails, nothing is live — production keeps serving the old deployment.** That is a safe failure: report the error and fix it, do not retry blindly.

---

### Step 3: Verify, in this order (owner at the POS, Sonnet assisting)

Ordered by blast radius. **Stop and roll back if step 3.1 or 3.2 fails** — everything below them is administrative and can wait.

**3.1 — The selling path still works.** Open the POS, add an item, complete one real small order. Confirm it appears in today's sales. Nothing else matters if this fails.

**3.2 — Offline behaviour, tested for real.** This is brand new and cannot be verified any other way:

1. Turn off the device's wifi/data.
2. Take an order and complete checkout. It must **succeed and queue**, not block. (Before this deploy it blocked while claiming to be in offline mode.)
3. Turn connectivity back on.
4. Confirm the queued order syncs and appears in sales, with **its real sale time**, not the sync time.

**3.3 — Stock screens load.** Open `/admin/reports/stock`. Confirm it renders and that Nước / Nước sôi / Đá viên are absent from the stock list (they are flagged non-inventory).

**3.4 — The new PO guard works.** Open a purchase order draft, deliberately leave the item list and the total inconsistent, and try to save it as completed. It must be **rejected** with a message about the total not matching.

**3.5 — Admin PO edit exists and is gated.** On a COMPLETED purchase order, confirm a "Sửa phiếu" affordance appears for the admin account, that plain viewing does **not** open the edit form, and that saving an edit now succeeds without the false error the owner hit on 2026-07-29 (migration 0041 is applied, so the trail write works).

---

### Step 4: Watch for a day

Normal trading. Things worth a glance at close:

- Any order that failed to sync — check the `pos_sync_failures` table.
- Sales total for the day looks plausible against the till.
- No new negative ingredient beyond the known list.

Report to the owner at end of day. Only after a clean day does Phase 4 get scheduled.

---

## Rollback

**Primary lever — Vercel instant rollback.** In the Vercel dashboard, promote the previous deployment (`6ebe8a0`). This takes effect immediately and needs no build. Use it for anything wrong in step 3.1 or 3.2.

**Do not roll back migrations 0040 or 0041.** Schema ahead of code is safe — the old code simply ignores the new column and tables. Schema *behind* code is not. Leave them.

**Secondary lever — the service worker.** `public/pos-sw.js` caches two things and only two: navigations to exactly `/pos`, and `/_next/static/` assets (content-hashed by the build, so a new build produces new URLs). Everything else goes to the network, and admin pages are never intercepted.

If a Vercel rollback does not fix odd POS behaviour, a cached POS shell in the barista's browser is the remaining suspect. The fix is **not** another rollback:

1. Bump `CACHE_NAME` in `public/pos-sw.js` from `pos-shell-v1` to `pos-shell-v2`.
2. Deploy that.

The worker calls `skipWaiting()` and `clients.claim()`, so the new version takes control on the next page load rather than waiting for every tab to close. A device that is stuck can also be cleared by hand: browser settings → clear site data for the app's domain.

**Rollback does not undo data.** Any order taken between deploy and rollback is real and stays. That is correct — do not try to reverse it.

---

## What this plan deliberately does not do

- No data rebuild. That is Phase 4, a separate night.
- No migration changes.
- No `--force`, no history rewriting, no skipping the pre-commit hook.

## After a clean day

Phase 4 (`docs/superpowers/specs/2026-07-29-clean-rebuild-program-design.md`) becomes schedulable. Its own prerequisite — the verified restore drill — passed on 2026-07-29.
