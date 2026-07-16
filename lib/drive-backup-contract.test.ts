import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync("supabase/functions/backup-to-drive/index.ts", "utf8");
const coreSource = readFileSync("supabase/functions/backup-to-drive/core.ts", "utf8");
const handlerSource = readFileSync("supabase/functions/backup-to-drive/handler.ts", "utf8");
const appsScriptSource = readFileSync("scripts/apps-script/backup-to-drive.gs", "utf8");
const guide = readFileSync("docs/operations/apps-script-drive-backup.md", "utf8");
const policy = readFileSync("docs/audits/2026-07-16-drive-backup-policy.md", "utf8");

describe("Drive backup deployment contract", () => {
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
    expect(appsScriptSource).toContain("MONTHLY_RETENTION_COUNT = 24");
    expect(appsScriptSource).toContain("fnbapp-monthly-");
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
    expect(policy).toMatch(/24/);
    expect(policy).toMatch(/R2|B2/);
  });
});
