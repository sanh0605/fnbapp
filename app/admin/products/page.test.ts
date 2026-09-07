import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/superpowers/plans/2026-09-07-link-toppings-to-products.md Task 2,
// BR-CATALOG-003: a topping sold as an add-on (modifiers_snapshot_json)
// must mark its linked CAT-007 product as sold, the same way a variant sale
// marks its product sold. ProductsPage is called directly as the plain
// async function it is, so the actual computed neverSold flags are
// inspected -- not the source text.

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  findOrderLineProductAndVariantIds: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: mocks.findAll,
  findOrderLineProductAndVariantIds: mocks.findOrderLineProductAndVariantIds,
}));
vi.mock("./ProductsClient", () => ({
  default: (props: any) => ({ type: "ProductsClient", props }),
}));

import ProductsPage from "./page";

describe("ProductsPage marks a topping sold via its linked modifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Product_Categories") {
        return [{ id: "CAT-007", name: "Topping", status: "ACTIVE" }];
      }
      if (sheet === "Products") {
        return [
          // Sold only as an add-on (MOD-A -> PROD-A, sold), never standalone.
          { id: "PROD-A", name: "20ml cốt cà phê", category_id: "CAT-007", status: "ACTIVE" },
          // Never sold at all, no modifier link, no order line.
          { id: "PROD-B", name: "Kem dẻo", category_id: "CAT-007", status: "ACTIVE" },
          // Sold only standalone (via order line), no modifier involved.
          { id: "PROD-C", name: "Đào miếng", category_id: "CAT-007", status: "ACTIVE" },
        ];
      }
      if (sheet === "Product_Variants") {
        return [
          { id: "VAR-A", product_id: "PROD-A", status: "ACTIVE" },
          { id: "VAR-B", product_id: "PROD-B", status: "ACTIVE" },
          { id: "VAR-C", product_id: "PROD-C", status: "ACTIVE" },
        ];
      }
      if (sheet === "Product_Price_History") return [];
      if (sheet === "Modifiers") {
        return [
          { id: "MOD-A", name: "20ml cốt cà phê", status: "ACTIVE", product_id: "PROD-A" },
          // Two modifiers pointing at the same product must not double-count
          // or otherwise break -- mirrors MOD-007/MOD-008 both -> PROD-035.
          { id: "MOD-A2", name: "20ml cốt cà phê (dup)", status: "DELETED", product_id: "PROD-A" },
          // Null product_id (e.g. MOD-009 shape): must mark nothing.
          { id: "MOD-NULL", name: "Hộp sữa chua", status: "ACTIVE", product_id: null },
        ];
      }
      return [];
    });
    mocks.findOrderLineProductAndVariantIds.mockResolvedValue({
      productIds: ["PROD-C"], // standalone sale of PROD-C
      variantIds: [],
      modifierIds: ["MOD-A", "MOD-A2", "MOD-NULL"], // all three modifiers sold as add-ons
    });
  });

  it("marks PROD-A sold via its linked modifier, PROD-B stays never-sold, PROD-C stays sold via its own order line", async () => {
    const element: any = await ProductsPage();
    // page.tsx wraps <ProductsClient> in an outer <div>, unlike POSPage.
    const clientProps = element.props.children.props;
    const byId = new Map<string, any>(clientProps.enhancedProducts.map((p: any) => [p.id, p]));

    expect(byId.get("PROD-A").neverSold).toBe(false);
    expect(byId.get("PROD-B").neverSold).toBe(true);
    expect(byId.get("PROD-C").neverSold).toBe(false);
  });

  // docs/superpowers/plans/2026-09-07-one-price-per-topping.md Task 2: the
  // product form must know which product is a second price editor to shut
  // off. PROD-A has an ACTIVE modifier (MOD-A) -- linked. PROD-B and PROD-C
  // have no modifier pointing at them at all -- not linked, even though
  // PROD-C is sold (via its own order line, unrelated to any modifier).
  it("flags isLinkedTopping only for a product with an ACTIVE modifier pointing at it", async () => {
    const element: any = await ProductsPage();
    const clientProps = element.props.children.props;
    const byId = new Map<string, any>(clientProps.enhancedProducts.map((p: any) => [p.id, p]));

    expect(byId.get("PROD-A").isLinkedTopping).toBe(true);
    expect(byId.get("PROD-B").isLinkedTopping).toBe(false);
    expect(byId.get("PROD-C").isLinkedTopping).toBe(false);
  });
});
