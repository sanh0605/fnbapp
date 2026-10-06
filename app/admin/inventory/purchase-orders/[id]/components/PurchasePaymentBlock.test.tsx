// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchasePaymentBlock } from "./PurchasePaymentBlock";
import type { DBBankAccount } from "@/types/db";

const { mockSetPurchaseOrderPayment, router } = vi.hoisted(() => ({
  mockSetPurchaseOrderPayment: vi.fn(),
  router: { refresh: vi.fn() },
}));

vi.mock("../../actions", () => ({
  setPurchaseOrderPayment: mockSetPurchaseOrderPayment,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

if (typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleAccounts: DBBankAccount[] = [
  {
    id: "BA-001",
    name: "ACB - Phin Di",
    bank_name: "ACB",
    account_number: "123456",
    status: "ACTIVE",
    created_at: "2026-03-26T00:00:00Z",
    created_by_id: null,
    created_by_name: null,
    updated_at: "2026-03-26T00:00:00Z",
    updated_by_id: null,
    updated_by_name: null,
  },
];

describe("PurchasePaymentBlock", () => {
  it("PO-181 (COMPLETED, CASH) shows Hình thức thanh toán: Tiền mặt", () => {
    render(
      <PurchasePaymentBlock
        poId="PO-181"
        paymentMethod="CASH"
        bankAccountId={null}
        bankAccounts={sampleAccounts}
        canEdit={false}
      />
    );

    expect(screen.getByText("Hình thức thanh toán:")).toBeTruthy();
    expect(screen.getByText("Tiền mặt")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
  });

  it("shows Hình thức thanh toán: Chuyển khoản with account name", () => {
    render(
      <PurchasePaymentBlock
        poId="PO-182"
        paymentMethod="BANK_TRANSFER"
        bankAccountId="BA-001"
        bankAccounts={sampleAccounts}
        canEdit={false}
      />
    );

    expect(screen.getByText("Chuyển khoản (ACB - Phin Di)")).toBeTruthy();
  });

  it("hides edit form when canEdit is false", () => {
    render(
      <PurchasePaymentBlock
        poId="PO-181"
        paymentMethod="CASH"
        bankAccountId={null}
        bankAccounts={sampleAccounts}
        canEdit={false}
      />
    );

    expect(screen.queryByText("Đổi cách trả tiền")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
  });

  it("preselects single active account when Chuyển khoản is picked", () => {
    render(
      <PurchasePaymentBlock
        poId="PO-181"
        paymentMethod="CASH"
        bankAccountId={null}
        bankAccounts={sampleAccounts}
        canEdit={true}
      />
    );

    const transferRadio = screen.getByLabelText("Chuyển khoản");
    fireEvent.click(transferRadio);

    const accountSelect = screen.getByLabelText("Tài khoản *") as HTMLSelectElement;
    expect(accountSelect.value).toBe("BA-001");
  });

  it("calls setPurchaseOrderPayment action with id, payment_method, bank_account_id", async () => {
    mockSetPurchaseOrderPayment.mockResolvedValue({ success: true });

    render(
      <PurchasePaymentBlock
        poId="PO-181"
        paymentMethod="CASH"
        bankAccountId={null}
        bankAccounts={sampleAccounts}
        canEdit={true}
      />
    );

    const transferRadio = screen.getByLabelText("Chuyển khoản");
    fireEvent.click(transferRadio);

    const saveBtn = screen.getByRole("button", { name: "Lưu" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSetPurchaseOrderPayment).toHaveBeenCalledTimes(1);
    });

    const formData = mockSetPurchaseOrderPayment.mock.calls[0][0] as FormData;
    expect(formData.get("id")).toBe("PO-181");
    expect(formData.get("payment_method")).toBe("BANK_TRANSFER");
    expect(formData.get("bank_account_id")).toBe("BA-001");

    await waitFor(() => {
      expect(screen.getByText("Đã cập nhật cách trả tiền")).toBeTruthy();
    });
    expect(router.refresh).toHaveBeenCalled();
  });

  it("displays error message inline when action fails", async () => {
    mockSetPurchaseOrderPayment.mockResolvedValue({
      error: "Chọn tài khoản nhận chuyển khoản",
    });

    render(
      <PurchasePaymentBlock
        poId="PO-181"
        paymentMethod="CASH"
        bankAccountId={null}
        bankAccounts={sampleAccounts}
        canEdit={true}
      />
    );

    const saveBtn = screen.getByRole("button", { name: "Lưu" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
      expect(screen.getByText("Chọn tài khoản nhận chuyển khoản")).toBeTruthy();
    });
  });
});
