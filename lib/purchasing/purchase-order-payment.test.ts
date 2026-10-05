import { describe, expect, it } from "vitest";
import { parsePurchaseOrderPayment } from "./purchase-order-payment";

const ACTIVE = ["BA-001"];

function run(over: Partial<Parameters<typeof parsePurchaseOrderPayment>[0]>) {
  return parsePurchaseOrderPayment({
    status: "COMPLETED",
    method: "",
    bankAccountId: "",
    activeAccountIds: ACTIVE,
    ...over,
  });
}

describe("parsePurchaseOrderPayment", () => {
  it("refuses a completed order with no method: 'Chọn cách trả tiền'", () => {
    expect(run({})).toEqual({ ok: false, error: "Chọn cách trả tiền" });
    expect(run({ method: "SOMETHING_ELSE" })).toEqual({ ok: false, error: "Chọn cách trả tiền" });
  });

  it("lets a draft leave both empty and returns nulls", () => {
    expect(run({ status: "DRAFT" })).toEqual({
      ok: true,
      value: { payment_method: null, bank_account_id: null },
    });
  });

  it("refuses BANK_TRANSFER without an account", () => {
    expect(run({ method: "BANK_TRANSFER" })).toEqual({
      ok: false,
      error: "Chọn tài khoản nhận chuyển khoản",
    });
    // a draft that already chose Chuyển khoản must finish the choice too
    expect(run({ status: "DRAFT", method: "BANK_TRANSFER" })).toEqual({
      ok: false,
      error: "Chọn tài khoản nhận chuyển khoản",
    });
  });

  it("accepts BANK_TRANSFER with an active account", () => {
    expect(run({ method: "BANK_TRANSFER", bankAccountId: "BA-001" })).toEqual({
      ok: true,
      value: { payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" },
    });
  });

  it("clears the account when the method is CASH", () => {
    expect(run({ method: "CASH", bankAccountId: "BA-001" })).toEqual({
      ok: true,
      value: { payment_method: "CASH", bank_account_id: null },
    });
  });

  it("refuses a stopped or unknown account", () => {
    expect(run({ method: "BANK_TRANSFER", bankAccountId: "BA-002" })).toEqual({
      ok: false,
      error: "Tài khoản không còn dùng",
    });
  });

  it("allows a stopped account only when it is the order's own saved account (Review Focus 3)", () => {
    expect(
      run({ method: "BANK_TRANSFER", bankAccountId: "BA-002", currentAccountId: "BA-002" }),
    ).toEqual({ ok: true, value: { payment_method: "BANK_TRANSFER", bank_account_id: "BA-002" } });
    // ... but not for some other stopped account
    expect(
      run({ method: "BANK_TRANSFER", bankAccountId: "BA-003", currentAccountId: "BA-002" }),
    ).toEqual({ ok: false, error: "Tài khoản không còn dùng" });
  });
});
