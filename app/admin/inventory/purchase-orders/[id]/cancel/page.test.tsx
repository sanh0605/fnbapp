import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn());
const getPurchaseOrderCancelView = vi.hoisted(() => vi.fn());

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/components/ui/BackLink", () => ({ BackLink: () => null }));
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => ({
    type: "a",
    props: { href, children },
  }),
}));
vi.mock("../../actions", () => ({
  getPurchaseOrderCancelView,
}));
vi.mock("./components/CancelPurchaseOrderForm", () => ({
  default: () => ({ props: { children: "MOCK_CANCEL_FORM" } }),
}));

import CancelPurchaseOrderPage from "./page";

function collectText(node: ReactNode, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
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

describe("CancelPurchaseOrderPage", () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockReset();
    notFound.mockReset();
    getPurchaseOrderCancelView.mockReset();
  });

  it("STAFF is redirected to the detail page", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "STAFF" } });
    // next/navigation's redirect throws; the page relies on that to stop.
    redirect.mockImplementationOnce(() => { throw new Error("NEXT_REDIRECT"); });

    await expect(CancelPurchaseOrderPage({ params: { id: "PO-147" } })).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/admin/inventory/purchase-orders/PO-147");
    expect(getPurchaseOrderCancelView).not.toHaveBeenCalled();
  });

  it("missing-migration shows Chưa cập nhật dữ liệu, chưa huỷ được phiếu.", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    getPurchaseOrderCancelView.mockResolvedValueOnce({ state: "missing-migration" });

    const tree = await CancelPurchaseOrderPage({ params: { id: "PO-147" } });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("Chưa cập nhật dữ liệu, chưa huỷ được phiếu.");
    expect(text).toContain("Quay lại");
    expect(text).not.toContain("MOCK_CANCEL_FORM");
  });

  it("ready view renders CancelPurchaseOrderForm", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    getPurchaseOrderCancelView.mockResolvedValueOnce({
      state: "ready",
      order: {
        id: "PO-147",
        dateText: "13/08/2026",
        supplierName: "NCC",
        totalAmount: 50000,
        paymentLabel: "Tiền mặt",
        status: "COMPLETED",
      },
      blockedMessages: [],
      assets: [],
    });

    const tree = await CancelPurchaseOrderPage({ params: { id: "PO-147" } });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Huỷ phiếu nhập PO-147");
    expect(text).toContain("MOCK_CANCEL_FORM");
  });
});
