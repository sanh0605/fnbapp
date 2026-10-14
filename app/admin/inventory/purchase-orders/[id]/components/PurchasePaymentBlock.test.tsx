// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PurchasePaymentBlock } from "./PurchasePaymentBlock";
import type { DBBankAccount } from "@/types/db";

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
      <PurchasePaymentBlock paymentMethod="CASH" bankAccountId={null} bankAccounts={sampleAccounts} />
    );

    expect(screen.getByText("Hình thức thanh toán:")).toBeTruthy();
    expect(screen.getByText("Tiền mặt")).toBeTruthy();
  });

  it("shows Hình thức thanh toán: Chuyển khoản with account name", () => {
    render(
      <PurchasePaymentBlock paymentMethod="BANK_TRANSFER" bankAccountId="BA-001" bankAccounts={sampleAccounts} />
    );

    expect(screen.getByText("Chuyển khoản (ACB - Phin Di)")).toBeTruthy();
  });
});

// Owner 2026-10-14, on PO-203: "Chỉ được đổi trong trang sửa phiếu". The
// completed order's page only shows how it was paid; changing it means
// opening Sửa phiếu, like every other field of the order.
describe("PurchasePaymentBlock is read-only (owner 2026-10-14)", () => {
  it("shows no way to change the payment on the order's page", () => {
    render(
      <PurchasePaymentBlock paymentMethod="CASH" bankAccountId={null} bankAccounts={sampleAccounts} />
    );

    expect(screen.queryByText("Đổi cách trả tiền")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not call any save action and takes no edit flag", () => {
    const source = readFileSync(join(__dirname, "PurchasePaymentBlock.tsx"), "utf8");
    expect(source).not.toContain("setPurchaseOrderPayment");
    expect(source).not.toContain("canEdit");
    const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
    expect(page).not.toContain("canEditPayment");
  });
});
