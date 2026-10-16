import { describe, expect, it } from "vitest";
import { computeDepreciation, type DepAsset, type DepDisposal } from "./verify-depreciation-core";

const asset = (over: Partial<DepAsset>): DepAsset => ({
  id: "A", acquired_date: "2026-04-10", total_cost: 120000, quantity: 1, term_months: 12, status: "ACTIVE", ...over,
});
const disp = (over: Partial<DepDisposal>): DepDisposal => ({ asset_id: "A", quantity: 1, disposed_date: "2026-07-02", ...over });
const lifetime = (r: ReturnType<typeof computeDepreciation>, id: string) =>
  Object.values(r.months).reduce((s, m) => s + (m[id] ?? 0), 0);

describe("computeDepreciation", () => {
  it("TS-004 Binh bom: 2 units, 411.840d, 24 months from 04/2026, 1 disposed 02/07/2026", () => {
    const r = computeDepreciation(
      [asset({ id: "TS-004", total_cost: 411840, quantity: 2, term_months: 24 })],
      [disp({ asset_id: "TS-004" })],
    );
    for (const m of ["2026-04", "2026-05", "2026-06"]) expect(r.months[m]["TS-004"]).toBeCloseTo(17160, 6);
    expect(r.months["2026-07"]["TS-004"]).toBeCloseTo(188760, 6);
    expect(r.months["2026-08"]["TS-004"]).toBeCloseTo(8580, 6);
    expect(r.months["2028-03"]["TS-004"]).toBeCloseTo(8580, 6);
    expect(r.months["2028-04"]).toBeUndefined();
    expect(lifetime(r, "TS-004")).toBeCloseTo(411840, 6);
    expect(r.problems).toEqual([]);
  });

  it("price 0 gives no charge and no problem", () => {
    const r = computeDepreciation([asset({ total_cost: 0 })], []);
    expect(r.months).toEqual({});
    expect(r.problems).toEqual([]);
  });

  it("INACTIVE asset is left out", () => {
    const r = computeDepreciation([asset({ status: "INACTIVE" })], [disp({ quantity: 9 })]);
    expect(r.months).toEqual({});
    expect(r.problems).toEqual([]);
  });

  it("every unit disposed: remainder lands in the disposal month, nothing after", () => {
    const r = computeDepreciation([asset({ quantity: 2 })], [disp({ quantity: 2 })]);
    expect(r.months["2026-06"]["A"]).toBeCloseTo(10000, 6);
    expect(r.months["2026-07"]["A"]).toBeCloseTo(120000 - 3 * 10000, 6);
    expect(r.months["2026-08"]).toBeUndefined();
    expect(lifetime(r, "A")).toBeCloseTo(120000, 6);
  });

  it("disposal in the acquisition month charges the whole cost that month", () => {
    const r = computeDepreciation([asset({})], [disp({ disposed_date: "2026-04-30" })]);
    expect(r.months["2026-04"]["A"]).toBeCloseTo(120000, 6);
    expect(r.months["2026-05"]).toBeUndefined();
  });

  it.each(["2027-03-15", "2028-01-05"])("disposal on or after the term end (%s) charges the last term month", d => {
    const r = computeDepreciation([asset({})], [disp({ disposed_date: d })]);
    expect(r.months["2027-03"]["A"]).toBeCloseTo(10000, 6);
    expect(r.months["2027-04"]).toBeUndefined();
    expect(lifetime(r, "A")).toBeCloseTo(120000, 6);
    expect(r.problems).toEqual([]);
  });

  it("asset bought in the current month charges a full month", () => {
    const r = computeDepreciation([asset({ acquired_date: "2026-10-31" })], []);
    expect(r.months["2026-10"]["A"]).toBeCloseTo(10000, 6);
    expect(r.problems).toEqual([]);
  });

  it("bad rows are reported as problems and the other assets still count", () => {
    const r = computeDepreciation(
      [
        asset({ id: "T0", term_months: 0 }),
        asset({ id: "EARLY" }),
        asset({ id: "MANY", quantity: 2 }),
        asset({ id: "OK" }),
      ],
      [
        disp({ asset_id: "EARLY", disposed_date: "2026-03-31" }),
        disp({ asset_id: "MANY", quantity: 3 }),
      ],
    );
    expect(r.problems).toHaveLength(3);
    for (const id of ["T0", "EARLY", "MANY"]) expect(r.problems.filter(p => p.includes(id))).toHaveLength(1);
    expect(r.months["2026-04"]["OK"]).toBeCloseTo(10000, 6);
    expect(r.months["2026-04"]["T0"]).toBeUndefined();
    expect(r.months["2026-04"]["EARLY"]).toBeUndefined();
    expect(r.months["2026-04"]["MANY"]).toBeUndefined();
  });

  it("two disposals in different months: life total equals cost", () => {
    // 3 units, 120.000d, 12 months from 04/2026; each unit's share is 40.000d, 40.000/12 = 3.333,33 a month.
    // Unit A disposed in month 2 (06/2026): months 0-1 3.333,33 each, month 2 40.000*10/12 = 33.333,33.
    // Unit B disposed in month 5 (09/2026): months 0-4 3.333,33 each, month 5 40.000*7/12 = 23.333,33.
    // Unit C kept: 3.333,33 every month.
    // Month 0,1: 10.000. Month 2: 6.666,67 + 33.333,33 = 40.000. Month 3,4: 6.666,67.
    // Month 5: 3.333,33 + 23.333,33 = 26.666,67. Months 6-11: 3.333,33.
    const r = computeDepreciation(
      [asset({ quantity: 3 })],
      [disp({ disposed_date: "2026-06-15" }), disp({ disposed_date: "2026-09-01" })],
    );
    expect(r.months["2026-04"]["A"]).toBeCloseTo(10000, 6);
    expect(r.months["2026-05"]["A"]).toBeCloseTo(10000, 6);
    expect(r.months["2026-06"]["A"]).toBeCloseTo(40000, 6);
    expect(r.months["2026-07"]["A"]).toBeCloseTo(6666.6667, 3);
    expect(r.months["2026-09"]["A"]).toBeCloseTo(26666.6667, 3);
    expect(r.months["2026-10"]["A"]).toBeCloseTo(3333.3333, 3);
    expect(r.months["2027-03"]["A"]).toBeCloseTo(3333.3333, 3);
    expect(lifetime(r, "A")).toBeCloseTo(120000, 6);
    expect(r.problems).toEqual([]);
  });

  it("a disposal with quantity 0 or less is a problem and the asset is skipped", () => {
    const r = computeDepreciation([asset({}), asset({ id: "B" })], [disp({ quantity: 0 })]);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("A");
    expect(r.months["2026-04"]["A"]).toBeUndefined();
    expect(r.months["2026-04"]["B"]).toBeCloseTo(10000, 6);
  });

  it("a non-finite total_cost is a problem and the asset is skipped", () => {
    const r = computeDepreciation([asset({ total_cost: Number.NaN }), asset({ id: "B" })], []);
    expect(r.problems).toHaveLength(1);
    expect(r.months["2026-04"]["A"]).toBeUndefined();
    expect(r.months["2026-04"]["B"]).toBeCloseTo(10000, 6);
  });
});
