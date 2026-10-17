// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import IssueSlipsClient from "./IssueSlipsClient";
import type { IssueSlipListPage } from "@/lib/stock/issue-slip-list";

const { replace, router, state } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  return { replace: replaceFn, router: { replace: replaceFn, push: replaceFn }, state: { params: new URLSearchParams() } };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/inventory/issue-slips",
  useSearchParams: () => state.params,
  useRouter: () => router,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

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
beforeEach(() => {
  replace.mockClear();
  state.params = new URLSearchParams();
});
afterEach(cleanup);

const empty: IssueSlipListPage = { rows: [], total: 0, page: 1, pageCount: 1, firstIndex: 0, lastIndex: 0, rangeError: false, people: ["admin"], personLabel: null, totals: { count: 0, value: 0 } };
const THIS_MONTH = { preset: "THIS_MONTH" as const, start: "2026-10-01", end: "2026-10-31" };
const base = { pageData: empty, range: THIS_MONTH, today: "2026-10-09", searching: false };

// The last URL the client navigated to, whichever router call it used.
function lastUrl(): URL {
  const calls = replace.mock.calls;
  return new URL(calls[calls.length - 1][0], "http://x");
}

describe("IssueSlipsClient time filter (BR-UI-007)", () => {
  it("shows the shared button on Tháng này and no loose day boxes", () => {
    render(<IssueSlipsClient {...base} />);
    expect(screen.getByTestId("range-button")).toHaveTextContent("Tháng này · 01/10/2026 – 31/10/2026");
    expect(screen.queryByLabelText("Từ ngày")).toBeNull();
    expect(screen.queryByLabelText("Đến ngày")).toBeNull();
  });

  it("an empty month names the range it looked in", () => {
    render(<IssueSlipsClient {...base} />);
    expect(screen.getByText("Không có phiếu nào trong Tháng này (01/10/2026 – 31/10/2026)")).toBeInTheDocument();
  });

  it("while searching: the button is off, the hint shows, and an empty result says every day was searched", () => {
    state.params = new URLSearchParams("q=ISL-99999");
    render(<IssueSlipsClient {...base} searching />);
    expect(screen.getByTestId("range-button")).toBeDisabled();
    expect(screen.getByText("Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày")).toBeInTheDocument();
    expect(screen.getByText("Không tìm thấy phiếu nào trên mọi ngày")).toBeInTheDocument();
  });

  it("choosing Tháng trước writes range=LAST_MONTH, keeps the other filters, back to page 1", () => {
    state.params = new URLSearchParams("kind=MANUAL&page=4");
    render(<IssueSlipsClient {...base} />);
    fireEvent.click(screen.getByTestId("range-button"));
    fireEvent.click(within(screen.getByTestId("range-panel-desktop")).getByRole("button", { name: "Tháng trước" }));
    const url = lastUrl();
    expect(url.searchParams.get("range")).toBe("LAST_MONTH");
    expect(url.searchParams.get("kind")).toBe("MANUAL");
    expect(url.searchParams.get("page") ?? "1").toBe("1");
    expect(url.searchParams.has("from")).toBe(false);
  });

  it("Xoá lọc goes back to the bare list: no range, kind, person or search", () => {
    state.params = new URLSearchParams("q=sữa&kind=MANUAL&range=LAST_MONTH");
    render(<IssueSlipsClient {...base} range={{ preset: "LAST_MONTH", start: "2026-09-01", end: "2026-09-30" }} searching />);
    fireEvent.click(screen.getAllByRole("button", { name: "Xoá lọc" })[0]);
    const url = lastUrl();
    for (const key of ["range", "from", "to", "kind", "person", "q"]) {
      expect(url.searchParams.get(key) ?? "").toMatch(/^$|^ALL$/);
    }
  });
});
