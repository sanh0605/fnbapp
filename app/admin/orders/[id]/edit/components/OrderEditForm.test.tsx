// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { OrderEditForm } from "./OrderEditForm";
import { editOrderV2 } from "@/app/admin/orders/order-edit-actions";
import type { OrderListItem } from "@/app/admin/orders/actions";

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

vi.mock("@/app/admin/orders/order-edit-actions", () => ({
  editOrderV2: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

function makeOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
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
    payments: [{ method: "CASH", amount: 50000 }],
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
    ...overrides,
  };
}

function makeSplitOrder(): OrderListItem {
  return makeOrder({
    gross_total: 18000,
    net_total: 18000,
    method: "Tien mat",
    payments: [
      { method: "CASH", amount: 9000 },
      { method: "BANK_TRANSFER", amount: 9000 },
    ],
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
        unit_price: 18000,
        modifiers_snapshot_json: "[]",
        gross_line_total: 18000,
        promo_discount: 0,
        manual_item_discount: 0,
        order_discount_allocation: 0,
        net_line_total: 18000,
        cost_at_sale: 0,
        recipe_snapshot_json: "{}",
        promo_discount_reason: "",
        manual_discount_reason: "",
        product_name: "Trà sữa truyền thống",
        size_name: "M",
        modifiers: [],
      },
    ],
  });
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

  describe("payment parts editing (BR-SALE-013)", () => {
    it("(a) a split order 9,000 + 9,000 shows both parts prefilled; changing them to 10,000 + 8,000 and saving sends payments [CASH 10000, BANK_TRANSFER 8000]", async () => {
      vi.mocked(editOrderV2).mockResolvedValueOnce({
        success: true,
        new_order_id: "ORD-NEW",
        new_version: 2,
      });

      render(
        <OrderEditForm
          order={makeSplitOrder()}
          brands={[]}
          products={[]}
          variants={[]}
          modifiers={[]}
          categories={[]}
          returnTo={returnTo}
        />
      );

      const cashInput = screen.getByLabelText("Số tiền tiền mặt") as HTMLInputElement;
      const transferInput = screen.getByLabelText("Số tiền chuyển khoản") as HTMLInputElement;
      expect(cashInput.value).toBe("9,000");
      expect(transferInput.value).toBe("9,000");

      fireEvent.change(cashInput, { target: { value: "10000" } });
      fireEvent.change(transferInput, { target: { value: "8000" } });

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Chỉnh tỷ lệ tiền mặt/chuyển khoản" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      expect(submitButton).not.toBeDisabled();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(editOrderV2).toHaveBeenCalledWith(
          expect.objectContaining({
            orderId: "ORD-1",
            cart: expect.objectContaining({
              payment_method: "CASH",
              payments: [
                { method: "CASH", amount: 10000, reference: "" },
                { method: "BANK_TRANSFER", amount: 8000, reference: "" },
              ],
            }),
          })
        );
      });
    });

    it("(b) 9,000 + 8,000 shows 'Còn lệch' and Lưu is disabled", () => {
      render(
        <OrderEditForm
          order={makeSplitOrder()}
          brands={[]}
          products={[]}
          variants={[]}
          modifiers={[]}
          categories={[]}
          returnTo={returnTo}
        />
      );

      const transferInput = screen.getByLabelText("Số tiền chuyển khoản");
      fireEvent.change(transferInput, { target: { value: "8000" } });

      expect(screen.getByText(/Còn lệch/i)).toBeInTheDocument();
      expect(screen.getByText(/Còn lệch 1,000/i)).toBeInTheDocument();

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Thử lưu lệch" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      expect(submitButton).toBeDisabled();
    });

    it("(c) removing the transfer part leaves one Tiền mặt part and saving sends one CASH entry", async () => {
      vi.mocked(editOrderV2).mockResolvedValueOnce({
        success: true,
        new_order_id: "ORD-NEW",
        new_version: 2,
      });

      render(
        <OrderEditForm
          order={makeSplitOrder()}
          brands={[]}
          products={[]}
          variants={[]}
          modifiers={[]}
          categories={[]}
          returnTo={returnTo}
        />
      );

      const removeTransferButton = screen.getByRole("button", { name: /Xoá.*chuyển khoản/i });
      fireEvent.click(removeTransferButton);

      expect(screen.queryByLabelText("Số tiền chuyển khoản")).toBeNull();
      expect(screen.queryByLabelText("Số tiền tiền mặt")).toBeNull();

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Khách trả toàn bộ tiền mặt" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      expect(submitButton).not.toBeDisabled();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(editOrderV2).toHaveBeenCalledWith(
          expect.objectContaining({
            orderId: "ORD-1",
            cart: expect.objectContaining({
              payment_method: "CASH",
              payments: [
                { method: "CASH", amount: 18000, reference: "" },
              ],
            }),
          })
        );
      });
    });

    it("(d) a one-method order shows no amount box and sends one entry with its method", async () => {
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

      expect(screen.queryByLabelText(/^Số tiền (tiền mặt|chuyển khoản)$/i)).toBeNull();

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Cập nhật đơn một cách trả" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      expect(submitButton).not.toBeDisabled();
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(editOrderV2).toHaveBeenCalledWith(
          expect.objectContaining({
            orderId: "ORD-1",
            cart: expect.objectContaining({
              payment_method: "CASH",
              payments: [
                { method: "CASH", amount: 50000, reference: "" },
              ],
            }),
          })
        );
      });
    });

    it("(e) 'Thêm cách trả' adds a Chuyển khoản row", () => {
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

      const addButton = screen.getByRole("button", { name: "Thêm cách trả" });
      fireEvent.click(addButton);

      expect(screen.getByLabelText("Số tiền chuyển khoản")).toBeInTheDocument();
      expect(screen.getByLabelText("Số tiền tiền mặt")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Xoá.*chuyển khoản/i })).toBeInTheDocument();
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

describe("OrderEditForm option groups (Task 5)", () => {
  it("passes option groups and links to line editor and add product", async () => {
    const orderWithMod = makeOrder({
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
          modifiers_snapshot_json: '[{"id":"MOD-OLD","name":"Trân châu cũ","price":5000,"qty":1}]',
          gross_line_total: 55000,
          promo_discount: 0,
          manual_item_discount: 0,
          order_discount_allocation: 0,
          net_line_total: 55000,
          cost_at_sale: 0,
          recipe_snapshot_json: "{}",
          promo_discount_reason: "",
          manual_discount_reason: "",
          product_name: "Cà phê sữa",
          size_name: "M",
          modifiers: [{ id: "MOD-OLD", name: "Trân châu cũ", price: 5000, qty: 1 }],
        },
      ],
    });

    render(
      <OrderEditForm
        order={orderWithMod}
        brands={[]}
        products={[{ id: "PROD-1", name: "Cà phê sữa", category_id: "CAT-1", status: "ACTIVE" }]}
        variants={[{ id: "VAR-1", product_id: "PROD-1", size_name: "M", price: 50000, status: "ACTIVE" }]}
        modifiers={[]}
        categories={[{ id: "CAT-1", name: "Cà phê" }]}
        optionGroups={[]}
        optionGroupLinks={[]}
        returnTo="/admin/orders"
      />
    );

    // Click "Sửa" on the line item
    const editLineBtn = screen.getByRole("button", { name: "Sửa" });
    fireEvent.click(editLineBtn);

    // Old unattached modifier is rendered under "Đã chọn trước"
    expect(screen.getByText(/Đã chọn trước/i)).toBeInTheDocument();
    expect(screen.getByText("Trân châu cũ")).toBeInTheDocument();
  });
});
