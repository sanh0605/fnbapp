// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DateRangeFilter } from "./DateRangeFilter";

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

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DateRangeFilter", () => {
  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));

    const onChange = vi.fn();
    render(
      <DateRangeFilter
        value={{ preset: "CUSTOM", start: "2026-09-01", end: "2026-09-15" }}
        onChange={onChange}
        today="2026-09-15"
      />
    );

    expect(screen.getByText("01/09/2026 – 15/09/2026")).toBeInTheDocument();
  });

  it("handles preset selection based on Saigon today", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));

    const onChange = vi.fn();
    render(
      <DateRangeFilter
        value={{ preset: "TODAY", start: "2026-09-15", end: "2026-09-15" }}
        onChange={onChange}
        today="2026-09-15"
      />
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "LAST_7_DAYS" } });

    expect(onChange).toHaveBeenCalledWith({
      preset: "LAST_7_DAYS",
      start: "2026-09-08",
      end: "2026-09-14",
    });
  });
});
