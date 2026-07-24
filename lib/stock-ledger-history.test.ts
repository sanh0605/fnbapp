import { describe, expect, it } from "vitest";
import { getTransactionTypeLabel } from "@/lib/stock-ledger-history";

describe("getTransactionTypeLabel", () => {
  it("translates every known transaction_type from the stock_ledger check constraint", () => {
    expect(getTransactionTypeLabel("SALES_CONSUME")).toBe("Bán hàng");
    expect(getTransactionTypeLabel("EDIT_REVERSAL")).toBe("Hoàn tác sửa đơn");
    expect(getTransactionTypeLabel("EDIT_CONSUME")).toBe("Sửa đơn - trừ kho");
    expect(getTransactionTypeLabel("PO_RECEIPT")).toBe("Nhập hàng");
    expect(getTransactionTypeLabel("PRODUCTION_CONSUME")).toBe("Sản xuất - trừ nguyên liệu");
    expect(getTransactionTypeLabel("PRODUCTION_YIELD")).toBe("Sản xuất - nhập thành phẩm");
    expect(getTransactionTypeLabel("STOCK_ADJUST")).toBe("Điều chỉnh tồn kho");
    expect(getTransactionTypeLabel("ADJUSTMENT_IN")).toBe("Điều chỉnh tăng");
    expect(getTransactionTypeLabel("ADJUSTMENT_OUT")).toBe("Điều chỉnh giảm");
  });

  it("falls back to the raw type for anything unrecognized", () => {
    expect(getTransactionTypeLabel("SOME_NEW_TYPE")).toBe("SOME_NEW_TYPE");
  });
});
