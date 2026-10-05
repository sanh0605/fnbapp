import { describe, it, expect, vi } from "vitest";
import CategoryDetailPage from "./page";

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockImplementation(async (table: string) => {
    if (table === "Item_Categories") {
      return [{ id: "NHH-001", name: "Nguyên liệu", system_type: "RAW", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" }];
    }
    if (table === "Purchased_Items") {
      return [
        { id: "SPM-001", name: "Cà phê", item_category_id: "NHH-001" },
        { id: "SPM-002", name: "Sữa", item_category_id: "NHH-001" },
      ];
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

describe("CategoryDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    const element = await CategoryDetailPage({
      params: { id: "NHH-001" },
      searchParams: { returnTo: "/admin/inventory/categories" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
