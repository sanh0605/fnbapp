// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { OrderDetailView } from "./OrderDetailView";
import type { OrderDetailV2Result } from "@/app/admin/orders/actions";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

function makeDetail(status: string = "COMPLETED"): OrderDetailV2Result {
  return {
    order: {
      id: "ORD-1",
      order_no: "#1",
      display_order_no: "ORD000001",
      brand_id: "BRD-1",
      status,
      version: 1,
      parent_order_id: "",
      gross_total: 50000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 50000,
      method: "Tien mat",
      created_by_name: "Thu ngân 1",
      created_at: "2026-10-01T10:00:00.000Z",
      lines: [
        {
          id: "line-1",
          order_id: "ORD-1",
          line_no: 1,
          product_id: "PROD-1",
          product_snapshot_json: "{}",
          variant_id: "VAR-1",
          variant_snapshot_json: "{}",
          qty: 1,
          unit_price: 50000,
          modifiers_snapshot_json: "[]",
          gross_line_total: 50000,
          promo_discount: 0,
          manual_item_discount: 0,
          order_discount_allocation: 0,
          net_line_total: 50000,
          cost_at_sale: 0,
          recipe_snapshot_json: "{}",
          promo_discount_reason: "",
          manual_discount_reason: "",
          product_name: "Cà phê sữa",
          size_name: "M",
          modifiers: [],
        },
      ],
    },
    timeline: [],
    events: [],
  };
}

describe("OrderDetailView", () => {
  it("shows Sửa đơn link to edit page and Hủy đơn button for COMPLETED order", () => {
    const detail = makeDetail("COMPLETED");
    const brands = [{ id: "BRD-1", name: "Phin Đi" }];
    const returnTo = "/admin/orders?payment=Tien+mat";

    render(<OrderDetailView detail={detail} brands={brands} returnTo={returnTo} />);

    expect(screen.getByText("ORD000001")).toBeDefined();
    expect(screen.getByText("Phin Đi")).toBeDefined();

    const editLink = screen.getByRole("link", { name: "Sửa đơn" });
    expect(editLink).toBeDefined();
    expect(editLink.getAttribute("href")).toBe(
      `/admin/orders/ORD-1/edit?returnTo=${encodeURIComponent(returnTo)}`
    );

    const voidButton = screen.getByRole("button", { name: "Hủy đơn" });
    expect(voidButton).toBeDefined();
  });

  it("does not show Sửa đơn or Hủy đơn for VOIDED order", () => {
    const detail = makeDetail("VOIDED");
    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    expect(screen.queryByRole("link", { name: "Sửa đơn" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hủy đơn" })).toBeNull();
    expect(screen.getByText("Đã hủy")).toBeDefined();
  });
});
