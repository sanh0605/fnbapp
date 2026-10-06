import { describe, expect, it } from "vitest";
import { buildPurchaseOrderCopySeed } from "./purchase-order-copy";

// PO-147: bought from Cửa Hàng B&B Supplier Ly - Bar via Shopee, one Vòi rót rượu line, paid in cash.
const PO_147 = {
  id: "PO-147",
  status: "COMPLETED",
  supplier_id: "SUP-9",
  source_id: "SRC-2",
  supplier_invoice_code: null,
  transaction_date: "2026-08-12T17:00:00Z",
  created_at: "2026-08-13T01:00:00Z",
  notes: "Mua lẻ",
  shipping_fee: "0.000000",
  tax_amount: "0",
  voucher_amount: "35000.000000",
  discount_amount: null,
  payment_method: "CASH",
  bank_account_id: null,
};
const VOI_ROT_RUOU = {
  id: "POL-1",
  purchased_item_id: "PI-80",
  unit: "Cái",
  quantity: "2",
  subtotal: "55200.000000",
  conversion_id: "CONV-5",
  created_at: "2026-08-13T01:00:00Z",
};
const NO_ACCOUNTS = new Set<string>();

describe("buildPurchaseOrderCopySeed", () => {
  it("copies PO-147 (COMPLETED) but leaves the date and invoice code blank", () => {
    const seed = buildPurchaseOrderCopySeed({ order: PO_147, lines: [VOI_ROT_RUOU], activeBankAccountIds: NO_ACCOUNTS });
    expect(seed).toMatchObject({
      sourceOrderId: "PO-147",
      sourceCancelled: false,
      supplier_id: "SUP-9",
      source_id: "SRC-2",
      voucher_amount: 35000,
      payment_method: "CASH",
      transaction_date: null,
      supplier_invoice_code: "",
    });
    expect(seed.lines).toEqual([
      { purchased_item_id: "PI-80", unit: "Cái", quantity: 2, subtotal: 55200, conversion_id: "CONV-5" },
    ]);
  });

  it("keeps the exact transaction time and invoice code of a CANCELLED order", () => {
    const seed = buildPurchaseOrderCopySeed({
      order: { ...PO_147, status: "CANCELLED", supplier_invoice_code: "HD-1" },
      lines: [VOI_ROT_RUOU],
      activeBankAccountIds: NO_ACCOUNTS,
    });
    expect(seed.sourceCancelled).toBe(true);
    expect(seed.transaction_date).toBe("2026-08-12T17:00:00Z");
    expect(seed.supplier_invoice_code).toBe("HD-1");
  });

  it("falls back to created_at when a CANCELLED order has no transaction date", () => {
    const seed = buildPurchaseOrderCopySeed({
      order: { ...PO_147, status: "CANCELLED", transaction_date: null },
      lines: [VOI_ROT_RUOU],
      activeBankAccountIds: NO_ACCOUNTS,
    });
    expect(seed.transaction_date).toBe("2026-08-13T01:00:00Z");
  });

  it("blanks the invoice code of a COMPLETED order", () => {
    const seed = buildPurchaseOrderCopySeed({
      order: { ...PO_147, supplier_invoice_code: "HD-1" },
      lines: [VOI_ROT_RUOU],
      activeBankAccountIds: NO_ACCOUNTS,
    });
    expect(seed.supplier_invoice_code).toBe("");
  });

  it("keeps BANK_TRANSFER but blanks an account that is no longer active", () => {
    const order = { ...PO_147, payment_method: "BANK_TRANSFER", bank_account_id: "BA-2" };
    const stopped = buildPurchaseOrderCopySeed({ order, lines: [], activeBankAccountIds: new Set(["BA-1"]) });
    expect(stopped.payment_method).toBe("BANK_TRANSFER");
    expect(stopped.bank_account_id).toBe("");

    const active = buildPurchaseOrderCopySeed({
      order: { ...order, bank_account_id: "BA-1" },
      lines: [],
      activeBankAccountIds: new Set(["BA-1"]),
    });
    expect(active.bank_account_id).toBe("BA-1");
  });

  it("sorts lines by created_at, then id", () => {
    const line = (id: string, created_at: string | null) => ({ ...VOI_ROT_RUOU, id, purchased_item_id: id, created_at });
    const seed = buildPurchaseOrderCopySeed({
      order: PO_147,
      lines: [
        line("C", "2026-08-13T01:00:02Z"),
        line("B", "2026-08-13T01:00:00Z"),
        line("A", "2026-08-13T01:00:00Z"),
      ],
      activeBankAccountIds: NO_ACCOUNTS,
    });
    expect(seed.lines.map(l => l.purchased_item_id)).toEqual(["A", "B", "C"]);
  });

  it("turns numeric strings into numbers and null fields into safe blanks", () => {
    const seed = buildPurchaseOrderCopySeed({
      order: { ...PO_147, notes: null, shipping_fee: null, tax_amount: null, discount_amount: null, payment_method: "CHEQUE" },
      lines: [{ ...VOI_ROT_RUOU, unit: null, conversion_id: null }],
      activeBankAccountIds: NO_ACCOUNTS,
    });
    expect(seed.voucher_amount).toBe(35000);
    expect(seed.shipping_fee).toBe(0);
    expect(seed.tax_amount).toBe(0);
    expect(seed.discount_amount).toBe(0);
    expect(seed.notes).toBe("");
    expect(seed.payment_method).toBe("");
    expect(seed.lines[0]).toMatchObject({ unit: "", conversion_id: "", quantity: 2, subtotal: 55200 });
  });
});
