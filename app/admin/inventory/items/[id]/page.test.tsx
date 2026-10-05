import { describe, it, expect, vi } from "vitest";
import ItemDetailPage from "./page";

vi.mock("../actions", () => ({
  getItemsData: vi.fn().mockResolvedValue({
    items: [
      {
        id: "SPM-002",
        name: "Sữa tươi Mlekovita",
        item_category_id: "CAT-1",
        default_unit_id: "UNT-ML",
        status: "ACTIVE",
        is_non_inventory: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    categories: [
      { id: "CAT-1", name: "Nguyên liệu", system_type: "RAW", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
    ],
    conversions: [
      {
        id: "QD-1",
        purchased_item_id: "SPM-002",
        from_unit_id: "UNT-HOP",
        to_unit_id: "UNT-ML",
        factor: "1000",
        purchased_unit: "Hộp",
        conversion_rate: "1000",
        base_unit: "ml",
        status: "ACTIVE",
        purchase_only: false,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    units: [
      { id: "UNT-ML", name: "ml", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
      { id: "UNT-HOP", name: "Hộp", abbreviation: "", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
    ],
    unitLockedItemIds: [],
  }),
  getItemPurchaseHistory: vi.fn().mockResolvedValue([]),
  getItemStockById: vi.fn().mockResolvedValue({
    "SPM-002": { kind: "figure", text: "42.000 ml", onHand: 42000 },
  }),
  deletePurchasedItemAction: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { role: "ADMIN" },
  }),
}));

describe("ItemDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    const element = await ItemDetailPage({
      params: { id: "SPM-002" },
      searchParams: { returnTo: "/admin/inventory/items?q=sữa" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
    expect(props.stock).toEqual({ kind: "figure", text: "42.000 ml", onHand: 42000 });
  });
});
