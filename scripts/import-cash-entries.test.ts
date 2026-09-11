import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRows, monthlyTotals, buildCategoryIdMap } from "./import-cash-entries";

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "scripts/fixtures/cash-entries-2026.json"), "utf8"),
);

const CATEGORY_IDS: Record<string, string> = {
  "Vận hành": "CFC-001",
  "Điện, nước, gas": "CFC-002",
  "Marketing": "CFC-003",
  "Thu khác": "CFC-004",
  "Vốn góp": "CFC-005",
};

const ADMIN = { id: "USR-001", name: "Sanh" };
const BANK_ACCOUNT_ID = "BA-001";

describe("cash entry import", () => {
  it("carries exactly the 54 rows the app does not already have", () => {
    expect(fixture.length).toBe(54);
  });

  it("splits across the five categories the way the sheet does", () => {
    const counts: Record<string, number> = {};
    for (const r of fixture) counts[r.category] = (counts[r.category] ?? 0) + 1;
    expect(counts).toEqual({
      "Vận hành": 33,
      "Điện, nước, gas": 12,
      "Marketing": 5,
      "Thu khác": 2,
      "Vốn góp": 2,
    });
  });

  it("maps every row onto a real category id and a positive whole amount", () => {
    const rows = buildRows(fixture, CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID);
    expect(rows.length).toBe(54);
    for (const r of rows) {
      expect(Object.values(CATEGORY_IDS)).toContain(r.category_id);
      expect(Number.isInteger(r.amount) && r.amount > 0).toBe(true);
      expect(r.created_by_name).toBe("Sanh");
      expect(r.updated_by_name).toBe("Sanh");
      expect(r.status).toBe("ACTIVE");
      expect(r.id).toMatch(/^CE-\d{3}$/);
    }
  });

  it("numbers the rows in date order, with no gaps", () => {
    const rows = buildRows(fixture, CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID);
    expect(rows[0].id).toBe("CE-001");
    expect(rows[53].id).toBe("CE-054");
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].entry_date >= rows[i - 1].entry_date).toBe(true);
    }
  });

  it("reproduces the July 2026 figures the owner will check on screen", () => {
    const july = monthlyTotals(buildRows(fixture, CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID))["2026-07"];
    expect(july["CFC-002"]).toBe(470000);   // Điện, nước, gas
    expect(july["CFC-001"]).toBe(1371000);  // Vận hành
    expect(july["CFC-003"]).toBe(330000);   // Marketing
    expect(july.EXPENSE_TOTAL).toBe(2171000);
    expect(july.INCOME_TOTAL).toBe(0);
  });

  it("never writes a bank account onto a cash row", () => {
    for (const r of buildRows(fixture, CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID)) {
      if (r.payment_method === "CASH") expect(r.bank_account_id).toBeNull();
    }
  });

  it("backdates created_at to the sheet's own date, not today", () => {
    // These rows were written down months ago. Letting created_at default to
    // now() would claim the owner typed five months of history in one sitting.
    for (const r of buildRows(fixture, CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID)) {
      expect(r.created_at.slice(0, 10)).toBe(r.entry_date);
    }
  });

  it("stops rather than guessing when a category name is not in the table", () => {
    expect(() => buildRows(
      [{ entry_date: "2026-07-01", category: "Không có nhóm này", amount: 1000,
         payment_method: "CASH", note: "" }],
      CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID,
    )).toThrow(/Không có nhóm này/);
  });

  it("resolves the one BANK_TRANSFER row -- 2026-09-02, 1.728.578đ -- onto the given account, and no other row", () => {
    const rows = buildRows(fixture, CATEGORY_IDS, ADMIN, BANK_ACCOUNT_ID);
    const withAccount = rows.filter((r) => r.bank_account_id === BANK_ACCOUNT_ID);
    expect(withAccount.length).toBe(1);
    expect(withAccount[0].entry_date).toBe("2026-09-02");
    expect(withAccount[0].amount).toBe(1728578);
    const withoutAccount = rows.filter((r) => r.bank_account_id === null);
    expect(withoutAccount.length).toBe(53);
  });

  it("refuses to guess a bank account for the BANK_TRANSFER row when none is given", () => {
    expect(() => buildRows(fixture, CATEGORY_IDS, ADMIN, null)).toThrow(/1\.728\.578/);
  });
});

// M11 (final-review.md): categoryIds[c.name] = c.id mapped INACTIVE
// categories too, last one wins. If the owner retires a seeded category and
// creates a new one with the same name before running this import, the rows
// silently land on whichever id sorted last -- filter to ACTIVE only.
describe("buildCategoryIdMap (M11)", () => {
  it("maps only ACTIVE categories by name", () => {
    const map = buildCategoryIdMap([
      { id: "CFC-001", name: "Vận hành", status: "ACTIVE" },
      { id: "CFC-002", name: "Marketing", status: "ACTIVE" },
    ]);
    expect(map).toEqual({ "Vận hành": "CFC-001", "Marketing": "CFC-002" });
  });

  it("excludes an INACTIVE category entirely, even when its name is unique", () => {
    const map = buildCategoryIdMap([
      { id: "CFC-009", name: "Nhóm cũ đã ngừng", status: "INACTIVE" },
    ]);
    expect(map).toEqual({});
  });

  it("prefers the ACTIVE row when a retired category shares a name with a new ACTIVE one", () => {
    const map = buildCategoryIdMap([
      { id: "CFC-001", name: "Marketing", status: "INACTIVE" },
      { id: "CFC-010", name: "Marketing", status: "ACTIVE" },
    ]);
    expect(map).toEqual({ "Marketing": "CFC-010" });
  });
});
