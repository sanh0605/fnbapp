import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditUserPage from "./page";

const { notFoundMock, resolveActorMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  resolveActorMock: vi.fn().mockResolvedValue({
    ok: true,
    actor: { id: "USR-001", name: "admin", role: "ADMIN" },
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: resolveActorMock,
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
    if (id === "USR-002") {
      return {
        id: "USR-002",
        username: "tuyen2612",
        role: "MANAGER",
        status: "ACTIVE",
        created_at: "2026-06-01T08:00:00.000Z",
      };
    }
    return null;
  }),
}));

vi.mock("@/app/admin/users/components/EditUserForm", () => ({
  default: (props: any) => <div data-testid="edit-user-form" {...props} />,
}));

describe("EditUserPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when user id is unknown", async () => {
    await expect(
      EditUserPage({ params: Promise.resolve({ id: "UNKNOWN" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/users/USR-002?returnTo=%2Fadmin%2Fusers%3Fq%3D1";
    const element = await EditUserPage({
      params: Promise.resolve({ id: "USR-002" }),
      searchParams: Promise.resolve({ returnTo }),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/users?q=1";
    const element = await EditUserPage({
      params: Promise.resolve({ id: "USR-002" }),
      searchParams: Promise.resolve({ returnTo }),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/users/USR-002?returnTo=" + encodeURIComponent("/admin/users?q=1"),
    );
  });

  it("calls notFound when a manager opens an ADMIN account", async () => {
    resolveActorMock.mockResolvedValueOnce({
      ok: true,
      actor: { id: "USR-002", name: "tuyen2612", role: "MANAGER" },
    });

    await expect(
      EditUserPage({
        params: Promise.resolve({ id: "USR-001" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("allows an admin to open an ADMIN account and passes canGrantAdmin true to form", async () => {
    resolveActorMock.mockResolvedValueOnce({
      ok: true,
      actor: { id: "USR-001", name: "admin", role: "ADMIN" },
    });

    const element = await EditUserPage({
      params: Promise.resolve({ id: "USR-001" }),
      searchParams: Promise.resolve({}),
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.user?.id === "USR-001");
    expect(formChild).toBeDefined();
    expect(formChild.props.canGrantAdmin).toBe(true);
  });
});
