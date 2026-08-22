import { describe, expect, it } from "vitest";
import {
  buildAssetSchedule,
  totalScheduledCharge,
  remainingValueAsOf,
  chargeForMonth,
  findBandForUnitPrice,
  validateBands,
  summarizeAsset,
  type Band,
} from "./asset-depreciation";

const SEEDED_BANDS: Band[] = [
  { min_unit_price: 0, max_unit_price: 199_999, term_months: 12 },
  { min_unit_price: 200_000, max_unit_price: 500_000, term_months: 24 },
  { min_unit_price: 500_001, max_unit_price: null, term_months: 36 },
];

// Batch 3 plan section 4, worked example 1: the ordinary case, real numbers.
describe("buildAssetSchedule -- worked example 1 (Bình nhựa có bơm 1000ml, no disposal)", () => {
  it("8 units at 95.150d/unit over 12 months sums exactly to 761.200d, final month absorbs the rounding remainder", () => {
    const schedule = buildAssetSchedule(
      { acquired_date: "2026-01-15", unit_cost: 95_150, quantity: 8, term_months: 12 },
      [],
    );

    expect(schedule).toHaveLength(12);
    expect(totalScheduledCharge(schedule)).toBe(761_200);
    // 8 * 95150 / 12 = 63433.33... -- eleven months round down to 63433,
    // the twelfth absorbs what those eleven left unaccounted for (63437,
    // not 63433 -- the plan's own prose names 63.433d for every month,
    // which is the ideal, unrounded-in-the-details figure; this is the
    // literal per-month schedule the "final month absorbs the remainder"
    // rule actually produces).
    for (let i = 0; i < 11; i++) {
      expect(schedule[i].charge).toBe(63_433);
      expect(schedule[i].unitsHeld).toBe(8);
    }
    expect(schedule[11].charge).toBe(63_437);
    expect(schedule[11].unitsHeld).toBe(8);
    expect(schedule[0].month).toBe("2026-01");
    expect(schedule[11].month).toBe("2026-12");
  });
});

// Worked example 2: disposal, matching the parent plan section 8.2 exactly.
describe("buildAssetSchedule -- worked example 2 (ca đong, disposed mid-term)", () => {
  it("45.000d over 12 months, broken in month 3: months 1-3 charge 3.750d each, month 3 also charges the remaining 33.750d, total 45.000d", () => {
    const schedule = buildAssetSchedule(
      { acquired_date: "2026-03-01", unit_cost: 45_000, quantity: 1, term_months: 12 },
      [{ quantity: 1, disposed_date: "2026-05-15" }], // month index 2 -- the third month
    );

    expect(schedule[0].charge).toBe(3_750); // month 1
    expect(schedule[1].charge).toBe(3_750); // month 2
    expect(schedule[2].charge).toBe(37_500); // month 3: 3.750 regular + 33.750 remaining
    for (let i = 3; i < 12; i++) {
      expect(schedule[i].charge).toBe(0);
      expect(schedule[i].unitsHeld).toBe(0);
    }
    expect(totalScheduledCharge(schedule)).toBe(45_000);
    // Section 4 point 1: a disposal dated IN month m does not reduce month
    // m's own units-held count -- only months after it.
    expect(schedule[2].unitsHeld).toBe(1);
  });
});

// Worked example 3: the one long-term asset.
describe("buildAssetSchedule -- worked example 3 (Xe cà phê lưu động, 36 months)", () => {
  it("2.100.000d over 36 months sums exactly, final month absorbs the remainder", () => {
    const schedule = buildAssetSchedule(
      { acquired_date: "2026-01-01", unit_cost: 2_100_000, quantity: 1, term_months: 36 },
      [],
    );

    expect(schedule).toHaveLength(36);
    expect(totalScheduledCharge(schedule)).toBe(2_100_000);
    for (let i = 0; i < 35; i++) {
      expect(schedule[i].charge).toBe(58_333);
    }
    expect(schedule[35].charge).toBe(58_345);
  });
});

// Section 6: "A schedule-sums-to-cost test across every band."
describe("buildAssetSchedule -- sums to cost exactly, across every band and several non-round costs", () => {
  const cases: Array<{ unit_cost: number; quantity: number; term_months: number }> = [
    { unit_cost: 95_150, quantity: 8, term_months: 12 }, // 12-month band
    { unit_cost: 497_697, quantity: 1, term_months: 24 }, // 24-month band (Kenbar)
    { unit_cost: 2_100_000, quantity: 1, term_months: 36 }, // 36-month band
    { unit_cost: 1, quantity: 7, term_months: 12 }, // pathological: does not divide evenly at all
    { unit_cost: 123_457, quantity: 3, term_months: 24 },
    { unit_cost: 999_999, quantity: 5, term_months: 36 },
  ];

  for (const c of cases) {
    it(`quantity=${c.quantity}, unit_cost=${c.unit_cost}, term=${c.term_months}`, () => {
      const schedule = buildAssetSchedule(
        { acquired_date: "2026-01-01", unit_cost: c.unit_cost, quantity: c.quantity, term_months: c.term_months },
        [],
      );
      expect(totalScheduledCharge(schedule)).toBe(c.unit_cost * c.quantity);
    });
  }
});

describe("buildAssetSchedule -- partial disposal, multiple events on one asset", () => {
  it("two separate partial disposals each settle their own cohort exactly, and the whole schedule still sums to cost", () => {
    // 10 units at 1.200d, term 12. 4 disposed in month 3 (index 2), 3 more
    // disposed in month 7 (index 6), 3 survive to term end (month 12).
    const schedule = buildAssetSchedule(
      { acquired_date: "2026-01-01", unit_cost: 1_200, quantity: 10, term_months: 12 },
      [
        { quantity: 4, disposed_date: "2026-03-01" },
        { quantity: 3, disposed_date: "2026-07-01" },
      ],
    );

    expect(totalScheduledCharge(schedule)).toBe(12_000);
    // Month index 2 (March): still 10 held (disposal dated in this month
    // does not reduce this month's own count), disposal settles here.
    expect(schedule[2].unitsHeld).toBe(10);
    // Month index 3 (April): the first 4 are gone.
    expect(schedule[3].unitsHeld).toBe(6);
    // Month index 6 (July): still 6 held going into this month's disposal.
    expect(schedule[6].unitsHeld).toBe(6);
    // Month index 7 (August): the next 3 are also gone, 3 remain.
    expect(schedule[7].unitsHeld).toBe(3);
    expect(schedule[11].unitsHeld).toBe(3); // survive to term end
  });

  it("refuses disposals that sum to more than the asset's quantity", () => {
    expect(() =>
      buildAssetSchedule(
        { acquired_date: "2026-01-01", unit_cost: 1_000, quantity: 2, term_months: 12 },
        [{ quantity: 3, disposed_date: "2026-02-01" }],
      ),
    ).toThrow(/exceed/);
  });

  it("refuses a disposal dated before the asset was acquired", () => {
    expect(() =>
      buildAssetSchedule(
        { acquired_date: "2026-06-01", unit_cost: 1_000, quantity: 1, term_months: 12 },
        [{ quantity: 1, disposed_date: "2026-01-01" }],
      ),
    ).toThrow(/before/);
  });
});

describe("remainingValueAsOf / chargeForMonth", () => {
  it("remaining value after the disposal month in worked example 2 is zero", () => {
    const schedule = buildAssetSchedule(
      { acquired_date: "2026-03-01", unit_cost: 45_000, quantity: 1, term_months: 12 },
      [{ quantity: 1, disposed_date: "2026-05-15" }],
    );
    expect(remainingValueAsOf(schedule, "2026-05")).toBe(0);
    expect(remainingValueAsOf(schedule, "2026-04")).toBe(45_000 - 3_750 - 3_750);
    expect(chargeForMonth(schedule, "2026-05")).toBe(37_500);
  });
});

// Section 5.1's three filter buckets, and section 1's "an item whose term
// has ended stays listed at 0d." asOfMonth is passed explicitly rather than
// read from the clock, so these are deterministic regardless of when the
// test suite runs.
describe("summarizeAsset -- bucket derivation (section 5.1)", () => {
  const asset = {
    id: "TS-001",
    name: "Máy pha cà phê",
    acquired_date: "2026-01-01",
    unit_cost: 95_150,
    quantity: 8,
    term_months: 12, // schedule runs 2026-01 through 2026-12
  };

  it("còn dùng (IN_USE): within term, nothing disposed", () => {
    const summary = summarizeAsset(asset, [], "2026-06");
    expect(summary.bucket).toBe("IN_USE");
    expect(summary.remainingQuantity).toBe(8);
    expect(summary.remainingValue).toBeGreaterThan(0);
    expect(summary.remainingValue).toBeLessThan(summary.totalCost);
  });

  it("đã hết khấu hao (FULLY_DEPRECIATED): past the term's last month, still owned, 0d remaining", () => {
    const summary = summarizeAsset(asset, [], "2027-03"); // term ended 2026-12
    expect(summary.bucket).toBe("FULLY_DEPRECIATED");
    expect(summary.remainingQuantity).toBe(8);
    expect(summary.remainingValue).toBe(0);
  });

  it("đã thanh lý (DISPOSED): fully disposed, regardless of how much term remains", () => {
    const summary = summarizeAsset(asset, [{ quantity: 8, disposed_date: "2026-03-01" }], "2026-06");
    expect(summary.bucket).toBe("DISPOSED");
    expect(summary.remainingQuantity).toBe(0);
  });

  it("a partial disposal alone does not move the bucket to DISPOSED", () => {
    const summary = summarizeAsset(asset, [{ quantity: 3, disposed_date: "2026-03-01" }], "2026-06");
    expect(summary.bucket).toBe("IN_USE");
    expect(summary.remainingQuantity).toBe(5);
  });
});

// Section 3.1's band table.
describe("findBandForUnitPrice", () => {
  it("matches the owner's own boundary examples", () => {
    expect(findBandForUnitPrice(SEEDED_BANDS, 95_150)?.term_months).toBe(12);
    expect(findBandForUnitPrice(SEEDED_BANDS, 199_999)?.term_months).toBe(12);
    expect(findBandForUnitPrice(SEEDED_BANDS, 200_000)?.term_months).toBe(24);
    expect(findBandForUnitPrice(SEEDED_BANDS, 497_697)?.term_months).toBe(24); // Bộ công thức pha chế Kenbar
    expect(findBandForUnitPrice(SEEDED_BANDS, 500_000)?.term_months).toBe(24);
    expect(findBandForUnitPrice(SEEDED_BANDS, 500_001)?.term_months).toBe(36);
    expect(findBandForUnitPrice(SEEDED_BANDS, 2_100_000)?.term_months).toBe(36);
  });

  it("returns null when no band covers the price (a gap in a misconfigured table)", () => {
    const gappy: Band[] = [
      { min_unit_price: 0, max_unit_price: 100, term_months: 12 },
      { min_unit_price: 200, max_unit_price: null, term_months: 24 },
    ];
    expect(findBandForUnitPrice(gappy, 150)).toBeNull();
  });
});

describe("validateBands", () => {
  it("accepts the seeded three bands", () => {
    expect(validateBands(SEEDED_BANDS)).toEqual({ ok: true });
  });

  it("refuses a gap between bands, naming the colliding pair", () => {
    const gap: Band[] = [
      { min_unit_price: 0, max_unit_price: 199_999, term_months: 12 },
      { min_unit_price: 200_001, max_unit_price: null, term_months: 36 }, // 200.000 falls in neither
    ];
    const result = validateBands(gap);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.error).toContain("199.999");
    expect(result.error).toContain("200.001");
  });

  it("refuses an overlap between bands", () => {
    const overlap: Band[] = [
      { min_unit_price: 0, max_unit_price: 250_000, term_months: 12 },
      { min_unit_price: 200_000, max_unit_price: null, term_months: 36 }, // 200.000-250.000 double-covered
    ];
    const result = validateBands(overlap);
    expect(result.ok).toBe(false);
  });

  it("refuses an unbounded band that is not the last one", () => {
    const badOrder: Band[] = [
      { min_unit_price: 0, max_unit_price: null, term_months: 12 },
      { min_unit_price: 200_000, max_unit_price: null, term_months: 36 },
    ];
    const result = validateBands(badOrder);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected refusal");
    expect(result.error).toContain("không giới hạn trên");
  });

  it("refuses an empty band table", () => {
    expect(validateBands([])).toEqual({ ok: false, error: "Phải có ít nhất một khung khấu hao" });
  });
});
