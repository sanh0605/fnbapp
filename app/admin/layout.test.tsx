import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ resolveActor: vi.fn(), findAll: vi.fn() }));

vi.mock("@/lib/auth/auth", () => ({ resolveActor: mocks.resolveActor }));
vi.mock("@/lib/db/tables", () => ({ findAll: mocks.findAll }));
vi.mock("./AdminFrame", () => ({ AdminFrame: () => null }));

import AdminLayout from "./layout";

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockResolvedValue([{ id: "USR-002", username: "tuyen2612", name: "Tài Chí Tuyền" }]);
  });

  it("loads the signed-in person's staff name on the server and hands it to the frame", async () => {
    mocks.resolveActor.mockResolvedValue({ ok: true, actor: { id: "USR-002", name: "tuyen2612", role: "MANAGER" } });
    const element = await AdminLayout({ children: null });
    expect(element.props.staffName).toBe("Tài Chí Tuyền");
  });

  it("passes null when nobody is signed in, without reading users", async () => {
    mocks.resolveActor.mockResolvedValue({ ok: false, error: "Yêu cầu đăng nhập" });
    const element = await AdminLayout({ children: null });
    expect(element.props.staffName).toBeNull();
    expect(mocks.findAll).not.toHaveBeenCalled();
  });
});
