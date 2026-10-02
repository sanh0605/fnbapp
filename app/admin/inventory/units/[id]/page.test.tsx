import { describe, it, expect, vi } from "vitest";
import UnitDetailPage from "./page";

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn().mockResolvedValue([
    { id: "UNT-001", name: "Hộp", abbreviation: "Hộp giấy", status: "ACTIVE", created_at: "2026-01-01T00:00:00Z" },
  ]),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { role: "ADMIN" },
  }),
}));

describe("UnitDetailPage", () => {
  it("does not pass function props to Client Component", async () => {
    const element = await UnitDetailPage({
      params: { id: "UNT-001" },
      searchParams: { returnTo: "/admin/inventory/units" },
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });
});
