// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
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
      },
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
      },
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

    expect(screen.getByText(/TS-080/)).toBeInTheDocument();
    expect(screen.getByText(/Vòi rót rượu/)).toBeInTheDocument();

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
      },
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
      },
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
});
