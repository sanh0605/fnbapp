// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import React from "react";
import UsersClient from "./UsersClient";
import type { DBUser } from "@/types/db";

const { replace, refresh, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    router: { replace: replaceFn, refresh: refreshFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/users",
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
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
  mockSearchParams = new URLSearchParams();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const mockUsers: DBUser[] = [
  {
    id: "USR-001",
    username: "admin",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2026-06-28T08:00:00.000Z",
  },
  {
    id: "USR-002",
    username: "tuyen2612",
    role: "MANAGER",
    status: "ACTIVE",
    created_at: "2026-06-01T08:00:00.000Z",
  },
  {
    id: "USR-003",
    username: "thu",
    role: "STAFF",
    status: "ACTIVE",
    created_at: "2026-05-15T08:00:00.000Z",
  },
];

describe("UsersClient", () => {
  it("renders no 'Sửa' or '/edit' link", () => {
    render(<UsersClient users={mockUsers} canDelete={true} />);

    expect(screen.queryByRole("link", { name: /Sửa/ })).toBeNull();
    const allLinks = screen.getAllByRole("link");
    expect(allLinks.some((l) => l.getAttribute("href")?.includes("/edit"))).toBe(false);
  });

  it("renders row link starting with /admin/users/USR-002?returnTo=", () => {
    render(<UsersClient users={mockUsers} canDelete={true} />);

    const allLinks = screen.getAllByRole("link");
    const userLinks = allLinks.filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/users/USR-002?returnTo=")
    );
    expect(userLinks.length).toBeGreaterThan(0);
  });

  it("renders in default order newest code first (USR-002 before USR-001)", () => {
    render(<UsersClient users={mockUsers} canDelete={true} />);

    const codes = screen.getAllByText(/^USR-00[123]$/).map((el) => el.textContent);
    const idx002 = codes.indexOf("USR-002");
    const idx001 = codes.indexOf("USR-001");
    expect(idx002).toBeGreaterThan(-1);
    expect(idx001).toBeGreaterThan(-1);
    expect(idx002).toBeLessThan(idx001);
  });

  it("role=STAFF shows only STAFF users and select value STAFF", () => {
    mockSearchParams = new URLSearchParams("role=STAFF");
    render(
      <UsersClient
        users={mockUsers}
        canDelete={false}
        initialRole="STAFF"
      />
    );

    expect(screen.getAllByText("thu").length).toBeGreaterThan(0);
    expect(screen.queryByText("admin")).toBeNull();
    expect(screen.queryByText("tuyen2612")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Quyền hạn" })).toHaveValue("STAFF");
  });

  it("ADMIN sees tick boxes and bins, but none on the admin row and no bin on it", () => {
    render(<UsersClient users={mockUsers} canDelete={true} />);

    expect(screen.getAllByRole("checkbox", { name: "Chọn tuyen2612" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("checkbox", { name: "Chọn thu" }).length).toBeGreaterThan(0);

    expect(screen.getAllByRole("button", { name: "Xoá tuyen2612" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Xoá thu" }).length).toBeGreaterThan(0);

    expect(screen.queryByRole("checkbox", { name: "Chọn admin" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xoá admin" })).toBeNull();
  });

  it("MANAGER (canDelete false) sees no checkbox and no bin", () => {
    render(<UsersClient users={mockUsers} canDelete={false} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Xoá/ })).toBeNull();
  });

  it("'Lọc' pushes q", () => {
    render(<UsersClient users={mockUsers} canDelete={true} />);

    const searchInput = screen.getByLabelText("Tìm nhân sự");
    fireEvent.change(searchInput, { target: { value: "tuyen" } });

    const filterButton = screen.getByRole("button", { name: "Lọc" });
    fireEvent.click(filterButton);

    expect(replace).toHaveBeenCalledWith("/admin/users?q=tuyen", { scroll: false });
  });

  it("Tạo button links to new user page carrying returnTo", () => {
    render(<UsersClient users={mockUsers} canDelete={true} />);

    const addBtn = screen.getByRole("link", { name: "Tạo" });
    expect(addBtn).toBeInTheDocument();
    expect(addBtn.getAttribute("href")).toBe(
      "/admin/users/new?returnTo=" + encodeURIComponent("/admin/users")
    );
  });
});
