import { describe, expect, it } from "vitest";
import {
  assetRemovalAskMessage,
  assetRemovalRefusalMessage,
  decideAssetRemoval,
} from "./asset-removal";

const tsHop = {
  id: "TS-067",
  name_snapshot: "Hộp đựng topping liền nắp",
  quantity: 200,
  total_cost: 80352,
  status: "ACTIVE",
};

describe("decideAssetRemoval", () => {
  it("is none when the chosen category is still EQUIPMENT, whatever the assets are", () => {
    expect(decideAssetRemoval({ systemType: "EQUIPMENT", assets: [tsHop], disposals: [] })).toEqual({ kind: "none" });
  });

  it("is none when the category is unknown (cannot tell it left equipment)", () => {
    expect(decideAssetRemoval({ systemType: null, assets: [tsHop], disposals: [] })).toEqual({ kind: "none" });
  });

  it("is none when the item has no assets", () => {
    expect(decideAssetRemoval({ systemType: "CONSUMABLE", assets: [], disposals: [] })).toEqual({ kind: "none" });
  });

  it("is none when every asset is already INACTIVE", () => {
    const retired = { ...tsHop, status: "INACTIVE" };
    expect(decideAssetRemoval({ systemType: "CONSUMABLE", assets: [retired], disposals: [{ asset_id: "TS-067" }] })).toEqual({ kind: "none" });
  });

  it("asks with the assets to retire, their count and exact total cost", () => {
    const second = { id: "TS-068", name_snapshot: "Hộp đựng topping liền nắp", quantity: 50, total_cost: 20000.5, status: "ACTIVE" };
    expect(decideAssetRemoval({ systemType: "CONSUMABLE", assets: [tsHop, second], disposals: [] })).toEqual({
      kind: "ask",
      assets: [tsHop, second],
      count: 2,
      totalCost: 100352.5,
    });
  });

  it("asks again for a RAW category too: the trigger is anything that is not EQUIPMENT", () => {
    expect(decideAssetRemoval({ systemType: "RAW", assets: [tsHop], disposals: [] }).kind).toBe("ask");
  });

  it("refuses, naming the assets that have a disposal", () => {
    const second = { ...tsHop, id: "TS-068" };
    expect(
      decideAssetRemoval({ systemType: "CONSUMABLE", assets: [tsHop, second], disposals: [{ asset_id: "TS-068" }] }),
    ).toEqual({ kind: "refuse", assetIds: ["TS-068"] });
  });

  it("ignores a disposal that belongs to an already INACTIVE asset", () => {
    const retired = { ...tsHop, id: "TS-001", status: "INACTIVE" };
    const result = decideAssetRemoval({ systemType: "CONSUMABLE", assets: [retired, tsHop], disposals: [{ asset_id: "TS-001" }] });
    expect(result.kind).toBe("ask");
  });
});

describe("messages", () => {
  it("ask message names the asset, quantity and cost the way the owner sees them", () => {
    const decision = decideAssetRemoval({ systemType: "CONSUMABLE", assets: [tsHop], disposals: [] });
    if (decision.kind !== "ask") throw new Error("expected ask");
    expect(assetRemovalAskMessage(decision)).toBe(
      "Đổi sang loại này sẽ gỡ 1 tài sản khỏi trang Tài sản: TS-067 Hộp đựng topping liền nắp, 200 cái, 80,352đ. Khấu hao đã tính cho các tháng trước cũng bỏ theo. Tiếp tục?",
    );
  });

  it("ask message lists several assets", () => {
    const second = { id: "TS-068", name_snapshot: "Kẹp", quantity: 3, total_cost: 1500, status: "ACTIVE" };
    const decision = decideAssetRemoval({ systemType: "CONSUMABLE", assets: [tsHop, second], disposals: [] });
    if (decision.kind !== "ask") throw new Error("expected ask");
    const msg = assetRemovalAskMessage(decision);
    expect(msg).toContain("gỡ 2 tài sản");
    expect(msg).toContain("TS-067 Hộp đựng topping liền nắp, 200 cái, 80,352đ");
    expect(msg).toContain("TS-068 Kẹp, 3 cái, 1,500đ");
  });

  it("refusal message names the asset ids", () => {
    expect(assetRemovalRefusalMessage(["TS-068"])).toBe(
      "Không đổi loại được: tài sản TS-068 của món này đã có lần thanh lý. Giữ loại Thiết bị.",
    );
    expect(assetRemovalRefusalMessage(["TS-068", "TS-070"])).toContain("TS-068, TS-070");
  });
});
