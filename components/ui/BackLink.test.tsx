// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackLink } from "./BackLink";
import { DetailHeader } from "./detail/DetailHeader";
import { LAST_URL_PREFIX } from "./AdminRouteMemory";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

import { useRouter } from "next/navigation";

describe("BackLink", () => {
  const mockBack = vi.fn();
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      back: mockBack,
      push: mockPush,
      refresh: vi.fn(),
    });
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it("renders correctly with label and href", () => {
    render(<BackLink href="/test" label="Quay lại" />);
    expect(screen.getByText("← Quay lại")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/test");
  });

  it("never calls router.back on click even if history length > 1", () => {
    Object.defineProperty(window, "history", {
      value: { length: 10 },
      writable: true,
    });
    render(<BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />);
    fireEvent.click(screen.getByRole("link"));
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("pushes the remembered URL (with its ?query) when present in sessionStorage", () => {
    sessionStorage.setItem(
      LAST_URL_PREFIX + "/admin/inventory/purchase-orders",
      "/admin/inventory/purchase-orders?status=COMPLETED&page=2"
    );

    render(<BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />);
    const link = screen.getByRole("link");
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(mockPush).toHaveBeenCalledWith("/admin/inventory/purchase-orders?status=COMPLETED&page=2");
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("falls back to href when nothing is remembered in sessionStorage", () => {
    render(<BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />);
    const link = screen.getByRole("link");
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("falls back to href when sessionStorage throws", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: Access to sessionStorage denied");
    });

    render(<BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />);
    const link = screen.getByRole("link");
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();

    getItemSpy.mockRestore();
  });

  it("a modifier-click does not preventDefault and does not push", () => {
    sessionStorage.setItem(
      LAST_URL_PREFIX + "/admin/inventory/purchase-orders",
      "/admin/inventory/purchase-orders?status=COMPLETED"
    );

    render(<BackLink href="/admin/inventory/purchase-orders" label="Phiếu nhập" />);
    const link = screen.getByRole("link");

    // Ctrl-click
    const ctrlClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    });
    link.dispatchEvent(ctrlClick);
    expect(ctrlClick.defaultPrevented).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();

    // Meta-click (Cmd-click on Mac)
    const metaClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    link.dispatchEvent(metaClick);
    expect(metaClick.defaultPrevented).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();

    // Shift-click
    const shiftClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      shiftKey: true,
    });
    link.dispatchEvent(shiftClick);
    expect(shiftClick.defaultPrevented).toBe(false);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("DetailHeader back link pushes remembered URL when present", () => {
    sessionStorage.setItem(
      LAST_URL_PREFIX + "/admin/inventory/purchase-orders",
      "/admin/inventory/purchase-orders?q=test"
    );

    render(
      <DetailHeader
        backHref="/admin/inventory/purchase-orders"
        backLabel="Phiếu nhập"
        title="PO-001"
      />
    );

    const link = screen.getByRole("link", { name: /Phiếu nhập/ });
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    link.dispatchEvent(clickEvent);

    expect(clickEvent.defaultPrevented).toBe(true);
    expect(mockPush).toHaveBeenCalledWith("/admin/inventory/purchase-orders?q=test");
    expect(mockBack).not.toHaveBeenCalled();
  });
});
