import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildRows, monthlyTotals } from "./import-cash-entries";

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
    const rows = buildRows(fixture, CATEGORY_IDS, ADMIN);
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
    const rows = buildRows(fixture, CATEGORY_IDS, ADMIN);
    expect(rows[0].id).toBe("CE-001");
    expect(rows[53].id).toBe("CE-054");
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].entry_date >= rows[i - 1].entry_date).toBe(true);
    }
  });

  it("reproduces the July 2026 figures the owner will check on screen", () => {
    const july = monthlyTotals(buildRows(fixture, CATEGORY_IDS, ADMIN))["2026-07"];
    expect(july["CFC-002"]).toBe(470000);   // Điện, nước, gas
    expect(july["CFC-001"]).toBe(1371000);  // Vận hành
    expect(july["CFC-003"]).toBe(330000);   // Marketing
    expect(july.EXPENSE_TOTAL).toBe(2171000);
    expect(july.INCOME_TOTAL).toBe(0);
  });

  it("never writes a bank account onto a cash row", () => {
    for (const r of buildRows(fixture, CATEGORY_IDS, ADMIN)) {
      if (r.payment_method === "CASH") expect(r.bank_account_id).toBeNull();
    }
  });

  it("backdates created_at to the sheet's own date, not today", () => {
    // These rows were written down months ago. Letting created_at default to
    // now() would claim the owner typed five months of history in one sitting.
    for (const r of buildRows(fixture, CATEGORY_IDS, ADMIN)) {
      expect(r.created_at.slice(0, 10)).toBe(r.entry_date);
    }
  });

  it("stops rather than guessing when a category name is not in the table", () => {
    expect(() => buildRows(
      [{ entry_date: "2026-07-01", category: "Không có nhóm này", amount: 1000,
         payment_method: "CASH", note: "" }],
      CATEGORY_IDS, ADMIN,
    )).toThrow(/Không có nhóm này/);
  });
});
