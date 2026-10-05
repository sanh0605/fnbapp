import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findById = vi.hoisted(() => vi.fn());
const getServerSession = vi.hoisted(() => vi.fn().mockResolvedValue({ user: { role: "ADMIN" } }));

vi.mock("@/lib/db/tables", () => ({ findById, findAll: vi.fn().mockResolvedValue([]) }));
vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => ({
    type: "a",
    props: { href, children },
  }),
}));
vi.mock("../components/PurchaseOrderForm", () => ({
  default: () => ({ props: { children: "MOCK_PURCHASE_ORDER_FORM" } }),
}));
vi.mock("@/components/ui/BackLink", () => ({ BackLink: () => null }));
vi.mock("./components/PurchasePaymentBlock", () => ({
  default: ({ paymentMethod }: { paymentMethod?: string }) => ({
    props: {
      children: [
        "Trả bằng: ",
        paymentMethod === "CASH" ? "Tiền mặt" : paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản" : "—",
      ],
    },
  }),
  PurchasePaymentBlock: ({ paymentMethod }: { paymentMethod?: string }) => ({
    props: {
      children: [
        "Trả bằng: ",
        paymentMethod === "CASH" ? "Tiền mặt" : paymentMethod === "BANK_TRANSFER" ? "Chuyển khoản" : "—",
      ],
    },
  }),
}));

import PurchaseOrderDetail from "./page";

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

describe("purchase order header dates (A10)", () => {
  beforeEach(() => {
    findById.mockReset();
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("shows Saigon wall-clock time, and a day-only transaction date as 00:00:00", async () => {
    findById.mockResolvedValue({
      id: "PO-1",
      status: "COMPLETED",
      // 2026-09-14T23:30:00Z = 15/09/2026 06:30:00 Saigon
      created_at: "2026-09-14T23:30:00Z",
      transaction_date: "2026-09-15",
    });
    const tree = await PurchaseOrderDetail({ params: { id: "PO-1" }, searchParams: {} });
    const text = collectText(tree as ReactNode).join("");
    expect(text).toContain("Ngày tạo: 15/09/2026 06:30:00");
    expect(text).toContain("Ngày giao dịch: 15/09/2026 00:00:00");
  });

  it("PO-181 (COMPLETED, CASH) shows Trả bằng: Tiền mặt", async () => {
    findById.mockResolvedValue({
      id: "PO-181",
      status: "COMPLETED",
      payment_method: "CASH",
      created_at: "2026-09-15T00:00:00Z",
    });
    const tree = await PurchaseOrderDetail({ params: { id: "PO-181" }, searchParams: {} });
    const text = collectText(tree as ReactNode).join("");
    expect(text).toContain("Trả bằng: Tiền mặt");
  });
});

describe("purchase order cancellation and permissions (BR-INV-015)", () => {
  beforeEach(() => {
    findById.mockReset();
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("A cancelled order shows details, no form, no Sửa phiếu, no Huỷ phiếu", async () => {
    findById.mockResolvedValue({
      id: "PO-065",
      status: "CANCELLED",
      cancel_reason: "Nhập trùng PO-065",
      cancelled_by_name: "Chủ quán",
      cancelled_at: "2026-10-05T10:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: { id: "PO-065" }, searchParams: {} });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Đã huỷ");
    expect(text).toContain("Lý do huỷ: Nhập trùng PO-065");
    expect(text).toContain("Huỷ bởi Chủ quán");
    expect(text).not.toContain("Sửa phiếu");
    expect(text).not.toContain("Huỷ phiếu");
    expect(text).not.toContain("MOCK_PURCHASE_ORDER_FORM");

    // With searchParams.edit = "1" as ADMIN, it still shows no form
    const treeWithEdit = await PurchaseOrderDetail({ params: { id: "PO-065" }, searchParams: { edit: "1" } });
    const textWithEdit = collectText(treeWithEdit as ReactNode).join(" ");
    expect(textWithEdit).not.toContain("MOCK_PURCHASE_ORDER_FORM");
  });

  it("A STAFF user on a completed order sees no Huỷ phiếu", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "STAFF" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "COMPLETED",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: { id: "PO-147" }, searchParams: {} });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).not.toContain("Huỷ phiếu");
  });

  it("A MANAGER on a draft sees no Huỷ phiếu while the form shows", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "MANAGER" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "DRAFT",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: { id: "PO-147" }, searchParams: {} });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("MOCK_PURCHASE_ORDER_FORM");
    expect(text).not.toContain("Huỷ phiếu");
  });

  it("A MANAGER on a completed order sees Huỷ phiếu linking to /admin/inventory/purchase-orders/PO-147/cancel", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "MANAGER" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "COMPLETED",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: { id: "PO-147" }, searchParams: {} });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("Huỷ phiếu");
    const link = findLink(tree as ReactNode, "Huỷ phiếu");
    expect(link).toBeTruthy();
    expect(link?.href).toBe("/admin/inventory/purchase-orders/PO-147/cancel");
  });
});
