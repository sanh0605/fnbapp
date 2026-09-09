import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "app/admin/finance/actions.ts"), "utf8");

describe("cash entry actions", () => {
  it("runs every write through the shared rule instead of parsing on its own", () => {
    expect(source).toContain("parseCashEntry(");
    // A second copy of the amount rule would drift from the tested one.
    expect(source).not.toMatch(/amount\s*<=\s*0/);
  });

  it("lets anyone in the admin area cancel, but only ADMIN delete", () => {
    expect(source).toMatch(/cancelCashEntry[\s\S]{0,200}requireAdmin\(\)/);
    expect(source).toMatch(/cancelCashEntry[\s\S]{0,600}CANCELLED/);
    expect(source).toMatch(/deleteCashEntry[\s\S]{0,200}requireOwner\(\)/);
  });

  it("stamps who created and who edited, and never the timestamps", () => {
    expect(source).toContain("creationAudit(auth.actor)");
    expect(source).toContain("updateAudit(auth.actor)");
    expect(source).not.toContain("created_at:");
    expect(source).not.toContain("updated_at:");
  });

  it("refuses to edit a row that was already cancelled", () => {
    expect(source).toContain('fail("Dòng đã huỷ, không sửa được")');
  });

  it("reads one date range rather than the whole table", () => {
    expect(source).toMatch(/getCashEntries\(\s*start: string,\s*end: string/);
    expect(source).toContain("entry_date");
  });
});
