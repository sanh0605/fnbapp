import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import NewUserPage from "./page";

const { resolveActorMock } = vi.hoisted(() => ({
  resolveActorMock: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: resolveActorMock,
}));

vi.mock("@/app/admin/users/components/UserForm", () => ({
  UserForm: (props: any) => <div data-testid="user-form" {...props} />,
}));

describe("NewUserPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes canGrantAdmin true when signed-in actor is ADMIN", async () => {
    resolveActorMock.mockResolvedValueOnce({
      ok: true,
      actor: { id: "USR-001", name: "admin", role: "ADMIN" },
    });

    const element = await NewUserPage({ searchParams: {} });
    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.canGrantAdmin !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.canGrantAdmin).toBe(true);
  });

  it("passes canGrantAdmin false when signed-in actor is MANAGER", async () => {
    resolveActorMock.mockResolvedValueOnce({
      ok: true,
      actor: { id: "USR-002", name: "manager", role: "MANAGER" },
    });

    const element = await NewUserPage({ searchParams: {} });
    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.canGrantAdmin !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.canGrantAdmin).toBe(false);
  });
});
