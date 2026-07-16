# Apps Script Daily Drive Backup Setup

This runbook configures the owner-account pull model. Do not deploy the Edge
Function or create the trigger until Claude approves the Phase 2 commit.

## Prerequisites

- Target Drive folder ID: `11yPMeq5RdjVSAVE0z0W-bg3PUs3N8hEQ`.
- The `backup-to-drive` Edge Function is deployed with JWT verification disabled;
  the endpoint performs its own `X-Backup-Token` check.
- The same random token (at least 32 characters) is stored as the Supabase secret
  `BACKUP_PULL_TOKEN` and the Apps Script Property `BACKUP_PULL_TOKEN`.

## 1. Create the Apps Script project

1. Sign in as the Google Drive owner and open <https://script.google.com/>.
2. Create a standalone project named `fnbapp Daily Drive Backup`.
3. Set project timezone to `Asia/Ho_Chi_Minh`.
4. Replace `Code.gs` with `scripts/apps-script/backup-to-drive.gs` from this repo.

## 2. Configure Script Properties

Open **Project Settings → Script Properties** and add:

| Property | Value |
|---|---|
| `BACKUP_ENDPOINT_URL` | `https://zicuawpwyhmtqmzawvau.supabase.co/functions/v1/backup-to-drive` |
| `BACKUP_PULL_TOKEN` | Exact approved random token; never paste into source code |
| `GOOGLE_DRIVE_FOLDER_ID` | `11yPMeq5RdjVSAVE0z0W-bg3PUs3N8hEQ` |

## 3. Authorize and test manually

1. Select `runDailyDriveBackup` and click **Run**.
2. Approve URL Fetch, Drive, and email permissions for the owner account.
3. Confirm the execution succeeds.
4. Confirm the folder contains `fnbapp-backup-YYYY-MM-DD.json`.
5. Open the file and confirm `schemaVersion` is `2` and `tables` has exactly 32 keys.
6. Confirm both the daily file and `fnbapp-monthly-YYYY-MM.json` exist.
7. Run it again. Confirm only one non-trashed daily and monthly file exists for
   the current periods.

Failure alerts are sent with `MailApp` to
`Session.getActiveUser().getEmail()`, which is the account that owns the
installable trigger.

## 4. Install the daily trigger

Select `installDailyTrigger` and click **Run** once. It replaces any prior
trigger for `runDailyDriveBackup`, then schedules it daily around 02:30 in
`Asia/Ho_Chi_Minh`. Apps Script time triggers may run approximately ±15 minutes
from the requested minute.

## 5. Verify the first scheduled run

The next day, check **Executions** in Apps Script and confirm the dated file is
present. The script keeps 180 daily files and 24 monthly files, trashing older
matching files. Unrelated files are never touched.

## Restore check

Download a backup JSON and verify:

- `schemaVersion === 2`;
- all 32 table keys are present;
- every table `count` equals `rows.length`;
- the file size is plausible compared with the latest local dry-run.

This phase does not automate production restore. Restoration remains a reviewed,
explicit data operation.
