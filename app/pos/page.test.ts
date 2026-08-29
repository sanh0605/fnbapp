import { beforeEach, describe, expect, it, vi } from "vitest";

// docs/superpowers/plans/2026-08-29-product-stop-selling-and-real-delete.md
// section 5.4/5b, established by re-derivation, not assumed: app/pos/page.tsx
// already filters products/variants on status === "ACTIVE" (not != "DELETED"),
// so an INACTIVE (paused) product is already excluded from what reaches
// POSScreen. This is an EXECUTION-level proof, not a source-text grep --
// ProductsPage is called directly as the plain async function it is, and the
// actual filtered arrays passed to <POSScreen> are inspected, so a future
// edit that changes the filter's logic (not just its literal source string)
// still fails this test.

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  getServerSession: vi.fn(),
  getPOSBestSellerProductIds: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/sheets_db", () => ({ findAll: mocks.findAll }));
vi.mock("next-auth/next", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("./actions", () => ({ getPOSBestSellerProductIds: mocks.getPOSBestSellerProductIds }));
vi.mock("@/components/POSScreen", () => ({
  default: (props: any) => ({ type: "POSScreen", props }),
}));

import POSPage from "./page";

describe("POSPage does not offer a paused (INACTIVE) product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { name: "Cashier" } });
    mocks.getPOSBestSellerProductIds.mockResolvedValue([]);
    mocks.findAll.mockImplementation(async (sheet: string) => {
      if (sheet === "Outlets") {
        return [{ id: "OUT-001", brand_id: "BR-001" }];
      }
      if (sheet === "Product_Categories") {
        return [{ id: "CAT-001", name: "Đồ uống", status: "ACTIVE" }];
      }
      if (sheet === "Products") {
        return [
          { id: "PROD-ACTIVE", name: "Cà phê đá", status: "ACTIVE" },
          { id: "PROD-PAUSED", name: "Trà đào (đã ngừng bán)", status: "INACTIVE" },
          { id: "PROD-DELETED", name: "Món cũ", status: "DELETED" },
        ];
      }
      if (sheet === "Product_Variants") {
        return [
          { id: "VAR-ACTIVE", product_id: "PROD-ACTIVE", status: "ACTIVE" },
          { id: "VAR-PAUSED", product_id: "PROD-ACTIVE", status: "INACTIVE" },
        ];
      }
      if (sheet === "Modifiers") return [];
      if (sheet === "Promotions") return [];
      return [];
    });
  });

  it("excludes an INACTIVE product from the list handed to POSScreen", async () => {
    const element: any = await POSPage({ params: {}, searchParams: { outletId: "OUT-001" } } as any);

    const productIds = element.props.products.map((p: any) => p.id);
    expect(productIds).toContain("PROD-ACTIVE");
    expect(productIds).not.toContain("PROD-PAUSED");
    expect(productIds).not.toContain("PROD-DELETED");
  });

  it("excludes an INACTIVE variant even when its product is ACTIVE", async () => {
    const element: any = await POSPage({ params: {}, searchParams: { outletId: "OUT-001" } } as any);

    const variantIds = element.props.variants.map((v: any) => v.id);
    expect(variantIds).toContain("VAR-ACTIVE");
    expect(variantIds).not.toContain("VAR-PAUSED");
  });
});
