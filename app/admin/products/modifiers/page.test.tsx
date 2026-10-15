import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  getModifiersData: async () => ({
    modifiers: [{ id: "MOD-009", product_id: "PROD-049", status: "ACTIVE" }],
  }),
}));
vi.mock("@/lib/auth/auth", () => ({
  resolveActor: async () => ({ ok: true, actor: { role: "ADMIN" } }),
}));
vi.mock("@/lib/db/tables", () => ({
  findAll: async () => [
    { id: "PROD-049", name: "Hộp sữa chua", category_id: "CAT-006" },
    { id: "PROD-050", name: "Đào miếng", category_id: "CAT-007" },
  ],
}));
vi.mock("@/app/admin/products/modifiers/components/ModifiersClient", () => ({ default: () => null }));

import ModifiersPage from "./page";

// Audit F4: the toppings list follows the modifier link, not the dish group.
describe("ModifiersPage toppings", () => {
  it("passes the linked product even when moved out of CAT-007, and skips an unlinked CAT-007 one", async () => {
    const tree: any = await ModifiersPage({});
    const client = tree.props.children;
    expect(client.props.toppings.map((p: any) => p.id)).toEqual(["PROD-049"]);
  });
});
