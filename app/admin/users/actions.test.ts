import { beforeEach, describe, expect, it, vi } from "vitest";

const findAllMock = vi.fn();
const requireAdminMock = vi.fn();
const requireOwnerMock = vi.fn();
const removeMock = vi.fn();

vi.mock("@/lib/db/tables", () => ({
  findAll: findAllMock,
  insert: vi.fn(),
  update: vi.fn(),
  remove: removeMock,
  generateNewId: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  requireAdmin: requireAdminMock,
  requireOwner: requireOwnerMock,
}));

describe("admin user client payloads", () => {
  beforeEach(() => {
    findAllMock.mockReset();
    requireAdminMock.mockReset();
    requireOwnerMock.mockReset();
    removeMock.mockReset();
    requireOwnerMock.mockResolvedValue({
      ok: true,
      actor: { id: "USR-001", name: "Chủ quán", role: "ADMIN" },
    });
    requireAdminMock.mockResolvedValue({
      ok: true,
      actor: { id: "admin-1", name: "Quản lý", role: "ADMIN" },
    });
  });

  it("rejects an unauthenticated user read before loading credential rows", async () => {
    const { getUsers } = await import("./actions");
    requireAdminMock.mockResolvedValue({ error: "Yêu cầu đăng nhập" });

    await expect(getUsers()).rejects.toThrow("Yêu cầu đăng nhập");
    expect(findAllMock).not.toHaveBeenCalled();
  });

  it("projects user lists to the fields required by the client", async () => {
    const { getUsers } = await import("./actions");
    findAllMock.mockResolvedValue([{
      id: "USR-001",
      username: "owner",
      password_hash: "bcrypt-secret",
      password: "legacy-secret",
      reset_token: "reset-secret",
      role: "ADMIN",
      status: "ACTIVE",
      created_at: "2026-07-17T00:00:00.000Z",
    }]);

    await expect(getUsers()).resolves.toEqual([{
      id: "USR-001",
      username: "owner",
      role: "ADMIN",
      status: "ACTIVE",
      created_at: "2026-07-17T00:00:00.000Z",
    }]);
  });

  it("projects the edit-page user to the same safe client shape", async () => {
    const { getUserById } = await import("./actions");
    findAllMock.mockResolvedValue([{
      id: "USR-002",
      username: "manager",
      password_hash: "bcrypt-secret",
      role: "MANAGER",
      status: "ACTIVE",
      created_at: "2026-07-17T00:00:00.000Z",
    }]);

    await expect(getUserById("USR-002")).resolves.toEqual({
      id: "USR-002",
      username: "manager",
      role: "MANAGER",
      status: "ACTIVE",
      created_at: "2026-07-17T00:00:00.000Z",
    });
  });

  // section 5: both required tests, for both loaders in this file. The
  // second guards against the fix becoming "throw on empty" -- a different
  // bug wearing the same diff. getUserById is the one loader in this whole
  // sweep that already returns null on a legitimate "not found" -- the
  // point of these two tests is that a real read failure must not collapse
  // into that same, different, outcome.
  it("getUsers propagates the failure instead of returning a fabricated empty list", async () => {
    const { getUsers } = await import("./actions");
    findAllMock.mockRejectedValue(new Error("db down"));

    await expect(getUsers()).rejects.toThrow("db down");
  });

  it("getUsers over a genuinely empty Users table still resolves with [] and does not throw", async () => {
    const { getUsers } = await import("./actions");
    findAllMock.mockResolvedValue([]);

    await expect(getUsers()).resolves.toEqual([]);
  });

  it("getUserById propagates the failure instead of returning null", async () => {
    const { getUserById } = await import("./actions");
    findAllMock.mockRejectedValue(new Error("db down"));

    await expect(getUserById("USR-002")).rejects.toThrow("db down");
  });

  it("getUserById over a genuinely empty Users table still resolves with null (not found) and does not throw", async () => {
    const { getUserById } = await import("./actions");
    findAllMock.mockResolvedValue([]);

    await expect(getUserById("USR-002")).resolves.toBeNull();
  });

  describe("deleteUserAction safety checks", () => {
    const form = (id: string) => {
      const fd = new FormData();
      fd.set("id", id);
      return fd;
    };
    const owner = { id: "USR-001", username: "owner", role: "ADMIN", status: "ACTIVE" };
    const owner2 = { id: "USR-003", username: "owner2", role: "ADMIN", status: "ACTIVE" };
    const staff = { id: "USR-002", username: "staff", role: "STAFF", status: "ACTIVE" };

    it("refuses to delete the signed-in account and removes nothing", async () => {
      const { deleteUserAction } = await import("./actions");
      findAllMock.mockResolvedValue([owner, owner2, staff]);

      const result = await deleteUserAction(form("USR-001"));

      expect(result).toEqual({ error: "Không thể xoá tài khoản đang đăng nhập." });
      expect(removeMock).not.toHaveBeenCalled();
    });

    it("refuses to delete the last ADMIN account and removes nothing", async () => {
      const { deleteUserAction } = await import("./actions");
      requireOwnerMock.mockResolvedValue({
        ok: true,
        actor: { id: "system", name: "Hệ thống", role: "SYSTEM" },
      });
      findAllMock.mockResolvedValue([owner, staff]);

      const result = await deleteUserAction(form("USR-001"));

      expect(result).toEqual({ error: "Không thể xoá tài khoản chủ quán cuối cùng." });
      expect(removeMock).not.toHaveBeenCalled();
    });

    // A stopped ADMIN cannot sign in (lib/auth/auth.ts), so it does not count.
    it("refuses to delete the last active ADMIN even when a stopped ADMIN remains", async () => {
      const { deleteUserAction } = await import("./actions");
      requireOwnerMock.mockResolvedValue({
        ok: true,
        actor: { id: "system", name: "Hệ thống", role: "SYSTEM" },
      });
      findAllMock.mockResolvedValue([owner, { ...owner2, status: "INACTIVE" }, staff]);

      const result = await deleteUserAction(form("USR-001"));

      expect(result).toEqual({ error: "Không thể xoá tài khoản chủ quán cuối cùng." });
      expect(removeMock).not.toHaveBeenCalled();
    });

    it("allows deleting one of two ADMIN accounts", async () => {
      const { deleteUserAction } = await import("./actions");
      findAllMock.mockResolvedValue([owner, owner2, staff]);

      const result = await deleteUserAction(form("USR-003"));

      expect(result).toEqual({ success: true });
      expect(removeMock).toHaveBeenCalledWith("Users", "USR-003");
    });

    it("allows deleting a non-admin account", async () => {
      const { deleteUserAction } = await import("./actions");
      findAllMock.mockResolvedValue([owner, staff]);

      const result = await deleteUserAction(form("USR-002"));

      expect(result).toEqual({ success: true });
      expect(removeMock).toHaveBeenCalledWith("Users", "USR-002");
    });
  });
});
