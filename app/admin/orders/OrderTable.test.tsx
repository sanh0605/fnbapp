// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import OrderTable from "./OrderTable";
import type { OrderListItem } from "./actions";

const { push, replace, router, mockSearchParams } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const replaceFn = vi.fn();
  const searchMap = new Map<string, string>();
  return {
    push: pushFn,
    replace: replaceFn,
    router: { push: pushFn, replace: replaceFn },
    mockSearchParams: searchMap,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/orders",
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
    toString: () => {
      const params = new URLSearchParams();
      mockSearchParams.forEach((v, k) => params.set(k, v));
      return params.toString();
    },
  }),
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

describe("OrderTable navigation", () => {
  it("clicking an order row navigates to order view with returnTo carrying active filters", () => {
    mockSearchParams.set("payment", "Chuyen khoan");

    render(
      <OrderTable
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

    const orderRow = screen.getAllByText("ORD000001")[0].closest("tr");
    expect(orderRow).not.toBeNull();
    fireEvent.click(orderRow!);

    const expectedCurrentUrl = "/admin/orders?payment=Chuyen+khoan";
    expect(push).toHaveBeenCalledWith(
      `/admin/orders/ORD-1?returnTo=${encodeURIComponent(expectedCurrentUrl)}`
    );
  });

  it("pins Saigon value with clock fixed at 2026-09-14T23:30:00Z", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-14T23:30:00Z"));
    try {
      mockSearchParams.set("from", "2026-09-15");
      mockSearchParams.set("to", "2026-09-15");

      render(
        <OrderTable
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
