// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { OrderEditForm } from "./OrderEditForm";
import { changeOrderPayments } from "@/app/admin/orders/order-edit-actions";
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

vi.mock("next/link", () => ({
  default: ({ children, href, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/app/admin/orders/order-edit-actions", () => ({
  changeOrderPayments: vi.fn(),
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
        promo_discount_reason: "",
        product_name: "Cà phê sữa",
        size_name: "M",
        modifiers: [{ id: "MOD-1", name: "Trân châu đen", qty: 1, price: 5000 }],
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
        promo_discount_reason: "",
        product_name: "Trà sữa truyền thống",
        size_name: "M",
        modifiers: [],
      },
    ],
  });
}

describe("OrderEditForm (Đổi cách trả)", () => {
  const returnTo = "/admin/orders?payment=Tien+mat";

  it("renders the lines read-only with dish, size, toppings, quantity, line money and total", () => {
    render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

    // Header title "Đổi cách trả"
    expect(screen.getByRole("heading", { name: "Đổi cách trả" })).toBeInTheDocument();

    // Summary of lines
    const linesSection = screen.getByTestId("form-lines");
    expect(within(linesSection).getAllByText("Cà phê sữa").length).toBeGreaterThan(0);
    expect(within(linesSection).getAllByText(/Size M|M/).length).toBeGreaterThan(0);
    expect(within(linesSection).getAllByText(/Trân châu đen/).length).toBeGreaterThan(0);
    expect(within(linesSection).getAllByText("50,000").length).toBeGreaterThan(0);
    expect(within(linesSection).getByText("Khách trả")).toBeInTheDocument();

    // Read-only: no editing controls for lines, no add product, no discount editor
    expect(screen.queryByText("+ Thêm sản phẩm")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
    expect(screen.queryByLabelText(/Giảm giá/i)).toBeNull();
  });

  it("renders the edit reason textarea immediately", () => {
    render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

    const textarea = screen.getByLabelText("Lý do chỉnh sửa");
    expect(textarea).toBeDefined();
  });

  it("Bỏ thay đổi navigates back to view order page with returnTo preserved", () => {
    render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

    const cancelButton = screen.getByRole("button", { name: "Bỏ thay đổi" });
    fireEvent.click(cancelButton);

    expect(push).toHaveBeenCalledWith(
      `/admin/orders/ORD-1?returnTo=${encodeURIComponent(returnTo)}`
    );
  });

  it("calls changeOrderPayments with the right payload and redirects on success", async () => {
    vi.mocked(changeOrderPayments).mockResolvedValueOnce({
      success: true,
      new_order_id: "ORD-NEW",
    });

    render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

    const textarea = screen.getByLabelText("Lý do chỉnh sửa");
    fireEvent.change(textarea, { target: { value: "Khách đổi sang trả thẻ/chuyển khoản" } });

    const methodSelect = screen.getByLabelText("Phương thức thanh toán");
    fireEvent.change(methodSelect, { target: { value: "BANK_TRANSFER" } });

    const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(changeOrderPayments).toHaveBeenCalledWith({
        orderId: "ORD-1",
        expectedVersion: 1,
        payments: [{ method: "BANK_TRANSFER", amount: 50000 }],
        reason: "Khách đổi sang trả thẻ/chuyển khoản",
      });
      expect(push).toHaveBeenCalledWith(
        `/admin/orders/ORD-NEW?returnTo=${encodeURIComponent(returnTo)}`
      );
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows a returned error inline in an Alert above the buttons", async () => {
    vi.mocked(changeOrderPayments).mockResolvedValueOnce({
      success: false,
      error: "Đơn vừa được người khác sửa, tải lại trang",
    });

    render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

    const textarea = screen.getByLabelText("Lý do chỉnh sửa");
    fireEvent.change(textarea, { target: { value: "Đổi phương thức" } });

    const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(changeOrderPayments).toHaveBeenCalled();
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Đơn vừa được người khác sửa, tải lại trang");
    expect(push).not.toHaveBeenCalled();
  });

  describe("payment parts editing (BR-SALE-013)", () => {
    it("(a) a split order 9,000 + 9,000 shows both parts prefilled; changing them to 10,000 + 8,000 and saving sends payments [CASH 10000, BANK_TRANSFER 8000]", async () => {
      vi.mocked(changeOrderPayments).mockResolvedValueOnce({
        success: true,
        new_order_id: "ORD-NEW",
      });

      render(<OrderEditForm order={makeSplitOrder()} returnTo={returnTo} />);

      const cashInput = screen.getByLabelText("Số tiền tiền mặt") as HTMLInputElement;
      const transferInput = screen.getByLabelText("Số tiền chuyển khoản") as HTMLInputElement;
      expect(cashInput.value).toBe("9,000");
      expect(transferInput.value).toBe("9,000");

      fireEvent.change(cashInput, { target: { value: "10000" } });
      fireEvent.change(transferInput, { target: { value: "8000" } });

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Chỉnh tỷ lệ tiền mặt/chuyển khoản" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(changeOrderPayments).toHaveBeenCalledWith({
          orderId: "ORD-1",
          expectedVersion: 1,
          payments: [
            { method: "CASH", amount: 10000 },
            { method: "BANK_TRANSFER", amount: 8000 },
          ],
          reason: "Chỉnh tỷ lệ tiền mặt/chuyển khoản",
        });
      });
    });

    it("(b) 9,000 + 8,000 shows 'Còn lệch' and submitting does not call changeOrderPayments", async () => {
      render(<OrderEditForm order={makeSplitOrder()} returnTo={returnTo} />);

      const transferInput = screen.getByLabelText("Số tiền chuyển khoản");
      fireEvent.change(transferInput, { target: { value: "8000" } });

      expect(screen.getByText(/Còn lệch/i)).toBeInTheDocument();
      expect(screen.getByText(/Còn lệch 1,000/i)).toBeInTheDocument();

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Thử lưu lệch" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      fireEvent.click(submitButton);

      expect(changeOrderPayments).not.toHaveBeenCalled();
    });

    it("(c) removing the transfer part leaves one Tiền mặt part and saving sends one CASH entry with full total", async () => {
      vi.mocked(changeOrderPayments).mockResolvedValueOnce({
        success: true,
        new_order_id: "ORD-NEW",
      });

      render(<OrderEditForm order={makeSplitOrder()} returnTo={returnTo} />);

      const removeTransferButton = screen.getByRole("button", { name: /Xoá.*chuyển khoản/i });
      fireEvent.click(removeTransferButton);

      expect(screen.queryByLabelText("Số tiền chuyển khoản")).toBeNull();
      expect(screen.queryByLabelText("Số tiền tiền mặt")).toBeNull();

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Khách trả toàn bộ tiền mặt" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(changeOrderPayments).toHaveBeenCalledWith({
          orderId: "ORD-1",
          expectedVersion: 1,
          payments: [{ method: "CASH", amount: 18000 }],
          reason: "Khách trả toàn bộ tiền mặt",
        });
      });
    });

    it("(d) a one-method order shows no amount box and sends one entry with its method", async () => {
      vi.mocked(changeOrderPayments).mockResolvedValueOnce({
        success: true,
        new_order_id: "ORD-NEW",
      });

      render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

      expect(screen.queryByLabelText(/^Số tiền (tiền mặt|chuyển khoản)$/i)).toBeNull();

      const textarea = screen.getByLabelText("Lý do chỉnh sửa");
      fireEvent.change(textarea, { target: { value: "Cập nhật đơn một cách trả" } });

      const submitButton = screen.getByRole("button", { name: "Lưu thay đổi" });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(changeOrderPayments).toHaveBeenCalledWith({
          orderId: "ORD-1",
          expectedVersion: 1,
          payments: [{ method: "CASH", amount: 50000 }],
          reason: "Cập nhật đơn một cách trả",
        });
      });
    });

    it("(e) 'Thêm cách trả' adds a Chuyển khoản row", () => {
      render(<OrderEditForm order={makeOrder()} returnTo={returnTo} />);

      const addButton = screen.getByRole("button", { name: "Thêm cách trả" });
      fireEvent.click(addButton);

      expect(screen.getByLabelText("Số tiền chuyển khoản")).toBeInTheDocument();
      expect(screen.getByLabelText("Số tiền tiền mặt")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Xoá.*chuyển khoản/i })).toBeInTheDocument();
    });
  });
});

function expectBefore(a: Element, b: Element) {
  expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

describe("OrderEditForm two columns (owner 2026-10-10)", () => {
  function renderForm() {
    return render(<OrderEditForm order={makeOrder()} returnTo="/admin/orders" />);
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

    expect(within(lines).getByText("Món trong đơn")).toBeInTheDocument();
    expect(within(lines).getByText("Khách trả")).toBeInTheDocument();
    expect(within(money).getByText("Thanh toán")).toBeInTheDocument();
    expect(within(money).getByLabelText("Lý do chỉnh sửa")).toBeInTheDocument();
    expect(within(money).getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(within(money).getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });

  it("on a phone the dishes come before the payment and the buttons", () => {
    renderForm();
    expectBefore(screen.getByTestId("form-lines"), screen.getByTestId("form-money"));
  });

  it("shows FormActionBar with Lưu thay đổi and Bỏ thay đổi", () => {
    renderForm();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });
});
