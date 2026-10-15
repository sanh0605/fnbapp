import { describe, it, expect } from "vitest";
import { planPriceHistory } from "./add-missing-price-history-core";

const v = (id: string, price: number, created_at = "2026-06-27T00:00:00.000Z") => ({ id, price, created_at, label: id });
const h = (id: string, variant_id: string, new_price: number, created_at = "2026-03-27T00:00:00.000Z", effective_at = created_at) => ({ id, variant_id, new_price, created_at, effective_at });

describe("planPriceHistory", () => {
  it("adds an opening row for a size with no history, at its own creation time, from the next free id", () => {
    const rows = planPriceHistory([v("VAR-038", 5000, "2026-06-26T18:48:45.183Z")], [h("PPH-055", "VAR-001", 18000)]);
    expect(rows).toEqual([
      { id: "PPH-056", variant_id: "VAR-038", old_price: null, new_price: 5000,
        effective_at: "2026-06-26T18:48:45.183Z", created_at: "2026-06-26T18:48:45.183Z", label: "VAR-038" },
    ]);
  });

  it("adds the missing change row one second after the latest history row's effective time (the opening price was an import mistake corrected right after it)", () => {
    const rows = planPriceHistory(
      [v("VAR-006", 23000)],
      [h("PPH-006", "VAR-006", 27000, "2026-06-28T16:27:49.000Z", "2026-06-28T16:27:49.000Z")],
    );
    expect(rows).toEqual([
      { id: "PPH-007", variant_id: "VAR-006", old_price: 27000, new_price: 23000,
        effective_at: "2026-06-28T16:27:50.000Z", created_at: "2026-06-28T16:27:50.000Z", label: "VAR-006" },
    ]);
  });

  it("takes the latest row by created_at then id as the history's current price", () => {
    const rows = planPriceHistory(
      [v("VAR-001", 20000)],
      [h("PPH-001", "VAR-001", 18000, "2026-03-27T00:00:00.000Z"), h("PPH-009", "VAR-001", 20000, "2026-05-01T00:00:00.000Z")],
    );
    expect(rows).toEqual([]);
  });

  it("never truncates a new id past 999", () => {
    const rows = planPriceHistory([v("VAR-038", 5000)], [h("PPH-999", "VAR-001", 1)]);
    expect(rows[0].id).toBe("PPH-1000");
  });
});
