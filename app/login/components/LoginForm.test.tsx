// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import LoginForm from "./LoginForm";
import { signIn, getSession } from "next-auth/react";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  getSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

function submitCredentials(username = "nhanvien01", password = "secretpassword") {
  const usernameInput = screen.getByLabelText("Tên đăng nhập");
  const passwordInput = screen.getByLabelText("Mật khẩu");
  const submitButton = screen.getByRole("button", { name: "Đăng nhập" });

  fireEvent.change(usernameInput, { target: { value: username } });
  fireEvent.change(passwordInput, { target: { value: password } });
  fireEvent.click(submitButton);
}

describe("LoginForm", () => {
  it("wrong password shows the Vietnamese message, never raw CredentialsSignin", async () => {
    (signIn as any).mockResolvedValueOnce({
      error: "CredentialsSignin",
      ok: false,
    });

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials("admin", "wrongpassword");

    await waitFor(() => {
      expect(screen.getByText("Sai tên đăng nhập hoặc mật khẩu")).toBeInTheDocument();
    });
    expect(screen.queryByText("CredentialsSignin")).toBeNull();
  });

  it("callbackUrl=/admin/inventory goes there", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "ADMIN" },
    });
    mockSearchParams = new URLSearchParams("callbackUrl=/admin/inventory");

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/inventory");
    });
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("callbackUrl=//evil.com falls back to default route", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "ADMIN" },
    });
    mockSearchParams = new URLSearchParams("callbackUrl=//evil.com");

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
    expect(mockPush).not.toHaveBeenCalledWith("//evil.com");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("callbackUrl=/\\evil.com falls back to default route", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "ADMIN" },
    });
    mockSearchParams = new URLSearchParams("callbackUrl=/\\evil.com");

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
    expect(mockPush).not.toHaveBeenCalledWith("/\\evil.com");
  });

  it("callbackUrl=/%09/evil.com falls back to default route", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "ADMIN" },
    });
    mockSearchParams = new URLSearchParams("callbackUrl=/%09/evil.com");

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining("evil.com"));
  });

  it("callbackUrl=https://evil.com falls back to default route", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "ADMIN" },
    });
    mockSearchParams = new URLSearchParams("callbackUrl=https://evil.com");

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
    expect(mockPush).not.toHaveBeenCalledWith("https://evil.com");
  });

  it("callbackUrl=/admin/inventory?x=1 passes", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "ADMIN" },
    });
    mockSearchParams = new URLSearchParams("callbackUrl=/admin/inventory?x=1");

    render(<LoginForm title="Đăng nhập" />);

    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin/inventory?x=1");
    });
  });

  it("without callbackUrl: STAFF goes to /pos, other roles go to /admin", async () => {
    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "STAFF" },
    });

    const { unmount } = render(<LoginForm title="Đăng nhập" />);
    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/pos");
    });

    unmount();
    mockPush.mockClear();

    (signIn as any).mockResolvedValueOnce({ ok: true, error: null });
    (getSession as any).mockResolvedValueOnce({
      user: { role: "MANAGER" },
    });

    render(<LoginForm title="Đăng nhập" />);
    submitCredentials();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/admin");
    });
  });

  it("removes English footer lines and shows title from prop with no hard-coded brand", () => {
    render(<LoginForm title="Thương hiệu Mới" />);

    expect(screen.getByText("Thương hiệu Mới")).toBeInTheDocument();
    expect(screen.queryByText(/Hệ thống Quản lý F&B/)).toBeNull();
    expect(screen.queryByText(/Powered by Next\.js/)).toBeNull();
    expect(screen.queryByText(/Phin Đi/)).toBeNull();
  });
});
