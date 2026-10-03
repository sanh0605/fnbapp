import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findById = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/tables", () => ({ findById, findAll: vi.fn().mockResolvedValue([]) }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn().mockResolvedValue({ user: { role: "ADMIN" } }) }));
vi.mock("@/lib/auth/auth", () => ({ authOptions: {} }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("../components/PurchaseOrderForm", () => ({ default: () => null }));
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

describe("purchase order header dates (A10)", () => {
  beforeEach(() => {
    findById.mockReset();
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
