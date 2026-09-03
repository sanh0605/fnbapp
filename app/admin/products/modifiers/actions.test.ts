import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findAll: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/sheets_db", () => ({
  findAll: mocks.findAll,
  insert: vi.fn(),
  update: vi.fn(),
  generateNewId: vi.fn(),
}));

import { getModifiersData } from "./actions";

// section 5: both required tests. The second guards against the fix
// becoming "throw on empty" -- a different bug wearing the same diff.
describe("getModifiersData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ ok: true, actor: { id: "admin-1", name: "Admin" } });
  });

  it("propagates the failure instead of returning a fabricated empty result", async () => {
    mocks.findAll.mockRejectedValue(new Error("db down"));

    await expect(getModifiersData()).rejects.toThrow("db down");
  });

  it("a genuinely empty Modifiers table still resolves with [] and does not throw", async () => {
    mocks.findAll.mockResolvedValue([]);

    await expect(getModifiersData()).resolves.toEqual({ modifiers: [] });
  });
});
