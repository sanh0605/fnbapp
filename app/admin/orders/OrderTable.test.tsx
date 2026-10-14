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
  VoidOrderButton: () => <button>Huỷ đơn</button>,
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

function makeOrder(
  id: string,
  orderNo: string,
  overrides?: Partial<OrderListItem>
): OrderListItem {
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
    payments: [],
    ...overrides,
  };
}

describe("OrderTable buttons (BR-UI-005, spec 2.1)", () => {
  it('"Xoá bộ lọc" only clears the filters, so it wears the Phụ look, not the red delete outline', () => {
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
    const classes = screen.getByRole("button", { name: "Xoá bộ lọc" }).className.split(/\s+/);
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
    expect(screen.queryByRole("button", { name: "Huỷ đơn" })).toBeNull();
  });

  it("the phone list shows one card per order", () => {
    const { container } = renderList();
    const phone = container.querySelector(".md\\:hidden");
    expect(phone).not.toBeNull();
    expect(phone!.textContent).toContain("ORD000001");
    expect(phone!.textContent).toContain("ORD000002");
  });

  // BR-UI-004: total of every order the filter matches, across all pages;
  // voided orders and old versions are left out.
  it("shows the filter's total under the Khách trả header", () => {
    render(
      <OrderTable range={TEST_RANGE} today={TEST_TODAY}
        initialOrders={[makeOrder("ORD-1", "000001")]}
        totalCount={21}
        totals={{ count: 21, netTotal: 1234000 }}
        itemsPerPage={20}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
      />
    );
    expect(screen.getAllByText("Tổng (không tính huỷ)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1,234,000").length).toBeGreaterThan(0);
  });
});

describe("OrderTable payment method display (BR-SALE-013, owner 2026-10-14 C12)", () => {
  it("shows 'Tiền mặt + Chuyển khoản' in neutral badge on desktop and phone when payments has two or more entries", () => {
    const twoPartOrder = makeOrder("ORD-MULTI", "000002", {
      method: "Tien mat",
      payments: [
        { method: "CASH", amount: 9000 },
        { method: "BANK_TRANSFER", amount: 9000 },
      ],
    });

    const { container } = render(
      <OrderTable
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialOrders={[twoPartOrder]}
        totalCount={1}
        itemsPerPage={20}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
      />
    );

    // Desktop table column
    const desktopTable = container.querySelector(".hidden.md\\:block");
    expect(desktopTable).not.toBeNull();
    expect(desktopTable!.textContent).toContain("Tiền mặt + Chuyển khoản");

    // Phone card
    const phoneList = container.querySelector(".md\\:hidden");
    expect(phoneList).not.toBeNull();
    expect(phoneList!.textContent).toContain("Tiền mặt + Chuyển khoản");

    // Both badges are rendered
    const badges = screen.getAllByText("Tiền mặt + Chuyển khoản");
    expect(badges.length).toBe(2);
  });

  it("still shows only 'Tiền mặt' (or 'Chuyển khoản') when payments has one entry or is undefined", () => {
    const singleCash = makeOrder("ORD-CASH", "000003", {
      method: "Tien mat",
      payments: [{ method: "CASH", amount: 60000 }],
    });
    const singleTransfer = makeOrder("ORD-XFER", "000004", {
      method: "Chuyen khoan",
    });

    render(
      <OrderTable
        range={TEST_RANGE}
        today={TEST_TODAY}
        initialOrders={[singleCash, singleTransfer]}
        totalCount={2}
        itemsPerPage={20}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
      />
    );

    expect(screen.queryByText("Tiền mặt + Chuyển khoản")).toBeNull();
    expect(screen.getAllByText("Tiền mặt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Chuyển khoản").length).toBeGreaterThan(0);
  });
});

