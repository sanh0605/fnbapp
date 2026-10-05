import { describe, expect, it, vi } from "vitest";
import { formatCancelCheck, parseCheckArgs, summariseChecks, runChecks } from "./check-purchase-order-cancel-core";
import type { CancelCheck } from "../lib/purchasing/purchase-order-cancel";

describe("parseCheckArgs", () => {
  it("takes order codes in the order given", () => {
    expect(parseCheckArgs(["PO-147", "PO-064", "PO-066"])).toEqual({ ok: true, ids: ["PO-147", "PO-064", "PO-066"] });
  });

  it("refuses no code at all", () => {
    expect(parseCheckArgs([])).toMatchObject({ ok: false });
  });

  it("refuses any flag: the script has no --apply and never writes", () => {
    const result = parseCheckArgs(["PO-147", "--apply"]);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("--apply");
  });
});

describe("formatCancelCheck", () => {
  it("a cancellable order lists the assets it would retire", () => {
    const check: CancelCheck = { blocked: [], assets: [{ id: "TS-080", name: "Vòi rót rượu", quantity: 2, totalCost: 20200 }] };
    expect(formatCancelCheck("PO-147", check)).toBe([
      "PO-147: huỷ được",
      "  tài sản sẽ ngừng: TS-080 Vòi rót rượu, SL 2, 20.200đ",
    ].join("\n"));
  });

  it("a cancellable order with no asset is one line", () => {
    expect(formatCancelCheck("PO-148", { blocked: [], assets: [] })).toBe("PO-148: huỷ được");
  });

  it("a refused order prints each sentence", () => {
    const check: CancelCheck = {
      blocked: [{ code: "NEGATIVE", itemId: "x", itemName: "Trứng gà", lowBalance: 21, lowAt: "2026-10-03T15:32:00Z", orderQty: 60, baseUnit: "trái" }],
      assets: [],
    };
    expect(formatCancelCheck("PO-064", check)).toBe([
      "PO-064: không huỷ được",
      "  Huỷ phiếu này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái. Hàng của phiếu đã được dùng, nên phiếu này là thật.",
    ].join("\n"));
  });
});

describe("summariseChecks", () => {
  it("reports the count with its denominator", () => {
    expect(summariseChecks([{ blocked: [], assets: [] }, { blocked: [{ code: "NOT_FOUND" }], assets: [] }, { blocked: [], assets: [] }]))
      .toBe("3 phiếu đã kiểm: 2 huỷ được, 1 không huỷ được.");
  });
});

describe("runChecks", () => {
  it("asks the check once per order and never calls anything else", async () => {
    const fetchCheck = vi.fn(async (id: string): Promise<CancelCheck> => ({ blocked: id === "PO-064" ? [{ code: "NOT_FOUND" }] : [], assets: [] }));
    const out = await runChecks(["PO-147", "PO-064"], fetchCheck);
    expect(fetchCheck.mock.calls.map(c => c[0])).toEqual(["PO-147", "PO-064"]);
    expect(out.text).toBe([
      "PO-147: huỷ được",
      "PO-064: không huỷ được",
      "  Không tìm thấy phiếu nhập.",
      "",
      "2 phiếu đã kiểm: 1 huỷ được, 1 không huỷ được.",
    ].join("\n"));
  });
});
