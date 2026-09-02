# Incident Response Runbook

Recovery procedures for the four incident classes the project actually has
tooling for. Each entry is **symptom -> first check -> action**. This runbook is
rebuilt from the live tooling; it references only scripts, routes, and docs that
exist in the repository today. When in doubt about a current number, measure it
(CLAUDE.md, Rule 0) -- do not trust a figure written here in the past.

Nothing in this runbook writes to production on its own. Any real restore is a
reviewed, explicit data operation approved by the owner one run at a time.

---

## 1. Restoring data after loss

**Symptom.** Rows are missing, wrong, or a table looks truncated, and normal
editing cannot explain it.

**First check.**
- Confirm a good backup exists. The nightly Drive backup is configured per
  `docs/operations/apps-script-drive-backup.md`; the snapshot logic lives in
  `supabase/functions/backup-to-drive/core.ts` and the Apps Script client is
  `scripts/apps-script/backup-to-drive.gs`. The daily file is named
  `fnbapp-backup-YYYY-MM-DD.json` inside the Drive `daily/` folder.
- Prove the current snapshot is still valid before relying on it. Run the
  read-only verifier, which builds a fresh snapshot from production and validates
  it without writing anywhere:

  ```bash
  npx vite-node scripts/verify-drive-backup.ts
  ```

  A healthy run ends with `LOCAL SNAPSHOT PASS`.

**Action.**
- Never restore into production directly. The restore path targets an explicitly
  declared scratch database. `scripts/restore-backup-to-target.ts` refuses to run
  unless `RESTORE_TARGET_SUPABASE_URL` differs from `SUPABASE_URL`
  (`assertSafeRestoreTarget` in `lib/historical/backup-restore.ts`).
- Restore into the scratch target, then compare it against production with
  `scripts/verify-restore-drill.ts`, which diffs row counts for every backed-up
  table plus content spot-checks.
- Only after the scratch restore is verified, plan the targeted production fix as
  a normal reviewed data operation (CLAUDE.md, "write to real data" row): dry-run
  by default, `--apply` to write, owner approves each write.

---

## 2. POS sync failing

**Symptom.** A sale rung up on a device does not appear in reports, or the POS
screen reports a send that did not land.

**First check.**
- Open the pos-sync screen at `/admin/pos-sync`
  (`app/admin/pos-sync/page.tsx`). It lists unresolved rows from the
  `Pos_Sync_Failures` table so an operator can see which device sends failed.
- The write and read logic is in `app/admin/pos-sync/actions.ts`
  (`getPosSyncAttentionItems` reads open failures; failures are recorded when a
  device send does not land).

**Action.**
- Re-send from the device if the order never reached the server. A resolved
  failure is cleared with `resolvePosSyncFailure`, which sets `resolved` on the
  row; do this only once the underlying order is confirmed present.
- For how this fits the wider operational back-office (outlets, brands, activity
  log, cache), see `docs/03-workflows/operations.md`.
- Before counting the sale as lost, verify against `orders_v2` -- a send can fail
  its acknowledgement yet still have landed. Measure, do not assume.

---

## 3. A migration applied wrong

**Symptom.** After a schema change, an existing feature throws or shows red
errors even though the write itself may have succeeded.

**First check.**
- List what actually ran against the server versus what shipped in
  `supabase/migrations/`. The classic failure is a migration that changed a
  function's **return value** while the TypeScript that reads that value was not
  deployed at the same time.
- Confirm whether the migration altered a return shape (columns dropped or
  renamed) that application code still reads.

**Action.**
- The rule (CLAUDE.md, "run a migration on the real server" row): a migration
  that changes what a function returns must ship **together with** the code that
  reads that return value -- push the code first or in the same step, never the
  migration first. Running the migration ahead of the code means every call
  fails, and an operator retrying can double-write.
- If the two are already out of order, ship the matching code immediately to
  close the gap, then check for duplicate rows created by retries during the
  window.
- When gutting a function's output, list every reader of the result, not just
  its callers (CLAUDE.md, Section 5).

---

## 4. The web build failing

**Symptom.** The site will not build or deploy even though tests and the doc
gates are green.

**First check.**
- Run the build directly:

  ```bash
  npm run build
  ```

  A green `npx tsc --noEmit`, `npx vitest run`, and
  `npx vite-node scripts/check-rules-current.ts` do **not** prove the build
  works. The three gates once stayed green across many commits while a bad
  `"use server"` export broke the build (CLAUDE.md, Section 9).

**Action.**
- Read the first build error and fix it at the source; a `"use server"` file
  exporting a non-async value is one known cause.
- Re-run `npm run build` until it succeeds before declaring the work done.
- Deploy is a separate, owner-approved step. After deploy, someone must open a
  real page while logged in -- a `curl` returning a redirect proves nothing
  (CLAUDE.md, Section 9).
