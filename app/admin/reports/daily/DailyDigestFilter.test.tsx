// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { DailyDigestFilter } from "./DailyDigestFilter";

// that component calls window.matchMedia in a mount effect, which jsdom
// does not implement. Same stub as components/ProductForm.test.tsx.
if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const { push, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  return { push: pushFn, router: { push: pushFn } };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  push.mockClear();
});

describe("DailyDigestFilter", () => {
  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));

    render(<DailyDigestFilter date="2026-09-15" />);
    expect(screen.getByText("Tổng kết ngày")).toBeInTheDocument();
  });
});
