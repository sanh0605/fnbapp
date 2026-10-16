import { describe, expect, it } from "vitest";
import { computeDepreciation, type DepAsset, type DepDisposal } from "./verify-depreciation-core";

const TODAY = "2026-10";
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
      TODAY,
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
    const r = computeDepreciation([asset({ total_cost: 0 })], [], TODAY);
    expect(r.months).toEqual({});
    expect(r.problems).toEqual([]);
  });

  it("INACTIVE asset is left out", () => {
    const r = computeDepreciation([asset({ status: "INACTIVE" })], [disp({ quantity: 9 })], TODAY);
    expect(r.months).toEqual({});
    expect(r.problems).toEqual([]);
  });

  it("every unit disposed: remainder lands in the disposal month, nothing after", () => {
    const r = computeDepreciation([asset({ quantity: 2 })], [disp({ quantity: 2 })], TODAY);
    expect(r.months["2026-06"]["A"]).toBeCloseTo(10000, 6);
    expect(r.months["2026-07"]["A"]).toBeCloseTo(120000 - 3 * 10000, 6);
    expect(r.months["2026-08"]).toBeUndefined();
    expect(lifetime(r, "A")).toBeCloseTo(120000, 6);
  });

  it("disposal in the acquisition month charges the whole cost that month", () => {
    const r = computeDepreciation([asset({})], [disp({ disposed_date: "2026-04-30" })], TODAY);
    expect(r.months["2026-04"]["A"]).toBeCloseTo(120000, 6);
    expect(r.months["2026-05"]).toBeUndefined();
  });

  it.each(["2027-03-15", "2028-01-05"])("disposal on or after the term end (%s) charges the last term month", d => {
    const r = computeDepreciation([asset({})], [disp({ disposed_date: d })], "2029-01");
    expect(r.months["2027-03"]["A"]).toBeCloseTo(10000, 6);
    expect(r.months["2027-04"]).toBeUndefined();
    expect(lifetime(r, "A")).toBeCloseTo(120000, 6);
    expect(r.problems).toEqual([]);
  });

  it("asset bought in the current month charges a full month", () => {
    const r = computeDepreciation([asset({ acquired_date: "2026-10-31" })], [], TODAY);
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
      TODAY,
    );
    expect(r.problems).toHaveLength(3);
    for (const id of ["T0", "EARLY", "MANY"]) expect(r.problems.filter(p => p.includes(id))).toHaveLength(1);
    expect(r.months["2026-04"]["OK"]).toBeCloseTo(10000, 6);
    expect(r.months["2026-04"]["T0"]).toBeUndefined();
    expect(r.months["2026-04"]["EARLY"]).toBeUndefined();
    expect(r.months["2026-04"]["MANY"]).toBeUndefined();
  });
});
