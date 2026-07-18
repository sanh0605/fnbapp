import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getSupabaseClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  selectEq: vi.fn(),
  maybeSingle: vi.fn(),
  update: vi.fn(),
  updateEq: vi.fn(),
  sheetsGet: vi.fn(),
  sheetsUpdate: vi.fn(),
}));

vi.mock("next-auth/next", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock("@/lib/sheets", () => ({
  getSheetData: vi.fn(),
  SPREADSHEET_ID: "legacy-sheet",
  sheets: {
    spreadsheets: {
      values: {
        get: mocks.sheetsGet,
        update: mocks.sheetsUpdate,
      },
    },
  },
}));

import { changePasswordAction } from "./auth";

describe("changePasswordAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: "USR-001", name: "owner", role: "ADMIN" },
    });
    mocks.getSupabaseClient.mockReturnValue({ from: mocks.from });
    mocks.from.mockReturnValue({ select: mocks.select, update: mocks.update });
    mocks.select.mockReturnValue({ eq: mocks.selectEq });
    mocks.selectEq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
    mocks.update.mockReturnValue({ eq: mocks.updateEq });
    mocks.updateEq.mockResolvedValue({ error: null });
    mocks.sheetsGet.mockResolvedValue({
      data: {
        values: [
          ["username", "password_hash"],
          ["owner", "legacy-sha256-hash"],
        ],
      },
    });
  });

  it("updates the Supabase user selected by session user ID when the old password matches", async () => {
    const currentHash = await bcrypt.hash("old-password", 4);
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "USR-001", password_hash: currentHash },
      error: null,
    });

    const result = await changePasswordAction("old-password", "new-password");

    expect(result).toEqual({ success: true });
    expect(mocks.from).toHaveBeenCalledWith("users");
    expect(mocks.select).toHaveBeenCalledWith("id, password_hash");
    expect(mocks.selectEq).toHaveBeenCalledWith("id", "USR-001");
    expect(mocks.update).toHaveBeenCalledWith({
      password_hash: expect.any(String),
    });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", "USR-001");
    const [{ password_hash: newHash }] = mocks.update.mock.calls[0];
    expect(bcrypt.getRounds(newHash)).toBe(10);
    await expect(bcrypt.compare("new-password", newHash)).resolves.toBe(true);
    expect(mocks.sheetsUpdate).not.toHaveBeenCalled();
  });

  it("rejects a wrong old password without updating Supabase", async () => {
    const currentHash = await bcrypt.hash("actual-password", 4);
    mocks.maybeSingle.mockResolvedValue({
      data: { id: "USR-001", password_hash: currentHash },
      error: null,
    });

    const result = await changePasswordAction("wrong-password", "new-password");

    expect(result).toEqual({ success: false, error: "Mật khẩu cũ không chính xác" });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.sheetsUpdate).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request before reading credential storage", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const result = await changePasswordAction("old-password", "new-password");

    expect(result).toEqual({ success: false, error: "Bạn chưa đăng nhập" });
    expect(mocks.getSupabaseClient).not.toHaveBeenCalled();
    expect(mocks.sheetsGet).not.toHaveBeenCalled();
  });
});
