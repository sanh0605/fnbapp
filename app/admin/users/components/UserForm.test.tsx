// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { UserForm } from "./UserForm";

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
  addUser: vi.fn(),
  deleteUserAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/users",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("@/app/admin/users/actions", () => ({
  addUser: mocks.addUser,
  deleteUserAction: mocks.deleteUserAction,
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
  mocks.addUser.mockReset();
  mocks.deleteUserAction.mockReset();
});

describe("UserForm", () => {
  it("renders on the page and immediately shows the username input and Bỏ button", () => {
    render(<UserForm returnTo="/admin/users" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Tên đăng nhập")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("after a successful add, goes to returnTo and refreshes", async () => {
    mocks.addUser.mockResolvedValue({});
    render(<UserForm returnTo="/admin/users?role=STAFF" />);
    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), { target: { value: "nhanvien01" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu Nhân Sự" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users?role=STAFF"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on page, shows error alert, retains username", async () => {
    mocks.addUser.mockResolvedValue({ error: "Ten dang nhap da ton tai" });
    render(<UserForm returnTo="/admin/users" />);
    fireEvent.change(screen.getByLabelText("Tên đăng nhập"), { target: { value: "nhanvien01" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu Nhân Sự" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ten dang nhap da ton tai"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Tên đăng nhập")).toHaveValue("nhanvien01");
  });

  it("Bỏ goes to returnTo without calling server action", () => {
    render(<UserForm returnTo="/admin/users?role=STAFF" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/users?role=STAFF");
    expect(mocks.addUser).not.toHaveBeenCalled();
  });
});
