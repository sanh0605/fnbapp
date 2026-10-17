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
  it("renders username disabled and shows Bỏ thay đổi and Lưu thay đổi buttons", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" />);
    const usernameInput = screen.getByLabelText("Tên đăng nhập");
    expect(usernameInput).toBeDisabled();
    expect(usernameInput).toHaveValue("nhanvien01");
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
  });

  it("prefills the staff name with the saved name when present", () => {
    render(<EditUserForm user={userFixture({ name: "Nguyễn Văn An" })} returnTo="/admin/users" />);
    const nameInput = screen.getByLabelText(/^Tên nhân viên/);
    expect(nameInput).toHaveValue("Nguyễn Văn An");
    expect(nameInput).toHaveAttribute("maxLength", "60");
    expect(nameInput).toHaveAttribute("placeholder", "Ví dụ: Nguyễn Văn An");
  });

  it("prefills the staff name with the login when the saved name is empty or missing", () => {
    render(<EditUserForm user={userFixture({ name: "", username: "nhanvien01" })} returnTo="/admin/users" />);
    expect(screen.getByLabelText(/^Tên nhân viên/)).toHaveValue("nhanvien01");

    cleanup();
    render(<EditUserForm user={userFixture({ name: undefined, username: "nhanvien02" })} returnTo="/admin/users" />);
    expect(screen.getByLabelText(/^Tên nhân viên/)).toHaveValue("nhanvien02");
  });

  it("submits the updated name in formData", async () => {
    mocks.updateUser.mockResolvedValue({});
    render(<EditUserForm user={userFixture({ name: "Nguyễn Văn An" })} returnTo="/admin/users" />);
    fireEvent.change(screen.getByLabelText(/^Tên nhân viên/), { target: { value: "Nguyễn Văn Bình" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledTimes(1));
    const formData = mocks.updateUser.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Nguyễn Văn Bình");
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

  it("with canGrantAdmin false, the ADMIN option is absent and only STAFF and MANAGER are present", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" canGrantAdmin={false} />);
    expect(screen.getByRole("option", { name: "Nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản lý" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Quản trị viên" })).toBeNull();
  });

  it("with canGrantAdmin true, the ADMIN option is present", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" canGrantAdmin={true} />);
    expect(screen.getByRole("option", { name: "Quản trị viên" })).toBeInTheDocument();
  });

  it("after a successful update, navigates to returnTo and refreshes", async () => {
    mocks.updateUser.mockResolvedValue({});
    render(<EditUserForm user={userFixture()} returnTo="/admin/users?role=STAFF" />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users?role=STAFF"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on the page and shows error alert", async () => {
    mocks.updateUser.mockResolvedValue({ error: "Lỗi cập nhật người dùng" });
    render(<EditUserForm user={userFixture()} returnTo="/admin/users" />);
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Lỗi cập nhật người dùng"));
    expect(push).not.toHaveBeenCalled();
  });

  it("Bỏ thay đổi goes to returnTo without saving", () => {
    render(<EditUserForm user={userFixture()} returnTo="/admin/users?q=test" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenCalledWith("/admin/users?q=test");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
