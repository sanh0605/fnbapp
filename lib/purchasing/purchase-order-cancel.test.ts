import { describe, expect, it } from "vitest";
import {
  CANCEL_REASON_MAX,
  describeCancelBlocker,
  parseCancelCheck,
  parseCancelOutcome,
  validateCancelReason,
} from "./purchase-order-cancel";

describe("describeCancelBlocker", () => {
  it("NOT_FOUND and ALREADY_CANCELLED", () => {
    expect(describeCancelBlocker({ code: "NOT_FOUND" })).toBe("Không tìm thấy phiếu nhập.");
    expect(describeCancelBlocker({ code: "ALREADY_CANCELLED" })).toBe("Phiếu đã huỷ rồi.");
  });

  it("NEGATIVE names the item, the lowest moment in Saigon time, and both quantities", () => {
    expect(describeCancelBlocker({ code: "NEGATIVE", itemId: "x", itemName: "Trứng gà", lowBalance: 21,
      lowAt: "2026-10-03T15:32:00Z", orderQty: 60, baseUnit: "trái" }))
      .toBe("Huỷ phiếu này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái. Hàng của phiếu đã được dùng, nên phiếu này là thật.");
    expect(describeCancelBlocker({ code: "NEGATIVE", itemId: "y", itemName: "Sữa tươi Mlekovita", lowBalance: 42000,
      lowAt: "2026-10-05T08:42:00Z", orderQty: 60000, baseUnit: "ml" }))
      .toContain("chỉ còn 42.000 ml, phiếu có 60.000 ml");
  });

  it("NEGATIVE keeps a half unit with a decimal comma", () => {
    expect(describeCancelBlocker({ code: "NEGATIVE", itemId: "z", itemName: "Bột", lowBalance: 0.5,
      lowAt: "2026-10-05T08:42:00Z", orderQty: 2, baseUnit: "kg" }))
      .toContain("chỉ còn 0,5 kg, phiếu có 2 kg");
  });

  it("STOCKTAKE gives the order day and the count day (Saigon, not UTC)", () => {
    expect(describeCancelBlocker({ code: "STOCKTAKE", stocktakeId: "STK-001",
      confirmedAt: "2026-08-09T15:02:00Z", orderAt: "2026-08-02T17:00:00Z" }))
      .toBe("Phiếu ngày 03/08/2026 nằm trước lần kiểm kê STK-001 (09/08/2026), nên không huỷ được: lần kiểm kê đã đếm lại hàng trên kệ.");
  });

  it("DISPOSED names the asset", () => {
    expect(describeCancelBlocker({ code: "DISPOSED", assetId: "TS-080", name: "Vòi rót rượu" }))
      .toBe("Tài sản TS-080 Vòi rót rượu của phiếu đã thanh lý, nên không huỷ được phiếu.");
  });
});

describe("validateCancelReason", () => {
  it("refuses blank and over-long, trims, and accepts exactly 500", () => {
    expect(CANCEL_REASON_MAX).toBe(500);
    expect(validateCancelReason("   ")).toEqual({ ok: false, error: "Lý do huỷ phiếu là bắt buộc" });
    expect(validateCancelReason("a".repeat(501))).toEqual({ ok: false, error: "Lý do huỷ tối đa 500 ký tự" });
    expect(validateCancelReason(` ${"a".repeat(500)} `)).toEqual({ ok: true, value: "a".repeat(500) });
  });
});

describe("parseCancelCheck", () => {
  it("reads numeric strings from Postgres JSON as numbers", () => {
    const check = parseCancelCheck({ blocked: [{ code: "NEGATIVE", item_id: "x", item_name: "Trứng gà", low_balance: "21.000000",
      low_at: "2026-10-03T15:32:00+00:00", order_qty: "60.000000", base_unit: "trái" }], assets: [] });
    expect(check.blocked[0]).toMatchObject({ code: "NEGATIVE", itemId: "x", itemName: "Trứng gà", lowBalance: 21, orderQty: 60, baseUnit: "trái" });
  });

  it("reads the other blocker codes", () => {
    const check = parseCancelCheck({ blocked: [
      { code: "NOT_FOUND" },
      { code: "ALREADY_CANCELLED" },
      { code: "STOCKTAKE", stocktake_id: "STK-001", confirmed_at: "2026-08-09T15:02:00+00:00", order_at: "2026-08-02T17:00:00+00:00" },
      { code: "DISPOSED", asset_id: "TS-080", name: "Vòi rót rượu" },
    ], assets: [] });
    expect(check.blocked).toEqual([
      { code: "NOT_FOUND" },
      { code: "ALREADY_CANCELLED" },
      { code: "STOCKTAKE", stocktakeId: "STK-001", confirmedAt: "2026-08-09T15:02:00+00:00", orderAt: "2026-08-02T17:00:00+00:00" },
      { code: "DISPOSED", assetId: "TS-080", name: "Vòi rót rượu" },
    ]);
  });

  it("maps assets", () => {
    expect(parseCancelCheck({ blocked: [], assets: [{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, total_cost: "20200" }] }).assets)
      .toEqual([{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, totalCost: 20200 }]);
  });

  it("throws on a shape it does not know", () => {
    expect(() => parseCancelCheck({ blocked: [{ code: "WHAT" }], assets: [] })).toThrow();
    expect(() => parseCancelCheck(null)).toThrow();
    expect(() => parseCancelCheck({ blocked: "no", assets: [] })).toThrow();
    expect(() => parseCancelCheck({ blocked: [{ code: "NEGATIVE", item_id: "x", item_name: "Trứng gà", low_balance: "abc",
      low_at: "2026-10-03T15:32:00Z", order_qty: 60, base_unit: "trái" }], assets: [] })).toThrow();
  });
});

describe("parseCancelOutcome", () => {
  it("reads both shapes", () => {
    expect(parseCancelOutcome({ cancelled: true, retired_asset_ids: ["TS-080"] }))
      .toEqual({ cancelled: true, retiredAssetIds: ["TS-080"] });
    expect(parseCancelOutcome({ cancelled: false, blocked: [{ code: "ALREADY_CANCELLED" }] }))
      .toEqual({ cancelled: false, blocked: [{ code: "ALREADY_CANCELLED" }] });
  });

  it("throws on an unknown shape", () => {
    expect(() => parseCancelOutcome({ cancelled: "maybe" })).toThrow();
    expect(() => parseCancelOutcome(undefined)).toThrow();
  });
});
