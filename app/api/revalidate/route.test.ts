import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const revalidateTagMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

describe("GET /api/revalidate", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    revalidateTagMock.mockReset();
  });

  it("rejects an unauthenticated request before changing cache state", async () => {
    const { GET } = await import("./route");
    requireAdminMock.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Yêu cầu đăng nhập" });
    expect(revalidateTagMock).not.toHaveBeenCalled();
  });

  it("keeps the existing revalidation behavior for an authenticated administrator", async () => {
    const { GET } = await import("./route");
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Owner", role: "ADMIN" },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ revalidated: true });
    expect(revalidateTagMock.mock.calls).toEqual([
      ["sheets-Order_Lines"],
      ["sheets-Orders"],
    ]);
  });
});
