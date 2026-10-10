// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
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


// Owner 2026-10-10: a create/edit form looks like the slip's detail page —
// on a computer the lines take the left two thirds and the slip-wide boxes
// stack in the right third; on a phone the same blocks run top to bottom in
// their source order (shared boxes, lines, then money and buttons).
function expectBefore(a: Element, b: Element) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("OrderEditForm two columns (owner 2026-10-10)", () => {
  function renderForm() {
    return render(
      <OrderEditForm
        order={makeOrder()}
        brands={[]}
        products={[]}
        variants={[]}
        modifiers={[]}
        categories={[]}
        returnTo="/admin/orders"
      />
    );
  }

  it("on a computer: the dishes on the left two thirds, payment, total, reason and buttons on the right third", () => {
    renderForm();
    const layout = screen.getByTestId("form-layout");
    const lines = screen.getByTestId("form-lines");
    const money = screen.getByTestId("form-money");
    expect(layout.className).toContain("lg:grid-cols-3");
    expect(lines.className).toContain("lg:col-span-2");
    expect(lines.className).toContain("lg:col-start-1");
    expect(money.className).toContain("lg:col-start-3");
    expect(layout.className).not.toContain("max-w-4xl");

    expect(within(lines).getByText("+ Thêm sản phẩm")).toBeInTheDocument();
    expect(within(money).getByText("Tổng cộng")).toBeInTheDocument();
    expect(within(money).getByLabelText("Lý do chỉnh sửa")).toBeInTheDocument();
    expect(within(money).getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(within(money).getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("on a phone the dishes come before the payment and the buttons", () => {
    renderForm();
    expectBefore(screen.getByTestId("form-lines"), screen.getByTestId("form-money"));
  });
});
