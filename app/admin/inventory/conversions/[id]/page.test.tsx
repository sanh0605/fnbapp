import { describe, it, expect, vi } from "vitest";
import ConversionDetailPage from "./page";

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockImplementation(async (table: string) => {
    if (table === "UOM_Conversions") {
      return [
        {
          id: "QD-001",
          purchased_item_id: "SPM-002",
          from_unit_id: "UNT-HOP",
          to_unit_id: "UNT-ML",
          factor: "1000",
          purchased_unit: "UNT-HOP",
          conversion_rate: "1000",
          base_unit: "UNT-ML",
          status: "ACTIVE",
          purchase_only: false,
          created_at: "2026-01-01T00:00:00Z",
        },
      ];
    }
    if (table === "Purchased_Items") {
      return [{ id: "SPM-002", name: "Sữa tươi Mlekovita", item_category_id: "CAT-1", default_unit_id: "UNT-ML", status: "ACTIVE", is_non_inventory: false, created_at: "2026-01-01T00:00:00Z" }];
    }
    if (table === "Units") {
      return [
        { id: "UNT-HOP", name: "Hộp", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
        { id: "UNT-ML", name: "ml", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
      ];
    }
    if (table === "Purchase_Order_Lines") {
      return [{ id: "POL-1", conversion_id: "QD-001" }];
    }
    return [];
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { role: "ADMIN" },
  }),
}));

describe("ConversionDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    const element = await ConversionDetailPage({
      params: { id: "QD-001" },
      searchParams: { returnTo: "/admin/inventory/conversions" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
