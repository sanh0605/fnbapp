// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import EditUserForm from "./EditUserForm";
import type { DBUser } from "@/types/db";

const { replace, refresh, back, push, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    searchParams: new URLSearchParams(),
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("@/app/admin/users/actions", () => ({
  updateUser: mocks.updateUser,
}));

function userFixture(overrides: Partial<DBUser> = {}): DBUser {
  return {
    id: "USR-001",
    username: "nhanvien01",
    role: "STAFF",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
  mocks.updateUser.mockReset();
});

describe("EditUserForm", () => {
  it("renders username disabled and shows Bỏ and Cập nhật nhân sự buttons", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" />);
    const usernameInput = screen.getByLabelText("Tên đăng nhập");
    expect(usernameInput).toBeDisabled();
    expect(usernameInput).toHaveValue("nhanvien01");
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cập nhật nhân sự" })).toBeInTheDocument();
  });

  it("renders role options with Vietnamese-only labels (no English)", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" />);
    expect(screen.getByRole("option", { name: "Nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản lý" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản trị viên" })).toBeInTheDocument();
    expect(screen.queryByText(/STAFF/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MANAGER/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ADMIN/i)).not.toBeInTheDocument();
  });

  it("after a successful update, navigates to returnTo and refreshes", async () => {
    mocks.updateUser.mockResolvedValue({});
    render(<EditUserForm user={userFixture()} returnTo="/admin/users?role=STAFF" />);
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật nhân sự" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users?role=STAFF"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on the page and shows error alert", async () => {
    mocks.updateUser.mockResolvedValue({ error: "Lỗi cập nhật người dùng" });
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" />);
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật nhân sự" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Lỗi cập nhật người dùng"));
    expect(push).not.toHaveBeenCalled();
  });

  it("Bỏ goes to returnTo without saving", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users?q=test" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/users?q=test");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
