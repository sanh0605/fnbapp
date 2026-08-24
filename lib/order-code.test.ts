import { describe, expect, it } from "vitest";
import {
  formatOrderDate,
  isNewFormatOrderNo,
  buildOrderCode,
  planOrderCodeRename,
  type RawOrderRow,
  type OutletForBrand,
} from "./order-code";

const OUTLETS: OutletForBrand[] = [
  { outlet_id: "OUT-001", outlet_code: "001", brand_id: "BR-001" },
  { outlet_id: "OUT-002", outlet_code: "002", brand_id: "BR-002" },
];

function row(id: string, order_no: string, brand_id: string, created_at: string): RawOrderRow {
  return { id, order_no, brand_id, created_at };
}

describe("formatOrderDate", () => {
  it("formats YYMMDD in Asia/Ho_Chi_Minh, not UTC", () => {
    // 2026-08-24 17:30 UTC is already 2026-08-25 00:30 in Saigon (+7) --
    // the exact class of bug OPEN-ITEMS 55 warns about if this used a
    // naive UTC-based format instead.
    expect(formatOrderDate("2026-08-24T17:30:00.000Z")).toBe("260825");
    expect(formatOrderDate("2026-08-24T16:30:00.000Z")).toBe("260824"); // 23:30 Saigon, still the 24th
  });
});

describe("isNewFormatOrderNo", () => {
  it("recognizes the 12-digit new format and rejects every legacy shape", () => {
    expect(isNewFormatOrderNo("260824001001")).toBe(true);
    expect(isNewFormatOrderNo("PHD000632")).toBe(false);
    expect(isNewFormatOrderNo("#123")).toBe(false);
    expect(isNewFormatOrderNo("26082400100")).toBe(false); // 11 digits
    expect(isNewFormatOrderNo("2608240010012")).toBe(false); // 13 digits
  });
});

describe("buildOrderCode", () => {
  it("matches the plan's own worked example exactly", () => {
    expect(buildOrderCode("260824", "001", 1)).toBe("260824001001");
    expect(buildOrderCode("260824", "001", 2)).toBe("260824001002");
    expect(buildOrderCode("260824", "002", 1)).toBe("260824002001");
    expect(buildOrderCode("260825", "001", 1)).toBe("260825001001");
  });
});

describe("planOrderCodeRename", () => {
  it("assigns sequence per (outlet, date), resetting for a new day and running independently per outlet", () => {
    const orders: RawOrderRow[] = [
      row("id-1", "PHD000001", "BR-001", "2026-08-24T02:00:00.000Z"), // 09:00 Saigon
      row("id-2", "PHD000002", "BR-001", "2026-08-24T03:00:00.000Z"), // 10:00 Saigon, same day/outlet
      row("id-3", "UCK000001", "BR-002", "2026-08-24T04:00:00.000Z"), // same day, different outlet
      row("id-4", "PHD000003", "BR-001", "2026-08-25T02:00:00.000Z"), // next day, counter resets
    ];
    const plans = planOrderCodeRename(orders, OUTLETS);
    const byOld = new Map(plans.map(p => [p.old_order_no, p]));

    expect(byOld.get("PHD000001")?.new_order_no).toBe("260824001001");
    expect(byOld.get("PHD000002")?.new_order_no).toBe("260824001002");
    expect(byOld.get("UCK000001")?.new_order_no).toBe("260824002001");
    expect(byOld.get("PHD000003")?.new_order_no).toBe("260825001001");
  });

  it("every row of a multi-version chain receives the same new order_no (per code, not per row)", () => {
    // PHD000632's real shape: v1 SUPERSEDED, v2 COMPLETED, v2 VOIDED, all
    // sharing one order_no and an identical created_at (verified against
    // production 2026-08-25).
    const orders: RawOrderRow[] = [
      row("v1", "PHD000632", "BR-001", "2026-06-25T01:16:00.189Z"),
      row("v2-completed", "PHD000632", "BR-001", "2026-06-25T01:16:00.189Z"),
      row("v2-voided", "PHD000632", "BR-001", "2026-06-25T01:16:00.189Z"),
    ];
    const plans = planOrderCodeRename(orders, OUTLETS);

    expect(plans).toHaveLength(1);
    expect(plans[0].row_ids.sort()).toEqual(["v1", "v2-completed", "v2-voided"]);
    expect(plans[0].new_order_no).toMatch(/^\d{12}$/);
  });

  it("is idempotent: replaying with the new codes already in place produces changed:false for every group", () => {
    const orders: RawOrderRow[] = [
      row("id-1", "PHD000001", "BR-001", "2026-08-24T02:00:00.000Z"),
      row("id-2", "PHD000002", "BR-001", "2026-08-24T03:00:00.000Z"),
      row("id-3", "UCK000001", "BR-002", "2026-08-24T04:00:00.000Z"),
    ];
    const firstPass = planOrderCodeRename(orders, OUTLETS);
    expect(firstPass.every(p => p.changed)).toBe(true);

    // Simulate the renamed state: order_no is now whatever the first pass
    // computed.
    const renamed = orders.map(o => {
      const plan = firstPass.find(p => p.row_ids.includes(o.id))!;
      return { ...o, order_no: plan.new_order_no };
    });
    const secondPass = planOrderCodeRename(renamed, OUTLETS);

    expect(secondPass.every(p => !p.changed)).toBe(true);
    // And the codes themselves are identical to what the first pass chose.
    const firstCodes = new Set(firstPass.map(p => p.new_order_no));
    const secondCodes = new Set(secondPass.map(p => p.new_order_no));
    expect(secondCodes).toEqual(firstCodes);
  });

  it("breaks a true tie (identical created_at, same outlet and date) deterministically by old_order_no", () => {
    const orders: RawOrderRow[] = [
      row("id-b", "PHD000099", "BR-001", "2026-08-24T02:00:00.000Z"),
      row("id-a", "PHD000001", "BR-001", "2026-08-24T02:00:00.000Z"), // same instant, lexicographically smaller code
    ];
    const plans = planOrderCodeRename(orders, OUTLETS);
    const byOld = new Map(plans.map(p => [p.old_order_no, p]));

    expect(byOld.get("PHD000001")?.new_order_no).toBe("260824001001");
    expect(byOld.get("PHD000099")?.new_order_no).toBe("260824001002");
  });

  it("throws when an order's brand has no configured outlet", () => {
    const orders: RawOrderRow[] = [row("id-1", "XXX000001", "BR-999", "2026-08-24T02:00:00.000Z")];
    expect(() => planOrderCodeRename(orders, OUTLETS)).toThrow(/BR-999/);
  });

  it("throws when a brand maps to more than one outlet -- the thin-slice model assumes exactly one", () => {
    const dupOutlets: OutletForBrand[] = [
      ...OUTLETS,
      { outlet_id: "OUT-003", outlet_code: "003", brand_id: "BR-001" },
    ];
    const orders: RawOrderRow[] = [row("id-1", "PHD000001", "BR-001", "2026-08-24T02:00:00.000Z")];
    expect(() => planOrderCodeRename(orders, dupOutlets)).toThrow(/BR-001/);
  });
});
