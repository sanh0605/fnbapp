import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import UsersPage from "./page";

const { resolveActorMock, getUsersMock } = vi.hoisted(() => ({
  resolveActorMock: vi.fn(),
  getUsersMock: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: resolveActorMock,
}));

vi.mock("@/app/admin/users/actions", () => ({
  getUsers: getUsersMock,
}));

vi.mock("./components/UsersClient", () => ({
  default: (props: any) => <div data-testid="users-client" {...props} />,
}));

describe("UsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes canGrantAdmin true and canDelete true for ADMIN actor", async () => {
    resolveActorMock.mockResolvedValueOnce({
      ok: true,
      actor: { id: "USR-001", name: "admin", role: "ADMIN" },
    });

    const element = await UsersPage({});
    // UsersPage wraps UsersClient in Suspense
    const clientChild = (element.props.children as any);
    expect(clientChild.props.canGrantAdmin).toBe(true);
    expect(clientChild.props.canDelete).toBe(true);
  });

  it("passes canGrantAdmin false and canDelete false for MANAGER actor", async () => {
    resolveActorMock.mockResolvedValueOnce({
      ok: true,
      actor: { id: "USR-002", name: "manager", role: "MANAGER" },
    });

    const element = await UsersPage({});
    const clientChild = (element.props.children as any);
    expect(clientChild.props.canGrantAdmin).toBe(false);
    expect(clientChild.props.canDelete).toBe(false);
  });
});
