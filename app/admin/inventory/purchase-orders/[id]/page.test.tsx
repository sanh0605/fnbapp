import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findById = vi.hoisted(() => vi.fn());
const findAll = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const fetchPurchaseOrderCancelCheck = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ blocked: [], assets: [] })
);
const getServerSession = vi.hoisted(() => vi.fn().mockResolvedValue({ user: { role: "ADMIN" } }));

vi.mock("@/lib/db/tables", () => ({ findById, findAll }));
vi.mock("@/lib/purchasing/purchase-order-cancel-transaction", () => ({
  fetchPurchaseOrderCancelCheck,
}));
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
// The back link is drawn as a plain link so its target can be read (returnTo, wave K3).
vi.mock("@/components/ui/BackLink", () => ({
  BackLink: ({ href, label }: { href: string; label: string }) => ({ type: "a", props: { href, children: label } }),
}));
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
import { PhoneRow } from "@/components/ui/list/PhoneRow";

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
  if (el?.props?.href && collectText(el.props.children).join("").includes(text)) return { href: el.props.href };
  // Template components (DetailHeader, Button) carry links in props other than children.
  if (typeof el?.type === "function") {
    try {
      return findLink(el.type(el.props), text);
    } catch {
      return null;
    }
  }
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
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-1" }), searchParams: Promise.resolve({}) });
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
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-181" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join("");
    expect(text).toContain("Trả bằng: Tiền mặt");
  });

  it("shows — instead of N/A when transaction_date is absent", async () => {
    findById.mockResolvedValue({
      id: "PO-1",
      status: "COMPLETED",
      created_at: "2026-09-14T23:30:00Z",
      transaction_date: null,
    });
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-1" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join("");
    expect(text).toContain("Ngày giao dịch: —");
    expect(text).not.toContain("N/A");
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

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-065" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Đã huỷ");
    expect(text).toContain("Lý do huỷ: Nhập trùng PO-065");
    expect(text).toContain("Huỷ bởi Chủ quán");
    expect(text).not.toContain("Sửa phiếu");
    expect(text).not.toContain("Huỷ phiếu");
    expect(text).not.toContain("MOCK_PURCHASE_ORDER_FORM");

    // With searchParams.edit = "1" as ADMIN, it still shows no form
    const treeWithEdit = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-065" }), searchParams: Promise.resolve({ edit: "1" }) });
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

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).not.toContain("Huỷ phiếu");
  });

  // Owner 2026-10-08 "A": a draft always opens as the form, which had no way
  // out; its form now shows Huỷ phiếu to the same cancel page (BR-INV-015).
  // This test used to pin the opposite.
  it("A MANAGER on a draft sees Huỷ phiếu beside the form, linking to the cancel page", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "MANAGER" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "DRAFT",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("MOCK_PURCHASE_ORDER_FORM");
    expect(findLink(tree as ReactNode, "Huỷ phiếu")?.href).toBe("/admin/inventory/purchase-orders/PO-147/cancel");
  });

  it("A STAFF user on a draft sees the form but no Huỷ phiếu", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "STAFF" } });
    findById.mockResolvedValue({ id: "PO-147", status: "DRAFT", created_at: "2026-10-01T00:00:00Z" });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("MOCK_PURCHASE_ORDER_FORM");
    expect(text).not.toContain("Huỷ phiếu");
  });

  it("An ADMIN editing a completed order (?edit=1) sees no Huỷ phiếu while the form shows", async () => {
    findById.mockResolvedValue({ id: "PO-147", status: "COMPLETED", created_at: "2026-10-01T00:00:00Z" });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({ edit: "1" }) });
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

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("Huỷ phiếu");
    const link = findLink(tree as ReactNode, "Huỷ phiếu");
    expect(link).toBeTruthy();
    expect(link?.href).toBe("/admin/inventory/purchase-orders/PO-147/cancel");
  });
});

describe("purchase order clone link (BR-INV-016)", () => {
  beforeEach(() => {
    findById.mockReset();
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("MANAGER on COMPLETED sees 'Nhân bản' linking to /admin/inventory/purchase-orders/new?copyFrom=PO-147", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "MANAGER" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "COMPLETED",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("Nhân bản");
    const link = findLink(tree as ReactNode, "Nhân bản");
    expect(link).toBeTruthy();
    expect(link?.href).toBe("/admin/inventory/purchase-orders/new?copyFrom=PO-147");
  });

  it("ADMIN on CANCELLED sees 'Nhân bản' linking to /admin/inventory/purchase-orders/new?copyFrom=PO-147", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "CANCELLED",
      cancel_reason: "Huỷ vì trùng",
      cancelled_by_name: "Chủ quán",
      cancelled_at: "2026-10-05T10:00:00Z",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("Nhân bản");
    const link = findLink(tree as ReactNode, "Nhân bản");
    expect(link).toBeTruthy();
    expect(link?.href).toBe("/admin/inventory/purchase-orders/new?copyFrom=PO-147");
  });

  it("STAFF does not see 'Nhân bản'", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "STAFF" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "COMPLETED",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).not.toContain("Nhân bản");
    const link = findLink(tree as ReactNode, "Nhân bản");
    expect(link).toBeNull();
  });

  it("A DRAFT (form showing) does not see 'Nhân bản'", async () => {
    getServerSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });
    findById.mockResolvedValue({
      id: "PO-147",
      status: "DRAFT",
      created_at: "2026-10-01T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-147" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).toContain("MOCK_PURCHASE_ORDER_FORM");
    expect(text).not.toContain("Nhân bản");
    const link = findLink(tree as ReactNode, "Nhân bản");
    expect(link).toBeNull();
  });
});

// Review Focus 4 (wave K3): an order opened from a filtered list goes back to that list.
describe("purchase order back link (returnTo)", () => {
  beforeEach(() => {
    findById.mockReset();
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
    findById.mockResolvedValue({ id: "PO-065", status: "CANCELLED", created_at: "2026-10-01T00:00:00Z" });
  });

  it("follows a returnTo inside the purchase-order list", async () => {
    const tree = await PurchaseOrderDetail({
      params: Promise.resolve({ id: "PO-065" }),
      searchParams: Promise.resolve({ returnTo: "/admin/inventory/purchase-orders?status=CANCELLED&page=2" }),
    });
    expect(findLink(tree as ReactNode, "Phiếu nhập")?.href).toBe("/admin/inventory/purchase-orders?status=CANCELLED&page=2");
  });

  it("ignores a returnTo that leaves the purchase-order list", async () => {
    for (const bad of ["https://evil.example/x", "//evil.example", "/admin/users", "/admin/inventory/purchase-orders-x"]) {
      const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-065" }), searchParams: Promise.resolve({ returnTo: bad }) });
      expect(findLink(tree as ReactNode, "Phiếu nhập")?.href).toBe("/admin/inventory/purchase-orders");
    }
  });

  it("with no returnTo goes back to the bare list", async () => {
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-065" }), searchParams: Promise.resolve({}) });
    expect(findLink(tree as ReactNode, "Phiếu nhập")?.href).toBe("/admin/inventory/purchase-orders");
  });
});

// K3 review finding 3: when the order saved but its assets did not, the form
// lands on the order's page with ?assetWarning=1 and the page says so.
describe("purchase order asset warning (BR-COGS-008)", () => {
  beforeEach(() => {
    findById.mockReset();
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  const warning = "Phiếu đã lưu, nhưng tài sản sinh từ phiếu này chưa ghi được.";

  it("?assetWarning=1 shows that the assets were not written", async () => {
    findById.mockResolvedValue({ id: "PO-100", status: "COMPLETED", created_at: "2026-09-20T00:00:00Z" });
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-100" }), searchParams: Promise.resolve({ assetWarning: "1" }) as any });
    expect(collectText(tree as ReactNode).join("")).toContain(warning);
  });

  it("without it the page says nothing about assets", async () => {
    findById.mockResolvedValue({ id: "PO-100", status: "COMPLETED", created_at: "2026-09-20T00:00:00Z" });
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-100" }), searchParams: Promise.resolve({}) });
    expect(collectText(tree as ReactNode).join("")).not.toContain(warning);
  });
});

describe("purchase order supplier name display", () => {
  beforeEach(() => {
    findById.mockReset();
    findAll.mockReset();
    findAll.mockResolvedValue([]);
    fetchPurchaseOrderCancelCheck.mockReset();
    fetchPurchaseOrderCancelCheck.mockResolvedValue({ blocked: [], assets: [] });
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("shows the supplier's name looked up from loaded suppliers", async () => {
    findById.mockResolvedValue({
      id: "PO-1",
      supplier_id: "SUP-1",
      status: "COMPLETED",
      created_at: "2026-09-15T00:00:00Z",
    });
    findAll.mockImplementation(async (table: string) => {
      if (table === "Suppliers") return [{ id: "SUP-1", name: "Công ty Cà Phê" }];
      return [];
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-1" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");
    expect(text).toContain("Nhà cung cấp");
    expect(text).toContain("Công ty Cà Phê");
  });

  it("shows Không rõ when supplier is not found", async () => {
    findById.mockResolvedValue({
      id: "PO-1",
      supplier_id: "SUP-UNKNOWN",
      status: "COMPLETED",
      created_at: "2026-09-15T00:00:00Z",
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-1" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");
    expect(text).toContain("Nhà cung cấp");
    expect(text).toContain("Không rõ");
  });
});

describe("purchase order stocktake lock (BR-INV-018)", () => {
  beforeEach(() => {
    findById.mockReset();
    findAll.mockReset();
    findAll.mockResolvedValue([]);
    fetchPurchaseOrderCancelCheck.mockReset();
    fetchPurchaseOrderCancelCheck.mockResolvedValue({ blocked: [], assets: [] });
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("hides Sửa phiếu and Huỷ phiếu when locked by stocktake, shows Alert with blocker wording, and keeps Nhân bản", async () => {
    findById.mockResolvedValue({
      id: "PO-100",
      status: "COMPLETED",
      created_at: "2026-08-05T00:00:00Z",
      transaction_date: "2026-08-05",
    });
    fetchPurchaseOrderCancelCheck.mockResolvedValue({
      blocked: [
        {
          code: "STOCKTAKE",
          stocktakeId: "STK-001",
          confirmedAt: "2026-08-09T00:00:00Z",
          orderAt: "2026-08-05T00:00:00Z",
        },
      ],
      assets: [],
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-100" }), searchParams: Promise.resolve({}) });
    const text = collectText(tree as ReactNode).join(" ");

    expect(text).not.toContain("Sửa phiếu");
    expect(text).not.toContain("Huỷ phiếu");
    expect(text).toContain("Nhân bản");
    expect(text).toContain("nằm trước lần kiểm kê STK-001");
    expect(text).toContain("nên không huỷ được: lần kiểm kê đã đếm lại hàng trên kệ.");
  });
});

describe("edit form stopped suppliers and items (BR-CATALOG-007)", () => {
  const tables: Record<string, unknown[]> = {
    Suppliers: [
      { id: "S-OK", status: "ACTIVE" },
      { id: "S-OFF", status: "INACTIVE" },
      { id: "S-OFF-OTHER", status: "INACTIVE" },
    ],
    Purchased_Items: [
      { id: "I-OK", status: "ACTIVE" },
      { id: "I-OFF", status: "INACTIVE" },
      { id: "I-OFF-OTHER", status: "INACTIVE" },
    ],
    Purchase_Order_Lines: [{ purchase_order_id: "PO-9", purchased_item_id: "I-OFF" }],
  };
  // The mocked form is a plain function, so the element's props are read straight off the tree.
  const findForm = (node: any): any =>
    !node || typeof node !== "object" ? null
      : node.props?.suppliers ? node
      : [].concat(node.props?.children ?? []).map(findForm).find(Boolean) ?? null;

  it("lists the order's own stopped supplier and items, and no other stopped ones", async () => {
    findAll.mockImplementation(async (t: string) => tables[t] ?? []);
    findById.mockResolvedValue({ id: "PO-9", status: "DRAFT", supplier_id: "S-OFF", created_at: "2026-10-01T00:00:00Z" });
    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-9" }), searchParams: Promise.resolve({ edit: "1" }) });
    const form = findForm(tree);
    expect(form.props.suppliers.map((s: any) => s.id)).toEqual(["S-OK", "S-OFF"]);
    expect(form.props.items.map((i: any) => i.id)).toEqual(["I-OK", "I-OFF"]);
    findAll.mockReset().mockResolvedValue([]);
  });
});

function findElementByClassName(node: ReactNode, classNameSubstr: string): any | null {
  if (!node || typeof node !== "object") return null;
  const el = node as any;
  if (typeof el.props?.className === "string" && el.props.className.includes(classNameSubstr)) {
    return el;
  }
  if (Array.isArray(el)) {
    for (const child of el) {
      const found = findElementByClassName(child, classNameSubstr);
      if (found) return found;
    }
  } else if (el.props?.children) {
    if (Array.isArray(el.props.children)) {
      for (const child of el.props.children) {
        const found = findElementByClassName(child, classNameSubstr);
        if (found) return found;
      }
    } else {
      return findElementByClassName(el.props.children, classNameSubstr);
    }
  }
  return null;
}

describe("purchase order line items on phone (Task 4)", () => {
  beforeEach(() => {
    findById.mockReset();
    findAll.mockReset();
    findAll.mockResolvedValue([]);
    fetchPurchaseOrderCancelCheck.mockReset();
    fetchPurchaseOrderCancelCheck.mockResolvedValue({ blocked: [], assets: [] });
    getServerSession.mockResolvedValue({ user: { role: "ADMIN" } });
  });

  it("renders line items inside md:hidden as a divide-y list of PhoneRow with px-4 py-2.5", async () => {
    findById.mockResolvedValue({
      id: "PO-1",
      status: "COMPLETED",
      created_at: "2026-09-15T00:00:00Z",
      transaction_date: "2026-09-15",
      subtotal_amount: 380000,
      total_amount: 380000,
    });
    findAll.mockImplementation(async (table: string) => {
      if (table === "Purchase_Order_Lines") {
        return [
          {
            po_id: "PO-1",
            purchased_item_id: "ITEM-1",
            unit: "UNT-HOP",
            quantity: 10,
            unit_price: 38000,
            subtotal: 380000,
          },
        ];
      }
      if (table === "Purchased_Items") {
        return [{ id: "ITEM-1", name: "Sữa đặc Ông Thọ" }];
      }
      if (table === "Units") {
        return [{ id: "UNT-HOP", name: "hộp" }];
      }
      return [];
    });

    const tree = await PurchaseOrderDetail({ params: Promise.resolve({ id: "PO-1" }), searchParams: Promise.resolve({}) });
    const phoneContainer = findElementByClassName(tree as ReactNode, "md:hidden");
    expect(phoneContainer).not.toBeNull();
    expect(phoneContainer.props.className).toContain("divide-y");

    const rows = Array.isArray(phoneContainer.props.children)
      ? phoneContainer.props.children
      : [phoneContainer.props.children];
    expect(rows.length).toBe(1);

    const firstRow = rows[0];
    expect(firstRow.props.className).toContain("px-4");
    expect(firstRow.props.className).toContain("py-2.5");
    expect(firstRow.props.className).not.toContain("p-4");

    const phoneRow = firstRow.props.children;
    expect(phoneRow.type).toBe(PhoneRow);
    expect(phoneRow.props.title).toBe("Sữa đặc Ông Thọ");
    expect(phoneRow.props.value).toBe("380,000đ");
    expect(phoneRow.props.meta).toBe("10 hộp × 38,000đ");
  });
});

