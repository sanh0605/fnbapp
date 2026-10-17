import { describe, it, expect, vi } from "vitest";
import { redirect } from "next/navigation";
import InventoryPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("InventoryPage", () => {
  it("redirects to /admin/inventory/stock", () => {
    InventoryPage();
    expect(redirect).toHaveBeenCalledWith("/admin/inventory/stock");
  });
});
