// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import ChangePasswordPage from "./page";

const mocks = vi.hoisted(() => ({
  changePasswordAction: vi.fn(),
  sessionData: { user: { name: "admin", role: "ADMIN" } } as any,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/actions/auth", () => ({ changePasswordAction: mocks.changePasswordAction }));
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.sessionData, status: "authenticated" }),
}));

afterEach(() => cleanup());
beforeEach(() => {
  mocks.changePasswordAction.mockReset();
  mocks.changePasswordAction.mockResolvedValue({ success: true });
  mocks.sessionData = { user: { name: "admin", role: "ADMIN" } };
});

// Wave K6 (plan Review Focus 5): the page moves onto the shared templates; the
// checks before sending and what is sent stay as they are.
describe("Đổi mật khẩu", () => {
  function fill(oldPw: string, newPw: string, confirmPw: string) {
    fireEvent.change(screen.getByLabelText(/^Mật khẩu cũ( \*)?$/), { target: { value: oldPw } });
    fireEvent.change(screen.getByLabelText(/^Mật khẩu mới( \*)?$/), { target: { value: newPw } });
    fireEvent.change(screen.getByLabelText(/^Xác nhận mật khẩu mới( \*)?$/), { target: { value: confirmPw } });
    fireEvent.submit(document.querySelector("form")!);
  }

  it("the three boxes hide what is typed", () => {
    render(<ChangePasswordPage />);
    for (const label of [/^Mật khẩu cũ( \*)?$/, /^Mật khẩu mới( \*)?$/, /^Xác nhận mật khẩu mới( \*)?$/]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).type).toBe("password");
    }
  });

  it("a confirmation that does not match is said and nothing is sent", () => {
    render(<ChangePasswordPage />);
    fill("abc123", "newpass1", "newpass2");
    expect(screen.getByText("Mật khẩu xác nhận không khớp")).toBeInTheDocument();
    expect(mocks.changePasswordAction).not.toHaveBeenCalled();
  });

  it("a new password under 6 characters is said and nothing is sent", () => {
    render(<ChangePasswordPage />);
    fill("abc123", "abc", "abc");
    expect(screen.getByText("Mật khẩu mới phải có ít nhất 6 ký tự")).toBeInTheDocument();
    expect(mocks.changePasswordAction).not.toHaveBeenCalled();
  });

  it("abc123 / newpass1 / newpass1 sends exactly the old and new password", async () => {
    render(<ChangePasswordPage />);
    fill("abc123", "newpass1", "newpass1");
    await waitFor(() => expect(mocks.changePasswordAction).toHaveBeenCalledWith("abc123", "newpass1"));
    expect(await screen.findByText("Đổi mật khẩu thành công!")).toBeInTheDocument();
  });

  it("renders back link to /admin for non-staff role", () => {
    mocks.sessionData = { user: { name: "admin", role: "ADMIN" } };
    render(<ChangePasswordPage />);
    const backLink = screen.getByRole("link", { name: /Về trang quản trị/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/admin");
  });

  it("renders back link to /pos for STAFF role", () => {
    mocks.sessionData = { user: { name: "staff1", role: "STAFF" } };
    render(<ChangePasswordPage />);
    const backLink = screen.getByRole("link", { name: /Về máy bán hàng/ });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/pos");
  });
});
