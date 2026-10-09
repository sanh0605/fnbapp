// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const { push, current } = vi.hoisted(() => ({ push: vi.fn(), current: { search: "" } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(current.search),
}));

import { DateRangeUrlButton } from "./DateRangeUrlButton";

beforeAll(() => {
  if (typeof window.matchMedia !== "function") {
    window.matchMedia = ((query: string) => ({
      matches: false, media: query, onchange: null,
      addListener: () => {}, removeListener: () => {},
      addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  }
  Element.prototype.scrollIntoView = vi.fn();
});
beforeEach(() => push.mockReset());
afterEach(cleanup);

function pushedUrl(): URL {
  return new URL(push.mock.calls[0][0], "http://x");
}

// BR-UI-007: a server page (Tổng quan, Lãi lỗ) shows the shared button; a
// choice rewrites the address and keeps every other filter.
describe("DateRangeUrlButton", () => {
  it("shows the range it is given", () => {
    render(<DateRangeUrlButton value={{ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" }} today="2026-10-09" />);
    expect(screen.getByTestId("range-button")).toHaveTextContent("Tháng này · 01/10/2026 – 31/10/2026");
  });

  it("Hôm nay writes range=TODAY, drops old from/to and page, keeps other params", () => {
    current.search = "range=CUSTOM&from=2026-09-01&to=2026-09-05&page=3&brandId=B1";
    render(<DateRangeUrlButton value={{ preset: "CUSTOM", start: "2026-09-01", end: "2026-09-05" }} today="2026-10-09" />);
    fireEvent.click(screen.getByTestId("range-button"));
    fireEvent.click(within(screen.getByTestId("range-panel-desktop")).getByRole("button", { name: "Hôm nay" }));
    expect(push).toHaveBeenCalledTimes(1);
    const url = pushedUrl();
    expect(url.pathname).toBe("/admin");
    expect(url.searchParams.get("range")).toBe("TODAY");
    expect(url.searchParams.get("from")).toBeNull();
    expect(url.searchParams.get("to")).toBeNull();
    expect(url.searchParams.get("page")).toBeNull();
    expect(url.searchParams.get("brandId")).toBe("B1");
  });

  // Final review: on Tổng quan and Lãi lỗ the button sits at the right end of
  // the page header; a panel anchored at its left edge ran ~450px off screen.
  it("the computer panel is anchored to the button's right edge", () => {
    current.search = "";
    render(<DateRangeUrlButton value={{ preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" }} today="2026-10-09" />);
    fireEvent.click(screen.getByTestId("range-button"));
    const panel = screen.getByTestId("range-panel-desktop");
    expect(panel).toHaveClass("right-0");
    expect(panel).not.toHaveClass("left-0");
  });

  it("month mode: Năm trước writes range=LAST_YEAR and drops an old year=", () => {
    current.search = "year=2025";
    render(<DateRangeUrlButton mode="month" value={{ preset: "CUSTOM", start: "2025-01", end: "2025-12" }} today="2026-10-09" />);
    fireEvent.click(screen.getByTestId("range-button"));
    fireEvent.click(within(screen.getByTestId("range-panel-desktop")).getByRole("button", { name: "Năm trước" }));
    const url = pushedUrl();
    expect(url.searchParams.get("range")).toBe("LAST_YEAR");
    expect(url.searchParams.get("year")).toBeNull();
  });
});
