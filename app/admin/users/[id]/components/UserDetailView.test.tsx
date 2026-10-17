// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, afterEach } from "vitest";
import React from "react";
import { UserDetailView } from "./UserDetailView";
import type { DBUser } from "@/types/db";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/users/actions", () => ({
  deleteUserAction: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const userAdmin: DBUser = {
  id: "USR-001",
  username: "admin",
  role: "ADMIN",
  status: "ACTIVE",
  created_at: "2026-06-28T08:00:00.000Z",
};

const userTuyen: DBUser = {
  id: "USR-002",
  username: "tuyen2612",
  role: "MANAGER",
  status: "ACTIVE",
  created_at: "2026-06-01T08:00:00.000Z",
};

const userThu: DBUser = {
  id: "USR-003",
  username: "thu",
  role: "STAFF",
  status: "ACTIVE",
  created_at: "2026-05-15T08:00:00.000Z",
};

describe("UserDetailView", () => {
  it("renders fields properly", () => {
    render(
      <UserDetailView
        user={userTuyen}
        returnTo="/admin/users"
        canDelete={false}
      />
    );

    expect(screen.getAllByText("USR-002").length).toBeGreaterThan(0);
    expect(screen.getAllByText("tuyen2612").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quản lý").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01/06/2026 15:00:00").length).toBeGreaterThan(0);

    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toBeInTheDocument();
    expect(editLink.getAttribute("href")).toContain("/admin/users/USR-002/edit?returnTo=");
  });

  it("'Xoá' is absent for admin even when canDelete is true", () => {
    render(
      <UserDetailView
        user={userAdmin}
        returnTo="/admin/users"
        canDelete={true}
      />
    );

    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("'Xoá' is absent when canDelete is false", () => {
    render(
      <UserDetailView
        user={userTuyen}
        returnTo="/admin/users"
        canDelete={false}
      />
    );

    expect(screen.queryByRole("button", { name: "Xoá" })).toBeNull();
  });

  it("'Xoá' is present for tuyen2612 with canDelete true", () => {
    render(
      <UserDetailView
        user={userTuyen}
        returnTo="/admin/users"
        canDelete={true}
      />
    );

    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });

  it("with canGrantAdmin false, the edit link is absent for an ADMIN user", () => {
    render(
      <UserDetailView
        user={userAdmin}
        returnTo="/admin/users"
        canDelete={false}
        canGrantAdmin={false}
      />
    );

    expect(screen.queryByRole("link", { name: "Chỉnh sửa" })).toBeNull();
  });

  it("with canGrantAdmin true, the edit link is present for an ADMIN user", () => {
    render(
      <UserDetailView
        user={userAdmin}
        returnTo="/admin/users"
        canDelete={true}
        canGrantAdmin={true}
      />
    );

    const editLink = screen.getByRole("link", { name: "Chỉnh sửa" });
    expect(editLink).toBeInTheDocument();
    expect(editLink.getAttribute("href")).toContain("/admin/users/USR-001/edit?returnTo=");
  });

  it("with canGrantAdmin false, the edit link is still present for a non-ADMIN user", () => {
    render(
      <UserDetailView
        user={userTuyen}
        returnTo="/admin/users"
        canDelete={false}
        canGrantAdmin={false}
      />
    );

    expect(screen.getByRole("link", { name: "Chỉnh sửa" })).toBeInTheDocument();
  });

  it("renders staff name as main heading and login under it when name is set", () => {
    const userWithName: DBUser = {
      ...userTuyen,
      name: "Tài Chí Tuyền",
    };
    render(
      <UserDetailView
        user={userWithName}
        returnTo="/admin/users"
        canDelete={true}
      />
    );
    expect(screen.getByRole("heading", { level: 1, name: "Tài Chí Tuyền" })).toBeInTheDocument();
    expect(screen.getAllByText(/tuyen2612/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Xoá" })).toBeInTheDocument();
  });
});
