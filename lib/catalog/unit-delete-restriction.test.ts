import { describe, expect, it } from "vitest";
import { buildUnitDeleteRestrictionMessage } from "./unit-delete-restriction";

// section A7's own worked example, verbatim.
describe("buildUnitDeleteRestrictionMessage", () => {
  it("matches A7's exact worked example (Combo 2 / uom_conversions)", () => {
    const message = buildUnitDeleteRestrictionMessage("Combo 2", {
      kind: "uom_conversions",
      count: 1,
      ownerName: "Bột cà phê MR.PHIN Robusta Đắk Mil",
    });
    expect(message).toBe(
      "Không xoá được đơn vị Combo 2 vì đang được dùng trong 1 dòng quy đổi của Bột cà phê MR.PHIN Robusta Đắk Mil. Xoá dòng quy đổi đó trước.",
    );
  });

  it("pluralizes the hint when more than one conversion row blocks it", () => {
    const message = buildUnitDeleteRestrictionMessage("Combo 2", {
      kind: "uom_conversions",
      count: 3,
      ownerName: "Bột cà phê MR.PHIN Robusta Đắk Mil",
    });
    expect(message).toContain("3 dòng quy đổi của");
    expect(message).toContain("Xoá các dòng quy đổi đó trước.");
  });

  it("names the item, not a code, for purchased_items.default_unit_id", () => {
    const message = buildUnitDeleteRestrictionMessage("Túi", {
      kind: "purchased_items",
      count: 1,
      ownerName: "Túi đựng rác",
    });
    expect(message).toBe(
      "Không xoá được đơn vị Túi vì đang được dùng trong mặt hàng mua Túi đựng rác. Đổi đơn vị mặc định của mặt hàng đó trước.",
    );
  });

  it("names the ingredient group for base_ingredients.base_unit", () => {
    const message = buildUnitDeleteRestrictionMessage("gram", {
      kind: "base_ingredients",
      count: 1,
      ownerName: "Sữa tươi",
    });
    expect(message).toBe(
      "Không xoá được đơn vị gram vì đang được dùng trong nhóm nguyên liệu Sữa tươi. Đổi đơn vị gốc của nhóm nguyên liệu đó trước.",
    );
  });

  it("names the semi-product for semi_products.base_unit", () => {
    const message = buildUnitDeleteRestrictionMessage("lít", {
      kind: "semi_products",
      count: 1,
      ownerName: "Nước đường Glofood",
    });
    expect(message).toBe(
      "Không xoá được đơn vị lít vì đang được dùng trong bán thành phẩm Nước đường Glofood. Đổi đơn vị gốc của bán thành phẩm đó trước.",
    );
  });

  it("frames purchase_order_lines as frozen history with no fix-it hint", () => {
    const message = buildUnitDeleteRestrictionMessage("Can", {
      kind: "purchase_order_lines",
      count: 2,
      ownerName: "Nước đường Glofood",
    });
    expect(message).toBe(
      "Không xoá được đơn vị Can vì đang được dùng trong 2 dòng đơn nhập lịch sử của Nước đường Glofood. Đây là lịch sử đơn nhập đã ghi nhận, đơn vị này không thể xoá được nữa.",
    );
  });

  it("falls back to a plain count for production_items, which has no owner name", () => {
    const message = buildUnitDeleteRestrictionMessage("kg", {
      kind: "production_items",
      count: 1,
      ownerName: "",
    });
    expect(message).toBe(
      "Không xoá được đơn vị kg vì đang được dùng trong 1 dòng kế hoạch sản xuất. Xoá dòng kế hoạch sản xuất đó trước.",
    );
  });
});
