import { describe, expect, it } from "vitest";
import { planCapitalMove, withCapitalMove, type CashEntryRow } from "./move-capital-entries-to-acb-core";

const entry = (over: Partial<CashEntryRow> & Pick<CashEntryRow, "id">): CashEntryRow => ({
  entry_date: "2026-03-26", category_id: "CFC-005", amount: 1000, payment_method: "CASH", bank_account_id: null,
  status: "ACTIVE", ...over,
});

describe("planCapitalMove", () => {
  it("takes only ACTIVE cash rows of the group, sorted, and sums them", () => {
    const rows = [
      entry({ id: "CE-040", amount: 2_443_400 }),
      entry({ id: "CE-001", amount: 32_066_807 }),
      entry({ id: "CE-002", category_id: "CFC-001" }),
      entry({ id: "CE-003", status: "CANCELLED" }),
      entry({ id: "CE-004", payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" }),
    ];
    const plan = planCapitalMove(rows, "CFC-005");
    expect(plan.targets.map((t) => t.id)).toEqual(["CE-001", "CE-040"]);
    expect(plan.total).toBe(34_510_207);
  });
});

describe("withCapitalMove", () => {
  it("moves only the listed rows, setting method and account together, without mutating the input", () => {
    const rows = [entry({ id: "CE-1" }), entry({ id: "CE-2" })];
    const moved = withCapitalMove(rows, ["CE-1"], "BA-001");
    expect(moved[0]).toMatchObject({ payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" });
    expect(moved[1]).toMatchObject({ payment_method: "CASH", bank_account_id: null });
    expect(rows[0].payment_method).toBe("CASH");
  });
});
