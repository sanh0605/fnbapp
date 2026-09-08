import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/superpowers/plans/2026-09-08-gop-cot-ban-doc-lap.md Task 5 (extended
// to app/pos/actions.ts by the 2026-09-08 scope reversal) + BR-CATALOG-003
// ("Toppings do not appear among the POS quick-add best-sellers"). Until
// today, getPOSBestSellerProductIds built `standaloneToppingIds` from a
// regex against products.migration_notes -- a column that has never
// existed -- so the exclusion never fired and standalone toppings could
// appear as quick-add best-sellers. This pins the fix: the same
// buildStandaloneToppingProductLinks helper Task 5 gave the P&L/sales
// reports, reading modifiers.product_id (migration 0097), so both sites can
// only ever agree.
const mocks = vi.hoisted(() => ({
  resolveActor: vi.fn(),
  findAll: vi.fn(),
  findAllNoCache: vi.fn(),
  findAllWhere: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: mocks.resolveActor,
  authOptions: {},
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findAllNoCache: mocks.findAllNoCache,
  findAllWhere: mocks.findAllWhere,
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}));

import { getPOSBestSellerProductIds } from "./actions";

const createdAt = "2026-07-01T10:00:00.000Z";

function makeOrder(id: string) {
  return {
    id,
    order_no: `TOP-${id}`,
    brand_id: "BR-001",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: createdAt,
    created_by_id: "U",
    created_by_name: "Test",
    completed_at: createdAt,
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: 10000,
    promo_discount_total: 0,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 10000,
    applied_promotion_id: "",
    applied_promotion_snapshot_json: "",
    pos_snapshot_json: "{}",
    payment_method: "CASH",
    payment_ref: "",
    migration_notes: "",
  };
}

function makeLine(orderId: string, lineId: string, productId: string, name: string, qty: number) {
  return {
    order_id: orderId,
    id: lineId,
    line_no: 1,
    product_id: productId,
    product_snapshot_json: JSON.stringify({ id: productId, name, category_id: "CAT-007", category_name: "Topping" }),
    variant_id: `VAR-${productId}`,
    variant_snapshot_json: JSON.stringify({ id: `VAR-${productId}`, size_name: "1 phần", price: 10000 }),
    qty,
    unit_price: 10000,
    gross_line_total: 10000 * qty,
    promo_discount: 0,
    manual_item_discount: 0,
    order_discount_allocation: 0,
    net_line_total: 10000 * qty,
    cost_at_sale: 0,
    recipe_snapshot_json: "{}",
    promo_discount_reason: "",
    manual_discount_reason: "",
    modifiers_snapshot_json: "[]",
  };
}

describe("getPOSBestSellerProductIds -- standalone topping exclusion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActor.mockResolvedValue({ ok: true, user: { id: "U", name: "Test" } });
  });

  it("excludes a linked standalone topping product from quick-add best-sellers", async () => {
    const linkedOrder = makeOrder("ord-linked-topping");
    const linkedLine = makeLine(linkedOrder.id, "ol-linked", "PROD-033", "Kem muối phô mai", 5);
    const drinkOrder = makeOrder("ord-drink");
    const drinkLine = makeLine(drinkOrder.id, "ol-drink", "PROD-001", "Cà phê sữa", 1);

    mocks.findAllWhere.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") return [linkedOrder, drinkOrder];
      if (sheet === "Order_Lines_V2") return [linkedLine, drinkLine];
      return [];
    });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Products") return [
        { id: "PROD-033", name: "Kem muối phô mai", category_id: "CAT-007" },
        { id: "PROD-001", name: "Cà phê sữa", category_id: "CAT-001" },
      ];
      if (sheet === "Modifiers") return [
        { id: "MOD-033", name: "Kem muối phô mai", status: "ACTIVE", product_id: "PROD-033" },
      ];
      return [];
    });

    const result = await getPOSBestSellerProductIds({ startDate: "2026-07-01", endDate: "2026-07-31" });

    expect(result).not.toContain("PROD-033");
    expect(result).toContain("PROD-001");
  });

  it("an orphan CAT-007 product with no modifier link is not excluded -- there is no link to identify it by", async () => {
    const order = makeOrder("ord-orphan-topping");
    const line = makeLine(order.id, "ol-orphan", "PROD-099", "Đào miếng", 3);

    mocks.findAllWhere.mockImplementation(async (sheet: string) => {
      if (sheet === "Orders_V2") return [order];
      if (sheet === "Order_Lines_V2") return [line];
      return [];
    });
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Products") return [{ id: "PROD-099", name: "Đào miếng", category_id: "CAT-007" }];
      if (sheet === "Modifiers") return [];
      return [];
    });

    const result = await getPOSBestSellerProductIds({ startDate: "2026-07-01", endDate: "2026-07-31" });

    expect(result).toContain("PROD-099");
  });
});
