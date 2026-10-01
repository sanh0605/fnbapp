// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { OrderEditForm } from "./OrderEditForm";
import { editOrderV2, type OrderListItem } from "@/app/admin/orders/actions";

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

vi.mock("@/app/admin/orders/actions", () => ({
  editOrderV2: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

function makeOrder(): OrderListItem {
  return {
    id: "ORD-1",
    order_no: "#1",
    display_order_no: "ORD000001",
    brand_id: "BRD-1",
    status: "COMPLETED",
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
  };
}

describe("OrderEditForm", () => {
  const returnTo = "/admin/orders?payment=Tien+mat";

  it("renders the edit reason textarea immediately", () => {
    render(
      <OrderEditForm
        order={makeOrder()}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
        returnTo={returnTo}
      />
    );

    const textarea = screen.getByLabelText("Lý do chỉnh sửa");
    expect(textarea).toBeDefined();
  });

  it("Bỏ navigates back to view order page with returnTo preserved", () => {
    render(
      <OrderEditForm
        order={makeOrder()}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
        returnTo={returnTo}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelButton);

    expect(push).toHaveBeenCalledWith(
      `/admin/orders/ORD-1?returnTo=${encodeURIComponent(returnTo)}`
    );
  });

  it("saving successfully with new_order_id navigates to new order view page", async () => {
    vi.mocked(editOrderV2).mockResolvedValueOnce({
      success: true,
      new_order_id: "ORD-NEW",
      new_version: 2,
    });

    render(
      <OrderEditForm
        order={makeOrder()}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
        returnTo={returnTo}
      />
    );

    const textarea = screen.getByLabelText("Lý do chỉnh sửa");
    fireEvent.change(textarea, { target: { value: "Khách đổi ly lớn" } });

    const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(editOrderV2).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "ORD-1",
          expectedVersion: 1,
          reason: "Khách đổi ly lớn",
        })
      );
      expect(push).toHaveBeenCalledWith(
        `/admin/orders/ORD-NEW?returnTo=${encodeURIComponent(returnTo)}`
      );
      expect(refresh).toHaveBeenCalled();
    });
  });
});
