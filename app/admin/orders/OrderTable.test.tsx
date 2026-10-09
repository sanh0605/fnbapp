// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import OrderTable from "./OrderTable";
import type { OrderListItem } from "./actions";

// BR-UI-007: the list now takes its range from the page.
const TEST_TODAY = "2026-10-09";
const TEST_RANGE = { preset: "THIS_MONTH", start: "2026-10-01", end: "2026-10-31" } as const;

const { push, replace, router, mockSearchParams, searchParamsObject } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const replaceFn = vi.fn();
  const searchMap = new Map<string, string>();
  // One object for the whole render, as Next.js returns the same instance
  // until the URL changes; a fresh object per render would re-run every
  // effect keyed on it.
  const paramsObject = {
    get: (key: string) => searchMap.get(key) || null,
    toString: () => {
      const params = new URLSearchParams();
      searchMap.forEach((v, k) => params.set(k, v));
      return params.toString();
    },
  };
  return {
    push: pushFn,
    replace: replaceFn,
    router: { push: pushFn, replace: replaceFn },
    mockSearchParams: searchMap,
    searchParamsObject: paramsObject,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/orders",
  useSearchParams: () => searchParamsObject,
}));

vi.mock("./components/VoidOrderButton", () => ({
  VoidOrderButton: () => <button>Hủy đơn</button>,
}));

vi.mock("@/components/ui/CustomDatePicker", () => ({
  CustomDatePicker: () => <input data-testid="date-picker" />,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
  mockSearchParams.clear();
});

function makeOrder(id: string, orderNo: string): OrderListItem {
  return {
    id,
    order_no: `#${orderNo}`,
    display_order_no: `ORD${orderNo}`,
    brand_id: "BRD-1",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    gross_total: 60000,
    promo_discount_total: 0,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 60000,
    method: "Chuyen khoan",
    created_by_name: "Thu ngân 1",
    created_at: "2026-10-01T12:00:00.000Z",
    lines: [
      {
        id: `line-${id}`,
        order_id: id,
        line_no: 1,
        product_id: "PROD-1",
        product_snapshot_json: "{}",
        variant_id: "VAR-1",
        variant_snapshot_json: "{}",
        qty: 1,
        unit_price: 60000,
        modifiers_snapshot_json: "[]",
        gross_line_total: 60000,
        promo_discount: 0,
        manual_item_discount: 0,
        order_discount_allocation: 0,
        net_line_total: 60000,
        cost_at_sale: 0,
        recipe_snapshot_json: "{}",
        promo_discount_reason: "",
        manual_discount_reason: "",
        product_name: "Trà đào",
        size_name: "L",
        modifiers: [],
      },
    ],
  };
}

describe("OrderTable buttons (BR-UI-005, spec 2.1)", () => {
  it('"Xóa bộ lọc" only clears the filters, so it wears the Phụ look, not the red delete outline', () => {
    mockSearchParams.set("payment", "Chuyen khoan");
    render(
      <OrderTable range={TEST_RANGE} today={TEST_TODAY}
        initialOrders={[makeOrder("ORD-1", "000001")]}
        totalCount={1}
        itemsPerPage={20}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
      />
    );
    const classes = screen.getByRole("button", { name: "Xóa bộ lọc" }).className.split(/\s+/);
    expect(classes).toContain("border-border");
    expect(classes).not.toContain("text-danger");
  });
});

describe("OrderTable navigation", () => {
  it("clicking an order row navigates to order view with returnTo carrying active filters", () => {
    mockSearchParams.set("payment", "Chuyen khoan");

    render(
      <OrderTable range={TEST_RANGE} today={TEST_TODAY}
        initialOrders={[makeOrder("ORD-1", "000001")]}
        totalCount={1}
        itemsPerPage={20}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
      />
    );

    // Wave K4: the row opens through the shared list's link (DataList), on
    // desktop and phone alike, instead of a click handler on the <tr>.
    const expectedCurrentUrl = "/admin/orders?payment=Chuyen+khoan";
    const expected = `/admin/orders/ORD-1?returnTo=${encodeURIComponent(expectedCurrentUrl)}`;
    const links = screen.getAllByRole("link").filter((a) => a.getAttribute("href") === expected);
    expect(links.length).toBeGreaterThan(0);
  });

  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      mockSearchParams.set("from", "2026-09-15");
      mockSearchParams.set("to", "2026-09-15");

      render(
        <OrderTable range={TEST_RANGE} today={TEST_TODAY}
          initialOrders={[makeOrder("ORD-1", "000001")]}
          totalCount={1}
          itemsPerPage={20}
          brands={[]}
          products={[]}
          variants={[]}
          modifiers={[]}
          categories={[]}
        />
      );

      expect(screen.getAllByText("ORD000001")[0]).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

// Wave K4 (BR-UI-003, BR-UI-005, BR-DATA-007): the list wears the Table set;
// an order is cancelled from its own page (owner 2026-10-05), so no row
// carries a cancel button; the phone shows one card per order.
describe("OrderTable -- shared table (wave K4)", () => {
  const renderList = () =>
    render(
      <OrderTable range={TEST_RANGE} today={TEST_TODAY}
        initialOrders={[makeOrder("ORD-1", "000001"), makeOrder("ORD-2", "000002")]}
        totalCount={2}
        itemsPerPage={20}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
      />
    );

  it("no row carries a cancel button", () => {
    renderList();
    expect(screen.queryByRole("button", { name: "Hủy đơn" })).toBeNull();
  });

  it("the phone list shows one card per order", () => {
    const { container } = renderList();
    const phone = container.querySelector(".md\\:hidden");
    expect(phone).not.toBeNull();
    expect(phone!.textContent).toContain("ORD000001");
    expect(phone!.textContent).toContain("ORD000002");
  });
});
