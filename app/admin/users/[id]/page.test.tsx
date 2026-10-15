import { describe, it, expect, vi, beforeEach } from "vitest";
import UserDetailPage from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/app/admin/users/actions", () => ({
  getUserById: vi.fn().mockImplementation(async (id: string) => {
    if (id === "USR-001") {
      return {
        id: "USR-001",
        username: "admin",
        role: "ADMIN",
        status: "ACTIVE",
        created_at: "2026-06-28T08:00:00.000Z",
      };
    }
    return null;
  }),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "USR-001", name: "admin", role: "ADMIN" },
  }),
}));

describe("UserDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when user id is unknown", async () => {
    await expect(
      UserDetailPage({ params: Promise.resolve({ id: "UNKNOWN" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not pass function props to Client Component", async () => {
    const element = await UserDetailPage({
      params: Promise.resolve({ id: "USR-001" }),
      searchParams: Promise.resolve({ returnTo: "/admin/users" }),
    });

    const props = element.props;
    expect(Object.values(props).every((v) => typeof v !== "function")).toBe(true);
  });

  it("passes canGrantAdmin to UserDetailView", async () => {
    const element = await UserDetailPage({
      params: Promise.resolve({ id: "USR-001" }),
      searchParams: Promise.resolve({ returnTo: "/admin/users" }),
    });

    expect(element.props.canGrantAdmin).toBe(true);
  });
});
