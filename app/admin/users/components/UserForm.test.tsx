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

// Wave K6 (plan Review Focus 2): the boxes move to the shared templates; the
// password stays hidden and the role posts the same code as today.
describe("UserForm boxes (wave K6)", () => {
  it("the password box hides what is typed; Quản lý posts role=MANAGER with the typed name and password", async () => {
    mocks.addUser.mockResolvedValue({});
    render(<UserForm returnTo="/admin/users" />);
    const password = screen.getByLabelText(/^Mật khẩu/) as HTMLInputElement;
    expect(password.type).toBe("password");
    fireEvent.change(screen.getByLabelText(/^Tên nhân viên/), { target: { value: "Nguyễn Văn An" } });
    fireEvent.change(screen.getByLabelText(/^Tên đăng nhập/), { target: { value: "nhanvien02" } });
    fireEvent.change(password, { target: { value: "matkhau1" } });
    fireEvent.change(screen.getByLabelText(/^Quyền hạn/), { target: { value: "MANAGER" } });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(mocks.addUser).toHaveBeenCalledTimes(1));
    const formData = mocks.addUser.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Nguyễn Văn An");
    expect(formData.get("username")).toBe("nhanvien02");
    expect(formData.get("password")).toBe("matkhau1");
    expect(formData.get("role")).toBe("MANAGER");
  });
});

describe("UserForm", () => {
  it("renders on the page and immediately shows the name and username inputs and Tạo/Bỏ buttons, with Vietnamese-only role options", () => {
    render(<UserForm returnTo="/admin/users" />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const nameInput = screen.getByLabelText(/^Tên nhân viên( \*)?$/);
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute("maxLength", "60");
    expect(nameInput).toHaveAttribute("placeholder", "Ví dụ: Nguyễn Văn An");
    expect(screen.getByLabelText(/^Tên đăng nhập( \*)?$/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản lý" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản trị viên" })).toBeInTheDocument();
    expect(screen.queryByText(/STAFF/)).toBeNull();
    expect(screen.queryByText(/MANAGER/)).toBeNull();
    expect(screen.queryByText(/ADMIN/)).toBeNull();
  });

  it("the create form sends name", async () => {
    mocks.addUser.mockResolvedValue({});
    render(<UserForm returnTo="/admin/users" />);
    fireEvent.change(screen.getByLabelText(/^Tên nhân viên( \*)?$/), { target: { value: "Trần Thị Bích" } });
    fireEvent.change(screen.getByLabelText(/^Tên đăng nhập( \*)?$/), { target: { value: "bich01" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu( \*)?$/), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
    await waitFor(() => expect(mocks.addUser).toHaveBeenCalledTimes(1));
    const formData = mocks.addUser.mock.calls[0][0] as FormData;
    expect(formData.get("name")).toBe("Trần Thị Bích");
  });

  it("with canGrantAdmin false, the ADMIN option is absent and only STAFF and MANAGER are present", () => {
    render(<UserForm returnTo="/admin/users" canGrantAdmin={false} />);
    expect(screen.getByRole("option", { name: "Nhân viên" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Quản lý" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Quản trị viên" })).toBeNull();
  });

  it("with canGrantAdmin true, the ADMIN option is present", () => {
    render(<UserForm returnTo="/admin/users" canGrantAdmin={true} />);
    expect(screen.getByRole("option", { name: "Quản trị viên" })).toBeInTheDocument();
  });

  it("after a successful add, goes to returnTo and refreshes", async () => {
    mocks.addUser.mockResolvedValue({});
    render(<UserForm returnTo="/admin/users?role=STAFF" />);
    fireEvent.change(screen.getByLabelText(/^Tên nhân viên( \*)?$/), { target: { value: "Nguyễn Văn An" } });
    fireEvent.change(screen.getByLabelText(/^Tên đăng nhập( \*)?$/), { target: { value: "nhanvien01" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu( \*)?$/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/users?role=STAFF"));
    expect(refresh).toHaveBeenCalled();
  });

  it("on error stays on page, shows error alert, retains username and name", async () => {
    mocks.addUser.mockResolvedValue({ error: "Ten dang nhap da ton tai" });
    render(<UserForm returnTo="/admin/users" />);
    fireEvent.change(screen.getByLabelText(/^Tên nhân viên( \*)?$/), { target: { value: "Nguyễn Văn An" } });
    fireEvent.change(screen.getByLabelText(/^Tên đăng nhập( \*)?$/), { target: { value: "nhanvien01" } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu( \*)?$/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ten dang nhap da ton tai"));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Tên nhân viên( \*)?$/)).toHaveValue("Nguyễn Văn An");
    expect(screen.getByLabelText(/^Tên đăng nhập( \*)?$/)).toHaveValue("nhanvien01");
  });

  it("Bỏ goes to returnTo without calling server action", () => {
    render(<UserForm returnTo="/admin/users?role=STAFF" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/users?role=STAFF");
    expect(mocks.addUser).not.toHaveBeenCalled();
  });
});
