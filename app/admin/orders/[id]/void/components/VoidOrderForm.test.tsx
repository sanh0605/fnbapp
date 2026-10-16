// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { VoidOrderForm } from "./VoidOrderForm";
import { voidOrderV2 } from "@/app/admin/orders/order-void-actions";
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

vi.mock("@/app/admin/orders/order-void-actions", () => ({
  voidOrderV2: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.mocked(voidOrderV2).mockReset();
});

function makeOrder(): OrderListItem {
  return {
    id: "ORD-123",
    order_no: "261013001022",
    display_order_no: "261013001022",
    brand_id: "BRD-1",
    status: "COMPLETED",
    version: 1,
    parent_order_id: "",
    gross_total: 75000,
    promo_discount_total: 0,
    manual_item_discount_total: 0,
    manual_order_discount: 0,
    net_total: 75000,
    method: "Tien mat",
    payments: [],
    created_by_name: "Thu ngân A",
    created_at: "2026-10-15T10:00:00.000Z",
    lines: [
      {
        id: "line-1",
        order_id: "ORD-123",
        line_no: 1,
        product_id: "PROD-1",
        product_snapshot_json: "{}",
        variant_id: "VAR-1",
        variant_snapshot_json: "{}",
        qty: 2,
        unit_price: 35000,
        modifiers_snapshot_json: "[]",
        gross_line_total: 70000,
        promo_discount: 0,
        manual_item_discount: 0,
        order_discount_allocation: 0,
        net_line_total: 70000,
        promo_discount_reason: "",
        product_name: "Cà phê đen",
        size_name: "L",
        modifiers: [{ id: "mod-1", name: "Đường kiêng", qty: 1 }],
      },
      {
        id: "line-2",
        order_id: "ORD-123",
        line_no: 2,
        product_id: "PROD-2",
        product_snapshot_json: "{}",
        variant_id: "VAR-2",
        variant_snapshot_json: "{}",
        qty: 1,
        unit_price: 5000,
        modifiers_snapshot_json: "[]",
        gross_line_total: 5000,
        promo_discount: 0,
        manual_item_discount: 0,
        order_discount_allocation: 0,
        net_line_total: 5000,
        promo_discount_reason: "",
        product_name: "Bánh tráng",
        size_name: "Tiêu chuẩn",
        modifiers: [],
      },
    ],
  };
}

describe("VoidOrderForm", () => {
  it("renders order summary with dishes, total and reason box", () => {
    const order = makeOrder();
    render(<VoidOrderForm order={order} detailHref="/admin/orders/ORD-123" />);

    expect(screen.getAllByText("Cà phê đen").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bánh tráng").length).toBeGreaterThan(0);
    expect(screen.getByText("75,000")).toBeDefined();
    expect(screen.getByLabelText(/Lý do huỷ/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Xác nhận huỷ" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute("href", "/admin/orders/ORD-123");
  });

  it("has real table on desktop and stacked cards on phone", () => {
    const order = makeOrder();
    render(<VoidOrderForm order={order} detailHref="/admin/orders/ORD-123" />);

    const desktopTable = screen.getByTestId("desktop-lines-table");
    expect(desktopTable.className).toContain("hidden");
    expect(desktopTable.className).toContain("lg:block");

    const phoneList = screen.getByTestId("phone-lines-list");
    expect(phoneList.className).toContain("lg:hidden");
  });

  it("enables 'Xác nhận huỷ' button when non-empty reason is typed", () => {
    const order = makeOrder();
    render(<VoidOrderForm order={order} detailHref="/admin/orders/ORD-123" />);

    const textarea = screen.getByLabelText(/Lý do huỷ/);
    const submitBtn = screen.getByRole("button", { name: "Xác nhận huỷ" });

    expect(submitBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "   " } });
    expect(submitBtn).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Khách huỷ do đợi lâu" } });
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls voidOrderV2 and redirects on success", async () => {
    const order = makeOrder();
    vi.mocked(voidOrderV2).mockResolvedValueOnce({ success: true });

    render(<VoidOrderForm order={order} detailHref="/admin/orders/ORD-123" />);

    const textarea = screen.getByLabelText(/Lý do huỷ/);
    fireEvent.change(textarea, { target: { value: "Khách đổi ý" } });

    const submitBtn = screen.getByRole("button", { name: "Xác nhận huỷ" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(voidOrderV2).toHaveBeenCalledWith("ORD-123", "Khách đổi ý");
      expect(push).toHaveBeenCalledWith("/admin/orders/ORD-123");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("shows error in Alert when voidOrderV2 fails", async () => {
    const order = makeOrder();
    vi.mocked(voidOrderV2).mockResolvedValueOnce({
      success: false,
      error: "Đơn này không còn huỷ được",
    });

    render(<VoidOrderForm order={order} detailHref="/admin/orders/ORD-123" />);

    const textarea = screen.getByLabelText(/Lý do huỷ/);
    fireEvent.change(textarea, { target: { value: "Khách đổi ý" } });

    const submitBtn = screen.getByRole("button", { name: "Xác nhận huỷ" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Đơn này không còn huỷ được")).toBeDefined();
      expect(submitBtn).not.toBeDisabled();
    });
  });

  it("phone lines use min-h-[48px] md:min-h-[40px] (BR-UI-014)", () => {
    const order = makeOrder();
    render(<VoidOrderForm order={order} detailHref="/admin/orders/ORD-123" />);

    const phoneList = screen.getByTestId("phone-lines-list");
    const firstRow = phoneList.firstElementChild as HTMLElement;
    expect(firstRow.className).toContain("min-h-[48px]");
    expect(firstRow.className).toContain("md:min-h-[40px]");
    expect(firstRow.className).not.toContain("min-h-[44px]");
  });
});
