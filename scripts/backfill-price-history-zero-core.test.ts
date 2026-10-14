import { describe, it, expect } from "vitest";
import { selectFixes, type LineRow } from "./backfill-price-history-zero-core";

const variants = [
  { id: "V-SOLD", price: 20000, label: "Cà phê sữa đá 500ml" },
  { id: "V-NEW", price: 17000, label: "Cà phê sữa đá 360ml" },
  { id: "V-OK", price: 27000, label: "Matcha kem muối 500ml" },
];
const line = (p: Partial<LineRow> & { id: string }): LineRow => ({
  variant_id: "V-SOLD", unit_price: 20000, line_no: 1, order_id: "o1", order_created_at: "2026-06-01T00:00:00Z", ...p,
});

describe("selectFixes", () => {
  it("a zero row takes the size's first sale price: earliest order, then lowest line number", () => {
    const history = [{ id: "PPH-002", variant_id: "V-SOLD", new_price: 0 }];
    const lines = [
      line({ id: "late", unit_price: 99, order_created_at: "2026-07-01T00:00:00Z" }),
      line({ id: "second", unit_price: 21000, line_no: 2 }),
      line({ id: "first", unit_price: 18000, line_no: 1 }),
    ];
    expect(selectFixes(history, variants, lines)).toEqual([
      { id: "PPH-002", label: "Cà phê sữa đá 500ml", now: 0, next: 18000, source: "first" },
    ]);
  });

  it("a never-sold size takes today's price", () => {
    const [fix] = selectFixes([{ id: "PPH-012", variant_id: "V-NEW", new_price: 0 }], variants, []);
    expect(fix).toMatchObject({ id: "PPH-012", next: 17000, source: "giá hiện tại" });
  });

  it("leaves a row that already has a price alone", () => {
    expect(selectFixes([{ id: "PPH-038", variant_id: "V-OK", new_price: 27000 }], variants, [])).toEqual([]);
  });
});
