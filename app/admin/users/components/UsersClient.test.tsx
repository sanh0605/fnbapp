// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import UsersClient from "./UsersClient";
import type { DBUser } from "@/types/db";

const { replace, refresh, back, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./UserForm", () => ({
  DeleteUserButton: () => <button>Xóa</button>,
}));

function user(id: string, username: string, role: "STAFF" | "MANAGER" | "ADMIN"): DBUser {
  return {
    id,
    username,
    role,
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
  };
}

const mockUsers: DBUser[] = [
  user("USR-001", "nhanvien01", "STAFF"),
  user("USR-002", "quanly01", "MANAGER"),
  user("USR-003", "admin01", "ADMIN"),
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
});

describe("UsersClient", () => {
  it("renders with initialFilters role STAFF showing only STAFF users and select value STAFF", () => {
    render(
      <UsersClient
        users={mockUsers}
        canDelete={false}
        initialFilters={{ q: "", role: "STAFF" }}
      />
    );
    expect(screen.getAllByText("nhanvien01").length).toBeGreaterThan(0);
    expect(screen.queryByText("quanly01")).toBeNull();
    expect(screen.queryByText("admin01")).toBeNull();
    expect(screen.getByRole("combobox")).toHaveValue("STAFF");
  });

  it("typing search updates the URL with replace without scroll", () => {
    render(<UsersClient users={mockUsers} canDelete={false} initialFilters={{ q: "", role: "ALL" }} />);
    fireEvent.change(screen.getByPlaceholderText("Tên đăng nhập..."), { target: { value: "admin" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/users?q=admin", { scroll: false });
  });

  it("changing role updates the URL with replace without scroll", () => {
    render(<UsersClient users={mockUsers} canDelete={false} initialFilters={{ q: "", role: "ALL" }} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "MANAGER" } });
    expect(replace).toHaveBeenLastCalledWith("/admin/users?role=MANAGER", { scroll: false });
  });

  it("+ Thêm Nhân Sự links to new page carrying returnTo", () => {
    render(<UsersClient users={mockUsers} canDelete={false} initialFilters={{ q: "nv", role: "STAFF" }} />);
    const link = screen.getByRole("link", { name: "+ Thêm Nhân Sự" });
    expect(link).toHaveAttribute(
      "href",
      "/admin/users/new?returnTo=" + encodeURIComponent("/admin/users?q=nv&role=STAFF")
    );
  });

  it("Sửa links to user edit page carrying returnTo", () => {
    render(<UsersClient users={mockUsers} canDelete={false} initialFilters={{ q: "", role: "ALL" }} />);
    const links = screen.getAllByRole("link", { name: "Sửa" });
    expect(links[0]).toHaveAttribute(
      "href",
      "/admin/users/edit/USR-001?returnTo=" + encodeURIComponent("/admin/users")
    );
  });
});
