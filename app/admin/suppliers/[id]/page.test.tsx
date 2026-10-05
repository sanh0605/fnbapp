import { describe, it, expect, vi } from "vitest";
import SupplierDetailPage from "./page";
import { getPurchaseOrdersPage } from "@/app/admin/inventory/purchase-orders/actions";

vi.mock("../actions", () => ({
  getSuppliers: vi.fn().mockResolvedValue([
    {
      id: "NCC-029",
      name: "Vinamilk",
      phone: "0901234567",
      tax_id: "",
      address: "10 Tân Trào, Q7, TP.HCM",
      links: "vinamilk.com.vn",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
    },
  ]),
  deleteSupplierAction: vi.fn(),
}));

vi.mock("@/app/admin/inventory/purchase-orders/actions", () => ({
  getPurchaseOrdersPage: vi.fn().mockResolvedValue({
    rows: [],
    total: 0,
    page: 1,
    pageCount: 1,
    firstIndex: 0,
    lastIndex: 0,
    rangeError: false,
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { role: "ADMIN" },
  }),
}));

describe("SupplierDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    const element = await SupplierDetailPage({
      params: { id: "NCC-029" },
      searchParams: { returnTo: "/admin/suppliers?q=vina" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  it("lists every order of the supplier, cancelled included (the default list hides them)", async () => {
    await SupplierDetailPage({ params: { id: "NCC-029" }, searchParams: { poPage: "2" } });

    expect(getPurchaseOrdersPage).toHaveBeenCalledWith({ supplier: "NCC-029", page: "2", status: "ALL" });
  });
});
