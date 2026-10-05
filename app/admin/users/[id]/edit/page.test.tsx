import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import EditUserPage from "./page";

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
      EditUserPage({ params: { id: "UNKNOWN" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("passes returnTo unchanged to form when returnTo is this record's own detail path", async () => {
    const returnTo = "/admin/users/USR-002?returnTo=%2Fadmin%2Fusers%3Fq%3D1";
    const element = await EditUserPage({
      params: { id: "USR-002" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(returnTo);
  });

  it("builds detail URL with encoded list returnTo when returnTo is a list URL", async () => {
    const returnTo = "/admin/users?q=1";
    const element = await EditUserPage({
      params: { id: "USR-002" },
      searchParams: { returnTo },
    });

    const children = React.Children.toArray(element.props.children);
    const formChild: any = children.find((c: any) => c.props?.returnTo !== undefined);
    expect(formChild).toBeDefined();
    expect(formChild.props.returnTo).toBe(
      "/admin/users/USR-002?returnTo=" + encodeURIComponent("/admin/users?q=1"),
    );
  });
});
