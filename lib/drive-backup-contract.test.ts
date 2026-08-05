import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BACKUP_TABLES } from "@/supabase/functions/backup-to-drive/core";

const indexSource = readFileSync("supabase/functions/backup-to-drive/index.ts", "utf8");
const coreSource = readFileSync("supabase/functions/backup-to-drive/core.ts", "utf8");
const handlerSource = readFileSync("supabase/functions/backup-to-drive/handler.ts", "utf8");
const appsScriptSource = readFileSync("scripts/apps-script/backup-to-drive.gs", "utf8");
const guide = readFileSync("docs/operations/apps-script-drive-backup.md", "utf8");
const policy = readFileSync("docs/audits/2026-07-16-drive-backup-policy.md", "utf8");

describe("Drive backup deployment contract", () => {
  it("captures stock_issues, the sole cost input once Plan C lands", () => {
    // OPEN-ITEMS.md item 34 / Plan C Task 1c: BACKUP_TABLES predated
    // migration 0052 and never gained stock_issues. An issue cannot be
    // re-derived like a ledger row -- the goods are gone and the count that
    // measured them cannot be retaken -- so this asserts the list length,
    // not just membership, to catch a future silent drop.
    expect(BACKUP_TABLES.length).toBe(41);
    expect(BACKUP_TABLES).toContain("stock_issues");
    // Must follow both purchased_items and stocktake_sessions so
    // lib/backup-restore.ts's parent-first restore order resolves the FKs.
    expect(BACKUP_TABLES.indexOf("stock_issues")).toBeGreaterThan(BACKUP_TABLES.indexOf("purchased_items"));
    expect(BACKUP_TABLES.indexOf("stock_issues")).toBeGreaterThan(BACKUP_TABLES.indexOf("stocktake_sessions"));

    expect(appsScriptSource).toContain('"stock_issues"');
  });

  it("uses token auth and paginated full dumps without Google credentials", () => {
    expect(coreSource).toContain("PAGE_SIZE = 1000");
    expect(indexSource).toContain("BACKUP_PULL_TOKEN");
    expect(handlerSource).toContain("X-Backup-Token");
    expect(coreSource).not.toContain("googleapis.com");
    expect(indexSource).not.toContain("GOOGLE_CREDENTIALS_BASE64");
  });

  it("uses the new-format Supabase secret key before legacy fallback", () => {
    expect(indexSource).toContain('Deno.env.get("SUPABASE_SECRET_KEY")');
    expect(indexSource.indexOf('Deno.env.get("SUPABASE_SECRET_KEY")'))
      .toBeLessThan(indexSource.indexOf('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'));
    expect(indexSource).not.toMatch(/Response\.json\([^)]*readEnvironment/);
  });

  it("puts Drive ownership, validation, alerts, idempotency, and retention in Apps Script", () => {
    expect(appsScriptSource).toContain("X-Backup-Token");
    expect(appsScriptSource).toContain("BACKUP_PULL_TOKEN");
    expect(appsScriptSource).toContain("EXPECTED_TABLES");
    expect(appsScriptSource).toContain("Session.getActiveUser().getEmail()");
    expect(appsScriptSource).toContain("MailApp.sendEmail");
    expect(appsScriptSource).toContain("setTrashed(true)");
    expect(appsScriptSource).toContain("DAILY_RETENTION_COUNT = 180");
    expect(appsScriptSource).not.toContain("MONTHLY_RETENTION_COUNT");
    expect(appsScriptSource).toContain("fnbapp-monthly-");
    expect(appsScriptSource).toContain('getOrCreateFolder_(rootFolder, "daily")');
    expect(appsScriptSource).toContain('getOrCreateFolder_(rootFolder, "monthly")');
    expect(appsScriptSource).toContain("migrateLegacyRootFiles_");
    expect(appsScriptSource).toContain("file.moveTo(");
    expect(appsScriptSource).toContain(".trim()");
    expect(appsScriptSource).toContain("nearMinute(30)");
    expect(appsScriptSource).toContain('inTimezone("Asia/Ho_Chi_Minh")');
  });

  it("documents owner setup and the 35-40 MB object-storage migration trigger", () => {
    expect(guide).toContain("Script Properties");
    expect(guide).toContain("GOOGLE_DRIVE_FOLDER_ID");
    expect(guide).toContain("BACKUP_PULL_TOKEN");
    expect(policy).toMatch(/20 MB/);
    expect(policy).toMatch(/25 MB/);
    expect(policy).toMatch(/180/);
    expect(policy).toMatch(/monthly.*indefinitely/i);
    expect(policy).toMatch(/R2|B2/);
  });
});
