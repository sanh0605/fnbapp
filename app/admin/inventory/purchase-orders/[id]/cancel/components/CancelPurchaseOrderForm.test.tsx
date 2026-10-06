// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CancelPurchaseOrderForm from "./CancelPurchaseOrderForm";
import type { ReadyCancelView } from "./CancelPurchaseOrderForm";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockCancelPurchaseOrder = vi.hoisted(() => vi.fn());
vi.mock("@/app/admin/inventory/purchase-orders/actions", () => ({
  cancelPurchaseOrder: mockCancelPurchaseOrder,
}));

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  mockCancelPurchaseOrder.mockReset();
});

describe("CancelPurchaseOrderForm (BR-INV-015)", () => {
  it("Blocked view shows sentence, no textarea, no Xác nhận huỷ", () => {
    const blockedView: ReadyCancelView = {
      state: "ready",
      order: {
        id: "PO-064",
        dateText: "12/08/2026 10:00:00",
        supplierName: "Trứng Ba Huân",
        totalAmount: 180000,
        paymentLabel: "Tiền mặt",
        status: "COMPLETED",
        subtotalAmount: 0, shippingFee: 0, taxAmount: 0, discountTotal: 0,
        invoiceCode: "", sourceName: "—", notes: "",
      },
      lines: [],
      blockedMessages: [
        "Huỷ phiếu này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái. Hàng của phiếu đã được dùng, nên phiếu này là thật.",
      ],
      assets: [],
    };

    render(<CancelPurchaseOrderForm view={blockedView} />);

    expect(
      screen.getByText(
        "Huỷ phiếu này làm tồn kho âm: Trứng gà lúc thấp nhất (03/10/2026 22:32) chỉ còn 21 trái, phiếu có 60 trái. Hàng của phiếu đã được dùng, nên phiếu này là thật."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xác nhận huỷ" })).toBeNull();
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute(
      "href",
      "/admin/inventory/purchase-orders/PO-064"
    );
  });

  it("Ready view with assets shows assets, button disabled while blank, enabled after typing reason", () => {
    const readyView: ReadyCancelView = {
      state: "ready",
      order: {
        id: "PO-147",
        dateText: "13/08/2026 00:00:00",
        supplierName: "Dụng Cụ Quán",
        totalAmount: 45000,
        paymentLabel: "Tiền mặt",
        status: "COMPLETED",
        subtotalAmount: 0, shippingFee: 0, taxAmount: 0, discountTotal: 0,
        invoiceCode: "", sourceName: "—", notes: "",
      },
      lines: [],
      blockedMessages: [],
      assets: [
        {
          id: "TS-080",
          name: "Vòi rót rượu",
          quantity: 1,
          totalCost: 45000,
        },
      ],
    };

    render(<CancelPurchaseOrderForm view={readyView} />);

    const assetsTable = screen.getByTestId("desktop-assets-table");
    expect(within(assetsTable).getByText("TS-080")).toBeInTheDocument();
    expect(within(assetsTable).getByText("Vòi rót rượu")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Xác nhận huỷ" });
    const textarea = screen.getByRole("textbox", { name: "Lý do huỷ (bắt buộc)" });

    // Initially empty -> disabled
    expect(button).toBeDisabled();

    // Type spaces only -> disabled
    fireEvent.change(textarea, { target: { value: "   " } });
    expect(button).toBeDisabled();

    // Type valid reason -> enabled
    fireEvent.change(textarea, { target: { value: "Nhập trùng" } });
    expect(button).toBeEnabled();
  });

  it("Submit failure displays error paragraphs and preserves typed reason", async () => {
    mockCancelPurchaseOrder.mockResolvedValueOnce({
      success: false,
      error: "Dòng 1\nDòng 2",
    });

    const readyView: ReadyCancelView = {
      state: "ready",
      order: {
        id: "PO-147",
        dateText: "13/08/2026 00:00:00",
        supplierName: "Dụng Cụ Quán",
        totalAmount: 45000,
        paymentLabel: "Tiền mặt",
        status: "COMPLETED",
        subtotalAmount: 0, shippingFee: 0, taxAmount: 0, discountTotal: 0,
        invoiceCode: "", sourceName: "—", notes: "",
      },
      lines: [],
      blockedMessages: [],
      assets: [],
    };

    render(<CancelPurchaseOrderForm view={readyView} />);

    const textarea = screen.getByRole("textbox", { name: "Lý do huỷ (bắt buộc)" });
    fireEvent.change(textarea, { target: { value: "Nhập trùng" } });

    const button = screen.getByRole("button", { name: "Xác nhận huỷ" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Dòng 1")).toBeInTheDocument();
      expect(screen.getByText("Dòng 2")).toBeInTheDocument();
    });

    expect(textarea).toHaveValue("Nhập trùng");
  });

  it("Submit success calls router.push with detail URL and router.refresh", async () => {
    mockCancelPurchaseOrder.mockResolvedValueOnce({
      success: true,
      retiredAssetIds: [],
    });

    const readyView: ReadyCancelView = {
      state: "ready",
      order: {
        id: "PO-147",
        dateText: "13/08/2026 00:00:00",
        supplierName: "Dụng Cụ Quán",
        totalAmount: 45000,
        paymentLabel: "Tiền mặt",
        status: "COMPLETED",
        subtotalAmount: 0, shippingFee: 0, taxAmount: 0, discountTotal: 0,
        invoiceCode: "", sourceName: "—", notes: "",
      },
      lines: [],
      blockedMessages: [],
      assets: [],
    };

    render(<CancelPurchaseOrderForm view={readyView} />);

    const textarea = screen.getByRole("textbox", { name: "Lý do huỷ (bắt buộc)" });
    fireEvent.change(textarea, { target: { value: "Nhập trùng PO-065" } });

    const button = screen.getByRole("button", { name: "Xác nhận huỷ" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCancelPurchaseOrder).toHaveBeenCalledWith({
        id: "PO-147",
        reason: "Nhập trùng PO-065",
      });
      expect(push).toHaveBeenCalledWith("/admin/inventory/purchase-orders/PO-147");
      expect(refresh).toHaveBeenCalled();
    });
  });

  const po195View: ReadyCancelView = {
    state: "ready",
    order: {
      id: "PO-195",
      dateText: "01/10/2026 08:00:00",
      supplierName: "Bếp Việt",
      totalAmount: 2443400,
      paymentLabel: "Chuyển khoản",
      status: "COMPLETED",
      subtotalAmount: 3140000,
      shippingFee: 59600,
      taxAmount: 0,
      discountTotal: 756200,
      invoiceCode: "HD-77",
      sourceName: "SRC-1",
      notes: "Giao buổi sáng",
    },
    lines: [
      {
        id: "POL-24a1a94b-e556-41ec-8786-52bfa0b77915",
        itemName: "Bột cà phê MR.PHIN Robusta Dak Mil",
        unitName: "Túi",
        quantity: 20,
        unitPrice: 157000,
        subtotal: 3140000,
      },
    ],
    blockedMessages: [],
    assets: [],
  };

  it("the desktop table has headers Mặt hàng, Đơn vị, Số lượng, Đơn giá, Thành tiền and a row with line data", () => {
    render(<CancelPurchaseOrderForm view={po195View} />);

    const table = screen.getByTestId("desktop-lines-table");
    expect(within(table).getByText("Mặt hàng")).toBeInTheDocument();
    expect(within(table).getByText("Đơn vị")).toBeInTheDocument();
    expect(within(table).getByText("Số lượng")).toBeInTheDocument();
    expect(within(table).getByText("Đơn giá")).toBeInTheDocument();
    expect(within(table).getByText("Thành tiền")).toBeInTheDocument();

    expect(within(table).getByText("Bột cà phê MR.PHIN Robusta Dak Mil")).toBeInTheDocument();
    expect(within(table).getByText("Túi")).toBeInTheDocument();
    expect(within(table).getByText("20")).toBeInTheDocument();
    expect(within(table).getByText("157.000")).toBeInTheDocument();
    expect(within(table).getByText("3.140.000")).toBeInTheDocument();
  });

  it("the money card shows 59.600, 756.200 and 2.443.400 and label Hình thức thanh toán", () => {
    render(<CancelPurchaseOrderForm view={po195View} />);

    const moneyCard = screen.getByTestId("money-card");
    expect(within(moneyCard).getByText("+59.600")).toBeInTheDocument();
    expect(within(moneyCard).getByText("-756.200")).toBeInTheDocument();
    expect(within(moneyCard).getByText("2.443.400")).toBeInTheDocument();
    expect(within(moneyCard).getByText(/Hình thức thanh toán:/)).toBeInTheDocument();
  });

  it("when blocked: the line table and money card still render, Xác nhận huỷ and the textarea do not", () => {
    const blockedPo195View: ReadyCancelView = {
      ...po195View,
      blockedMessages: [
        "Huỷ phiếu này làm tồn kho âm: Bột cà phê lúc thấp nhất...",
      ],
    };

    render(<CancelPurchaseOrderForm view={blockedPo195View} />);

    const table = screen.getByTestId("desktop-lines-table");
    expect(within(table).getByText("Bột cà phê MR.PHIN Robusta Dak Mil")).toBeInTheDocument();

    const moneyCard = screen.getByTestId("money-card");
    expect(within(moneyCard).getByText("2.443.400")).toBeInTheDocument();

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xác nhận huỷ" })).toBeNull();
  });

  it("the phone block shows one card per line with the item name", () => {
    render(<CancelPurchaseOrderForm view={po195View} />);

    const phoneBlock = screen.getByTestId("phone-lines-list");
    expect(within(phoneBlock).getByText("Bột cà phê MR.PHIN Robusta Dak Mil")).toBeInTheDocument();
  });

  it("the form no longer carries the class max-w-2xl", () => {
    const { container } = render(<CancelPurchaseOrderForm view={po195View} />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).not.toHaveClass("max-w-2xl");
  });
});
