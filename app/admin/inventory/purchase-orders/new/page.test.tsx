import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findAll = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const getPurchaseOrderCopySeed = vi.hoisted(() => vi.fn());
const mockPurchaseOrderForm = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/tables", () => ({ findAll }));
vi.mock("../actions", () => ({ getPurchaseOrderCopySeed }));
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => ({
    type: "a",
    props: { href, children },
  }),
}));
vi.mock("../components/PurchaseOrderForm", () => ({
  default: (props: any) => {
    mockPurchaseOrderForm(props);
    return { type: "div", props: { children: "MOCK_PURCHASE_ORDER_FORM" } };
  },
}));
vi.mock("@/components/ui/BackLink", () => ({ BackLink: () => null }));

import NewPurchaseOrderPage from "./page";

function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach(n => collectText(n, out));
    return out;
  }
  const el = node as { type?: any; props?: { children?: ReactNode } };
  if (typeof el?.type === "function") {
    try {
      collectText(el.type(el.props), out);
    } catch {}
  } else if (el?.props) {
    collectText(el.props.children, out);
  }
  return out;
}

function findLink(node: ReactNode, text: string): { href?: string } | null {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  const el = node as { type?: any; props?: { href?: string; children?: ReactNode } };
  if (el?.props) {
    const collected = collectText(el.props.children).join("");
    if (collected.includes(text) && el.props.href) {
      return { href: el.props.href };
    }
    if (Array.isArray(el.props.children)) {
      for (const child of el.props.children) {
        const found = findLink(child, text);
        if (found) return found;
      }
    } else if (el.props.children) {
      const found = findLink(el.props.children, text);
      if (found) return found;
    }
  }
  return null;
}

describe("NewPurchaseOrderPage copyFrom (BR-INV-016)", () => {
  beforeEach(() => {
    findAll.mockReset().mockResolvedValue([]);
    getPurchaseOrderCopySeed.mockReset();
    mockPurchaseOrderForm.mockReset();
  });

  it("with copyFrom 'PO-147' it shows 'Nhân bản từ phiếu' and 'PO-147' and passes copySeed", async () => {
    const sampleSeed = {
      sourceOrderId: "PO-147",
      sourceCancelled: false,
      supplier_id: "SUP-1",
      source_id: "SRC-1",
      supplier_invoice_code: "",
      transaction_date: null,
      notes: "",
      shipping_fee: 0,
      tax_amount: 0,
      voucher_amount: 35000,
      discount_amount: 0,
      payment_method: "CASH",
      bank_account_id: "",
      lines: [
        {
          purchased_item_id: "ITEM-1",
          unit: "Cái",
          quantity: 2,
          subtotal: 55200,
          conversion_id: "CONV-1",
        },
      ],
    };
    getPurchaseOrderCopySeed.mockResolvedValueOnce(sampleSeed);

    const tree = await NewPurchaseOrderPage({ searchParams: { copyFrom: "PO-147" } });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(getPurchaseOrderCopySeed).toHaveBeenCalledWith("PO-147");
    expect(text).toContain("Nhân bản từ phiếu");
    expect(text).toContain("PO-147");

    const link = findLink(tree as ReactNode, "PO-147");
    expect(link).toBeTruthy();
    expect(link?.href).toBe("/admin/inventory/purchase-orders/PO-147");

    expect(mockPurchaseOrderForm).toHaveBeenCalledWith(
      expect.objectContaining({ copySeed: sampleSeed })
    );
  });

  it("with an unknown code it shows 'Không tìm thấy phiếu PO-999 để nhân bản.'", async () => {
    getPurchaseOrderCopySeed.mockResolvedValueOnce(null);

    const tree = await NewPurchaseOrderPage({ searchParams: { copyFrom: "PO-999" } });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(getPurchaseOrderCopySeed).toHaveBeenCalledWith("PO-999");
    expect(text).toContain("Không tìm thấy phiếu PO-999 để nhân bản.");
    expect(text).not.toContain("Nhân bản từ phiếu");

    expect(mockPurchaseOrderForm).toHaveBeenCalledWith(
      expect.objectContaining({ copySeed: undefined })
    );
  });

  it("without copyFrom parameter it renders normal form with no notices", async () => {
    const tree = await NewPurchaseOrderPage({});
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(getPurchaseOrderCopySeed).not.toHaveBeenCalled();
    expect(text).not.toContain("Nhân bản từ phiếu");
    expect(text).not.toContain("Không tìm thấy phiếu");
    expect(mockPurchaseOrderForm).toHaveBeenCalledWith(
      expect.objectContaining({ copySeed: undefined })
    );
  });
});
