// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackLink } from "./BackLink";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

import { useRouter } from "next/navigation";

describe("BackLink", () => {
  const mockBack = vi.fn();
  
  const originalHistory = window.history;

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "history", {
      value: originalHistory,
      writable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({
      back: mockBack,
      push: vi.fn(),
      refresh: vi.fn(),
    });
    // Default history length mock
    Object.defineProperty(window, "history", {
      value: { length: 2 },
      writable: true,
    });
  });

  it("renders correctly with label", () => {
    render(<BackLink href="/test" label="Quay lại" />);
    expect(screen.getByText("← Quay lại")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/test");
  });

  it("calls router.back when window.history.length > 1", () => {
    render(<BackLink href="/test" label="Quay lại" />);
    fireEvent.click(screen.getByRole("link"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("does not call router.back when window.history.length <= 1", () => {
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
    });
    render(<BackLink href="/test" label="Quay lại" />);
    fireEvent.click(screen.getByRole("link"));
    expect(mockBack).not.toHaveBeenCalled();
  });
});
