# Stabilization Phase — UI Audit + Drive Backup + Push

Date: 2026-07-16
Status: Pending approval
Owner: Claude (coordination); Antigravity (Phase 1); Codex (Phase 2)

## Context

User wants to stabilize the codebase before pushing 66 local commits to `origin/main`:
1. Audit all frontend pages for consistency gaps (after U4 Fresh Blue migration).
2. Set up daily 1-way Google Drive backup to avoid Supabase-only dependency.
3. Push all changes (final step).

User decisions: scope = ALL pages; sync = 1-way scheduled daily; tables = all 27.

Sequencing: Phase 1 + 2 complete BEFORE Phase 3 push.

## Phase 1 — Frontend UI Consistency Audit (REPORT ONLY)

**Owner**: Antigravity (Gemini 3.5 Flash for regex script, Gemini 3.1 Pro if color-token strategy needed)
**Estimate**: 1 session (~1.5h)
**Atomic commit**: `chore(ui): add UI consistency audit script + report (U4 extension)`

### Deliverable

`scripts/audit-ui-consistency.ts` — regex-based detection script. Output: `docs/audits/ui-consistency-2026-07-16.md`.

**Detection rules**:
- Raw semantic Tailwind colors (`text-emerald-*`, `bg-blue-*`, etc.) — medium
- Hardcoded hex not in tokens — high
- Native `alert(` / `confirm(` — high
- Missing `error.tsx` boundary per route — medium
- Missing `loading.tsx` — low
- `StickyFilterBar` usage (UI-CONSISTENCY-1) — high
- Inline `style={{ color:` — low

**Report sections**:
- Summary table (rule × severity × count)
- Per-route findings (admin grouped, POS, login, public)
- Remediation categories: TOKEN-SWAP / REPLACE-ALERT / REMOVE-STICKYBAR / ADD-BOUNDARY / DEFERRED (modifiers module)
- Known baselines from exploration: ~382 raw color hits expected, 11 alerts, 16 StickyFilterBar clients, 0 error.tsx

**Scope guardrail**: REPORT ONLY. Zero source edits. Output MD is the only artifact.

### Verification
- `npx tsx scripts/audit-ui-consistency.ts` exits 0
- Report file written; spot-check 3 findings vs source

## Phase 2 — Google Drive Daily Backup

**Owner**: Codex (gpt-5.5 standard, escalate to gpt-5.6-sol if schema/migration complexity)
**Estimate**: 1-2 sessions (design + impl + dry-run test)
**Atomic commit**: `feat(backup): add daily Google Drive backup edge function`

### Decision: Fork, don't extend

`backup-to-sheets` is incremental (cursor-based, append orders). Drive backup is full snapshot (all 27 tables daily). Different shape. Fork into `supabase/functions/backup-to-drive/`.

### New code

**`supabase/functions/backup-to-drive/index.ts`** (~250 lines):
- Copy + adapt from `supabase/functions/backup-to-sheets/index.ts`:
  - JWT/OAuth helpers (`ServiceAccountCredentials`, `signJwt`, `getAccessToken`, etc.)
  - `getSupabaseClient`
- New: `TABLES` constant (27 table names), `dumpTable` (paginate 1000/page), `buildBundle` (single JSON), `uploadBundle` (Drive v3 multipart), `listBackups` + `pruneOld` (30-day retention)
- Scope: `https://www.googleapis.com/auth/drive.file` (SA-restricted)

**Bundle format**:
```
{ capturedAt, tables: { [name]: { rows: [...], count } }, schemaVersion: 1 }
```
Mirror `lib/recovery-snapshot.ts` canonical layout for cross-tool restore.

**`supabase/migrations/0009_drive_backup_cron.sql`**:
```sql
select cron.schedule(
  'backup-to-drive-daily',
  '30 19 * * *',  -- 19:30 UTC = 02:30 UTC+7 (30m offset from Sheets job)
  $$ select net.http_post(
    url := 'https://<project>.functions.supabase.co/backup-to-drive',
    headers := jsonb_build_object('Authorization', 'Bearer <anon-key>'),
    body := '{}'::jsonb
  ); $$
);
```

**Folder structure** (on Drive):
```
<GOOGLE_DRIVE_FOLDER_ID>/
  fnbapp-backup-YYYY-MM-DD.json  (30 rolling days)
```

### Env vars (set via `supabase secrets set`)
- Reuse: `GOOGLE_CREDENTIALS_BASE64`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- New: `GOOGLE_DRIVE_FOLDER_ID` (pre-share SA email → Editor)

### Verification
1. Local: `supabase functions serve backup-to-drive --env-file .env.local` + curl POST
2. Drive: confirm file appears, size plausible (sum of 27 tables)
3. Restore round-trip: throwaway `scripts/verify-drive-backup.ts` fetches latest, asserts 27 keys present
4. Retention: pre-seed folder with 32 fake-dated files, invoke once, confirm 2 oldest trashed

## Phase 3 — Push 66+ Commits

**Owner**: Claude (coordination)
**Estimate**: 1 short session (~30min)

### Pre-push checklist

1. **Build gate**: `npm run build` exits 0 (no CI on push; Vercel auto-deploys)
2. **Dirty tree triage**:
   - **Commit A** — docs sync: `DEVELOPMENT-TRACKING.md`, `docs/COLLABORATION.md`, `docs/COMPLETED.md`, `docs/ROADMAP.md`, `supabase/.temp/cli-latest` → `docs: sync tracking after stabilization phase`
   - **Commit B** — handoffs: 4 files under `docs/handoffs/2026-07-1{5,6}-*.md` → `docs: add Task 3.4-3.8 handoff briefs`
   - **Leave untracked** (do NOT commit): `scripts/debug-*.ts`, `scripts/fix-pos*.ts`, `scripts/delete-*.ts`, `scripts/inspect-*.ts`, `scripts/test-*.ts`, `scripts/print-recipe-json.ts`, `scripts/search-*.ts`, `scripts/u5*.js`, `.agents/`, `skills-lock.json`
   - **Update `.gitignore`** in Commit A: add `scripts/debug-*`, `scripts/inspect-*`, `.agents/`, `skills-lock.json`
3. Phase 1 commit (Antigravity): audit script + report
4. Phase 2 commit (Codex): edge function + migration

### Push
```bash
git push origin main
```
Fast-forward (66 → 70 commits). No force. No `--no-verify`.

### Post-push verification
1. Vercel deploy "Ready"
2. Smoke: `/`, `/login`, one admin route — 200 responses
3. Supabase dashboard: `backup-to-sheets` AND `backup-to-drive` both deployed
4. First Drive backup fires at 02:30 UTC+7 next day — verify file appears

## Critical Files

**To create:**
- `scripts/audit-ui-consistency.ts`
- `docs/audits/ui-consistency-2026-07-16.md` (script output)
- `supabase/functions/backup-to-drive/index.ts`
- `supabase/functions/backup-to-drive/package.json` (copy from backup-to-sheets)
- `supabase/migrations/0009_drive_backup_cron.sql`

**To modify:**
- `.gitignore` — add `scripts/debug-*`, `scripts/inspect-*`, `.agents/`, `skills-lock.json`

## Reusable Existing Code

- `supabase/functions/backup-to-sheets/index.ts` — JWT/OAuth + paginated fetch pattern
- `lib/recovery-snapshot.ts` — bundle layout, sha256 manifest
- `scripts/capture-recovery-snapshot.ts` — 1000-row pagination example
- `supabase/migrations/0003_sync_state.sql` — pg_cron + `pg_net` template
- `tailwind.config.ts` + `app/globals.css` — token whitelist for audit script

## Risks & Mitigations

**Phase 1**:
- Regex false positives → AST-free heuristic, accept ~5% noise, document
- Report too large → cap per-page at 20 findings, roll rest into "N more"

**Phase 2**:
- SA lacks Drive permission → pre-share folder before first run
- Bundle > 50MB → switch to resumable upload
- `pg_net` extension missing → check `pg_extension` before scheduling
- Drive API rate limit on retention prune → 100ms sleep between deletes

**Phase 3**:
- Build fails on Vercel but not locally → `npm run build` gate
- Accidentally commit `.env.local` → already gitignored, re-verify `git status`
- Husky skipped tsc on docs-only commit with stray .tsx → `npm run build` is the real gate

## Sequencing summary

```
Phase 1 (Antigravity, parallel) ──┐
                                  ├──→ Phase 3 (Claude push)
Phase 2 (Codex, parallel)        ──┘
```

Phase 1 and Phase 2 can run in parallel (different scopes, no conflicts). Phase 3 starts after both complete + user final approval.

## Post-push follow-ups (out of scope for this plan)

- UI remediation based on Phase 1 report (multi-session, by category)
- Task 3.8 operator walk-through (5 ledger rows, decide approve/reject per row)
- UI-CONSISTENCY-1 StickyFilterBar removal (separate Antigravity task)
- Task 3.5 baseline audit cohort-aware (Codex, deprioritized)
- V1 first real operator backdate verify (wait for event)
