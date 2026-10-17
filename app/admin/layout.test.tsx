import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServerSession: vi.fn(), findAll: vi.fn() }));

vi.mock("next-auth/next", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db/tables", () => ({ findAll: mocks.findAll }));
vi.mock("./AdminFrame", () => ({ AdminFrame: () => null }));

import AdminLayout from "./layout";

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockResolvedValue([{ id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" }]);
  });

  it("looks the session login up in the cached users list and hands the staff name to the frame", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "USR-002", name: "tuyen2612" } });
    const element = await AdminLayout({ children: null });
    expect(element.props.staffName).toBe("Tài Chí Tuyền");
    expect(mocks.findAll).toHaveBeenCalledWith("Users");
  });

  it("passes null when nobody is signed in, without reading users", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const element = await AdminLayout({ children: null });
    expect(element.props.staffName).toBeNull();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});
