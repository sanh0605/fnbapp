// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import SalesFilter from "./SalesFilter";

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

const { push, router, mockSearchParams } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const searchMap = new Map<string, string>();
  return {
    push: pushFn,
    router: { push: pushFn },
    mockSearchParams: searchMap,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
    toString: () => {
      const params = new URLSearchParams();
      mockSearchParams.forEach((v, k) => params.set(k, v));
      return params.toString();
    },
  }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  push.mockClear();
  mockSearchParams.clear();
});

describe("SalesFilter", () => {
  it("default start shows/pushes 2026-09-01 and end 2026-09-15; preset 7 days → 2026-09-08..2026-09-15", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z")); // Saigon: 2026-09-15 06:30:00

    render(<SalesFilter brands={[]} users={[]} categories={[]} />);

    // Click "Lọc" with default dates
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    expect(push).toHaveBeenCalledWith("?start=2026-09-01&end=2026-09-15");

    push.mockClear();

    // Click "7 ngày" preset button
    fireEvent.click(screen.getByRole("button", { name: "7 ngày" }));
    expect(push).toHaveBeenCalledWith("?start=2026-09-08&end=2026-09-15");
  });
});
