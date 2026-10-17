import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveActor: vi.fn(), findAll: vi.fn() }));

vi.mock("@/lib/auth/auth", () => ({ resolveActor: mocks.resolveActor }));
vi.mock("@/lib/db/tables", () => ({ findAll: mocks.findAll }));

import { getMyStaffName } from "./actions";

describe("getMyStaffName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockResolvedValue([{ id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" }]);
  });

  it("returns the signed-in person's staff name, not the stored login", async () => {
    mocks.resolveActor.mockResolvedValue({ ok: true, actor: { id: "USR-002", name: "tuyen2612", role: "MANAGER" } });
    await expect(getMyStaffName()).resolves.toBe("Tài Chí Tuyền");
  });

  it("returns the login when the user has no name", async () => {
    mocks.findAll.mockResolvedValue([{ id: "USR-002", username: "tuyen2612", name: null }]);
    mocks.resolveActor.mockResolvedValue({ ok: true, actor: { id: "USR-002", name: "tuyen2612", role: "MANAGER" } });
    await expect(getMyStaffName()).resolves.toBe("tuyen2612");
  });

  it("returns null when nobody is signed in", async () => {
    mocks.resolveActor.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
    await expect(getMyStaffName()).resolves.toBeNull();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});
