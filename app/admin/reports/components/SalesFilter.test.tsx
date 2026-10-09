// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
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
  Element.prototype.scrollIntoView = vi.fn();
});

const TODAY = "2026-10-09";
const THIS_MONTH = { preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" } as const;

function pushed(): URLSearchParams {
  return new URLSearchParams(String(push.mock.calls[0][0]).replace(/^\?/, ""));
}

// BR-UI-007: the day boxes and the three day buttons give way to the shared
// time filter; a range applies at once and keeps brand, staff and category.
describe("SalesFilter time filter (BR-UI-007)", () => {
  it("shows the shared button and no loose day boxes or day buttons", () => {
    render(<SalesFilter brands={[]} users={[]} categories={[]} range={THIS_MONTH} today={TODAY} />);
    expect(screen.getByTestId("range-button")).toHaveTextContent("Tháng này · 01/10/2026 – 31/10/2026");
    expect(screen.queryByLabelText(/^Từ ngày/)).toBeNull();
    expect(screen.queryByLabelText(/^Đến ngày/)).toBeNull();
    expect(screen.queryByRole("button", { name: "7 ngày" })).toBeNull();
    expect(screen.queryByRole("button", { name: "30 ngày" })).toBeNull();
  });

  it("choosing Tháng trước applies at once and keeps brand, staff and category", () => {
    mockSearchParams.set("brandId", "B1");
    mockSearchParams.set("staffName", "An");
    mockSearchParams.set("categoryId", "CAT-DRINKS");
    render(<SalesFilter brands={[]} users={[]} categories={[]} range={THIS_MONTH} today={TODAY} />);
    fireEvent.click(screen.getByTestId("range-button"));
    fireEvent.click(within(screen.getByTestId("range-panel-desktop")).getByRole("button", { name: "Tháng trước" }));
    expect(push).toHaveBeenCalledTimes(1);
    const q = pushed();
    expect(q.get("range")).toBe("LAST_MONTH");
    expect(q.get("from")).toBeNull();
    expect(q.get("start")).toBeNull();
    expect(q.get("brandId")).toBe("B1");
    expect(q.get("staffName")).toBe("An");
    expect(q.get("categoryId")).toBe("CAT-DRINKS");
  });
});

// Final review: a range chosen after changing a box without "Lọc" used the
// address's brand, so the page showed another brand under a box reading MR.PHIN.
describe("SalesFilter range keeps the boxes on screen", () => {
  it("MR.PHIN chosen, no Lọc, then Hôm nay: the page opens on Hôm nay for MR.PHIN", () => {
    mockSearchParams.set("brandId", "BRD-2");
    render(
      <SalesFilter
        brands={[{ id: "BRD-1", name: "MR.PHIN", status: "ACTIVE" }, { id: "BRD-2", name: "Uchako", status: "ACTIVE" }]}
        users={[]}
        categories={[]}
        range={THIS_MONTH}
        today={TODAY}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Thương hiệu/), { target: { value: "BRD-1" } });
    fireEvent.click(screen.getByTestId("range-button"));
    fireEvent.click(within(screen.getByTestId("range-panel-desktop")).getByRole("button", { name: "Hôm nay" }));
    const q = pushed();
    expect(q.get("range")).toBe("TODAY");
    expect(q.get("brandId")).toBe("BRD-1");
  });

  it("a box set back to Tất cả is dropped from the address", () => {
    mockSearchParams.set("brandId", "BRD-2");
    render(
      <SalesFilter brands={[{ id: "BRD-2", name: "Uchako", status: "ACTIVE" }]} users={[]} categories={[]} range={THIS_MONTH} today={TODAY} />,
    );
    fireEvent.change(screen.getByLabelText(/^Thương hiệu/), { target: { value: "" } });
    fireEvent.click(screen.getByTestId("range-button"));
    fireEvent.click(within(screen.getByTestId("range-panel-desktop")).getByRole("button", { name: "Hôm nay" }));
    expect(pushed().get("brandId")).toBeNull();
  });
});

// Wave K5 (plan Review Focus 5): the brand box is the shared Select inside
// Field. Choosing a brand then "Lọc" keeps the range on the address.
describe("SalesFilter brand box (wave K5)", () => {
  it("choosing MR.PHIN then Lọc pushes brandId with the same range", () => {
    mockSearchParams.set("range", "CUSTOM");
    mockSearchParams.set("from", "2026-09-01");
    mockSearchParams.set("to", "2026-09-15");
    render(
      <SalesFilter
        brands={[{ id: "BRD-1", name: "MR.PHIN", status: "ACTIVE" }]}
        users={[]}
        categories={[]}
        range={{ preset: "CUSTOM", start: "2026-09-01", end: "2026-09-15" }}
        today={TODAY}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Thương hiệu/), { target: { value: "BRD-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    const q = pushed();
    expect(q.get("range")).toBe("CUSTOM");
    expect(q.get("from")).toBe("2026-09-01");
    expect(q.get("to")).toBe("2026-09-15");
    expect(q.get("brandId")).toBe("BRD-1");
  });
});
