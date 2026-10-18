// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { OrderDetailView } from "./OrderDetailView";
import type { OrderDetailV2Result } from "@/app/admin/orders/order-detail-actions";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

function makeDetail(
  status: string = "COMPLETED",
  orderOverrides?: Partial<OrderDetailV2Result["order"]>
): OrderDetailV2Result {
  return {
    order: {
      id: "ORD-1",
      order_no: "#1",
      display_order_no: "ORD000001",
      brand_id: "BRD-1",
      status,
      version: 1,
      parent_order_id: "",
      gross_total: 50000,
      promo_discount_total: 0,
      manual_item_discount_total: 0,
      manual_order_discount: 0,
      net_total: 50000,
      payments: [],
      method: "Tien mat",
      created_by_name: "Thu ngân 1",
      created_at: "2026-10-01T10:00:00.000Z",
      lines: [
        {
          id: "line-1",
          order_id: "ORD-1",
          line_no: 1,
          product_id: "PROD-1",
          product_snapshot_json: "{}",
          variant_id: "VAR-1",
          variant_snapshot_json: "{}",
          qty: 1,
          unit_price: 50000,
          modifiers_snapshot_json: "[]",
          gross_line_total: 50000,
          promo_discount: 0,
          manual_item_discount: 0,
          order_discount_allocation: 0,
          net_line_total: 50000,
          promo_discount_reason: "",
          product_name: "Cà phê sữa",
          size_name: "M",
          modifiers: [],
        },
      ],
      ...orderOverrides,
    },
    timeline: [],
    events: [],
    promotions: [],
  };
}

describe("OrderDetailView", () => {
  it("shows Sửa đơn and Huỷ đơn links in DetailHeader for COMPLETED order", () => {
    const detail = makeDetail("COMPLETED");
    const brands = [{ id: "BRD-1", name: "Phin Đi" }];
    const returnTo = "/admin/orders?payment=Tien+mat";

    render(<OrderDetailView detail={detail} brands={brands} returnTo={returnTo} />);

    expect(screen.getByText("ORD000001")).toBeDefined();
    expect(screen.getByText("Phin Đi")).toBeDefined();

    const editLink = screen.getByRole("link", { name: "Sửa đơn" });
    expect(editLink).toBeDefined();
    expect(editLink.getAttribute("href")).toBe(
      `/admin/orders/ORD-1/edit?returnTo=${encodeURIComponent(returnTo)}`
    );

    const voidLink = screen.getByRole("link", { name: "Huỷ đơn" });
    expect(voidLink).toBeDefined();
    expect(voidLink.getAttribute("href")).toBe(
      `/admin/orders/ORD-1/void?returnTo=${encodeURIComponent(returnTo)}`
    );
  });

  it("does not show Sửa đơn or Huỷ đơn for VOIDED order", () => {
    const detail = makeDetail("VOIDED");
    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    expect(screen.queryByRole("link", { name: "Sửa đơn" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Huỷ đơn" })).toBeNull();
    expect(screen.getByText("Đã huỷ")).toBeDefined();
  });

  it("shows void reason for a VOIDED order", () => {
    const detail: OrderDetailV2Result = {
      ...makeDetail("VOIDED"),
      events: [
        {
          id: "evt-void",
          order_id: "ORD-1",
          event_type: "VOIDED",
          event_at: "2026-10-01T10:10:00.000Z",
          actor_id: "usr-1",
          actor_name: "Quản lý 1",
          from_version: 1,
          to_version: 1,
          previous_order_id: "",
          delta_json: "{}",
          reason: "Khách đổi ý sang quán khác",
        },
      ],
    };
    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    expect(screen.getByText("Lý do huỷ:", { exact: false })).toBeDefined();
    expect(screen.getAllByText(/Khách đổi ý sang quán khác/).length).toBeGreaterThan(0);
    expect(screen.getByText("Đã huỷ")).toBeDefined();
  });

  it("shows Vietnamese event names in events card", () => {
    const detail: OrderDetailV2Result = {
      ...makeDetail("COMPLETED"),
      events: [
        {
          id: "evt-1",
          order_id: "ORD-1",
          event_type: "CREATED",
          event_at: "2026-10-01T10:00:00.000Z",
          actor_id: "usr-1",
          actor_name: "Thu ngân 1",
          from_version: 1,
          to_version: 1,
          previous_order_id: "",
          delta_json: "{}",
          reason: "Tạo đơn",
        },
        {
          id: "evt-2",
          order_id: "ORD-1",
          event_type: "EDITED",
          event_at: "2026-10-01T10:05:00.000Z",
          actor_id: "usr-1",
          actor_name: "Thu ngân 1",
          from_version: 1,
          to_version: 2,
          previous_order_id: "",
          delta_json: "{}",
          reason: "Đổi phương thức thanh toán",
        },
        {
          id: "evt-3",
          order_id: "ORD-1",
          event_type: "VOIDED",
          event_at: "2026-10-01T10:10:00.000Z",
          actor_id: "usr-1",
          actor_name: "Quản lý 1",
          from_version: 2,
          to_version: 2,
          previous_order_id: "",
          delta_json: "{}",
          reason: "Khách huỷ",
        },
        {
          id: "evt-4",
          order_id: "ORD-1",
          event_type: "MIGRATED",
          event_at: "2026-10-01T10:15:00.000Z",
          actor_id: "usr-1",
          actor_name: "Hệ thống",
          from_version: 1,
          to_version: 1,
          previous_order_id: "",
          delta_json: "{}",
          reason: "Chuyển từ bản cũ",
        },
      ],
    };

    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    expect(screen.getByText("Tạo")).toBeDefined();
    expect(screen.getByText("Sửa")).toBeDefined();
    expect(screen.getByText("Huỷ")).toBeDefined();
    expect(screen.getByText("Chuyển dữ liệu cũ")).toBeDefined();
  });

  it("renders version tag and staff name with Badge", () => {
    const detail = makeDetail("COMPLETED", { version: 2, created_by_name: "Thu ngân A" });
    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    expect(screen.getByText("v2")).toBeDefined();
    expect(screen.getByText("Thu ngân A")).toBeDefined();
  });
});

describe("OrderDetailView on a computer (BR-UI-012, owner 2026-10-14)", () => {
  it("fills the frame: no narrower box of its own", () => {
    const { container } = render(<OrderDetailView detail={makeDetail()} brands={[]} returnTo="/admin/orders" />);
    for (const el of Array.from(container.querySelectorAll("[class]"))) {
      expect(el.getAttribute("class")).not.toMatch(/(?:^|\s)max-w-(?:[2-7]xl|screen-)/);
    }
  });

  it("lays the dishes on the left two thirds and the money on the right", () => {
    render(<OrderDetailView detail={makeDetail()} brands={[]} returnTo="/admin/orders" />);
    const layout = screen.getByTestId("detail-layout");
    expect(layout.className).toContain("grid-cols-1");
    expect(layout.className).toContain("lg:grid-cols-3");
    const lines = screen.getByTestId("detail-lines");
    expect(lines.className).toContain("lg:col-span-2");
    const side = screen.getByTestId("detail-side");
    expect(side.textContent).toContain("Khách trả");
    // Sửa đơn and Huỷ đơn are in DetailHeader right corner
    expect(screen.getByRole("link", { name: "Sửa đơn" })).toBeDefined();
    expect(screen.getByRole("link", { name: "Huỷ đơn" })).toBeDefined();
  });

  it("shows the dishes as a table on a computer and as a divide-y list of PhoneRow on a phone", () => {
    render(<OrderDetailView detail={makeDetail()} brands={[]} returnTo="/admin/orders" />);
    const table = screen.getByRole("table");
    expect(table.closest(".hidden.md\\:block")).not.toBeNull();
    const headers = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Món", "Size", "SL", "Thành tiền"]));
    expect(table.textContent).toContain("Cà phê sữa");

    const phone = screen.getByTestId("detail-lines-phone");
    expect(phone.className).toContain("md:hidden");
    expect(phone.className).toContain("divide-y");
    expect(phone.className).not.toContain("space-y");

    const firstRow = phone.firstElementChild as HTMLElement;
    expect(firstRow).toBeInTheDocument();
    expect(firstRow.className).toContain("px-4");
    expect(firstRow.className).toContain("py-2.5");
    expect(firstRow.className).not.toContain("rounded-xl");
    expect(firstRow.className).not.toContain("p-3");

    // Line 1: dish title and formatted price with currency
    expect(within(firstRow).getByText("Cà phê sữa")).toBeInTheDocument();
    expect(within(firstRow).getByText("50,000đ")).toBeInTheDocument();
    // Line 2: quantity and size in meta
    expect(within(firstRow).getByText("1 × Size M")).toBeInTheDocument();
    // No bold classes inside list rows (BR-UI-003)
    expect(firstRow.querySelector(".font-bold")).toBeNull();
  });

  it("hides Tuỳ chọn and Giảm columns when empty for all rows, shows them when present (audit d60)", () => {
    // 1. All empty: no Tuỳ chọn and no Giảm header
    const { unmount } = render(<OrderDetailView detail={makeDetail()} brands={[]} returnTo="/admin/orders" />);
    const headersEmpty = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headersEmpty).not.toContain("Tuỳ chọn");
    expect(headersEmpty).not.toContain("Giảm");
    unmount();

    // 2. With modifiers and discount: shows Tuỳ chọn and Giảm
    const detailWithModAndDiscount = makeDetail("COMPLETED", {
      lines: [
        {
          id: "line-2",
          order_id: "ORD-1",
          line_no: 1,
          product_id: "PROD-1",
          product_snapshot_json: "{}",
          variant_id: "VAR-1",
          variant_snapshot_json: "{}",
          qty: 1,
          unit_price: 50000,
          modifiers_snapshot_json: "[]",
          gross_line_total: 55000,
          promo_discount: 5000,
          manual_item_discount: 0,
          order_discount_allocation: 0,
          net_line_total: 50000,
          promo_discount_reason: "",
          product_name: "Trà sữa",
          size_name: "L",
          modifiers: [{ name: "Trân châu đen", qty: 1 }],
        },
      ],
    });
    render(<OrderDetailView detail={detailWithModAndDiscount} brands={[]} returnTo="/admin/orders" />);
    const headersWithData = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headersWithData).toContain("Tuỳ chọn");
    expect(headersWithData).toContain("Giảm");
  });
});

describe("OrderDetailView payment parts (BR-SALE-013, owner 2026-10-14 C12)", () => {
  it("shows both parts with amounts when payments has two or more entries", () => {
    const detail = makeDetail("COMPLETED", {
      method: "Tien mat",
      gross_total: 18000,
      net_total: 18000,
      payments: [
        { method: "CASH", amount: 9000 },
        { method: "BANK_TRANSFER", amount: 9000 },
      ],
    });

    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    // Shows both parts formatted with amounts
    const badge = screen.getByText("Tiền mặt 9,000đ • Chuyển khoản 9,000đ");
    expect(badge).toBeInTheDocument();

    // Verify it is in detail-side, which is displayed on both desktop and phone
    const side = screen.getByTestId("detail-side");
    expect(side).toContainElement(badge);
    expect(side.closest(".hidden")).toBeNull();
  });

  it("still shows only 'Tiền mặt' (or 'Chuyển khoản') when payments has one entry or is undefined", () => {
    const singleCashDetail = makeDetail("COMPLETED", {
      method: "Tien mat",
      payments: [{ method: "CASH", amount: 50000 }],
    });

    const { unmount } = render(
      <OrderDetailView detail={singleCashDetail} brands={[]} returnTo="/admin/orders" />
    );

    expect(screen.getByText("Tiền mặt")).toBeInTheDocument();
    expect(screen.queryByText(/•/)).toBeNull();

    unmount();

    const singleTransferDetail = makeDetail("COMPLETED", {
      method: "Chuyen khoan",
    });

    render(
      <OrderDetailView detail={singleTransferDetail} brands={[]} returnTo="/admin/orders" />
    );

    expect(screen.getByText("Chuyển khoản")).toBeInTheDocument();
    expect(screen.queryByText(/•/)).toBeNull();
  });
});

describe("OrderDetailView promotions (Phiếu G7)", () => {
  it("order page shows two promotion lines", () => {
    const detail: OrderDetailV2Result = {
      ...makeDetail("COMPLETED", {
        gross_total: 54000,
        promo_discount_total: 25100,
        net_total: 28900,
      }),
      promotions: [
        {
          promotion_id: "PRM-1",
          seq: 1,
          name: "202607 - GIẢM 10K",
          code: "",
          amount: 20000,
        },
        {
          promotion_id: "PRM-2",
          seq: 2,
          name: "KHAITRUONG",
          code: "KHAITRUONG",
          amount: 5100,
        },
      ],
    };

    render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);

    expect(screen.getByText("202607 - GIẢM 10K")).toBeInTheDocument();
    expect(screen.getByText("-20,000đ")).toBeInTheDocument();
    expect(screen.getByText("KHAITRUONG")).toBeInTheDocument();
    expect(screen.getByText("-5,100đ")).toBeInTheDocument();
    expect(screen.queryByText("Khuyến mãi hệ thống")).toBeNull();
  });

  it("does not use sub-12px text (e.g. text-[11px]) on discounted lines (BR-UI-014)", () => {
    const detail = makeDetail("COMPLETED", {
      lines: [
        {
          id: "line-1",
          order_id: "ORD-1",
          line_no: 1,
          product_id: "PROD-1",
          product_snapshot_json: "{}",
          variant_id: "VAR-1",
          variant_snapshot_json: "{}",
          qty: 1,
          unit_price: 50000,
          modifiers_snapshot_json: "[]",
          gross_line_total: 60000,
          promo_discount: 10000,
          manual_item_discount: 0,
          order_discount_allocation: 0,
          net_line_total: 50000,
          promo_discount_reason: "",
          product_name: "Cà phê sữa",
          size_name: "M",
          modifiers: [],
        },
      ],
    });
    const { container } = render(<OrderDetailView detail={detail} brands={[]} returnTo="/admin/orders" />);
    expect(container.querySelector(".text-\\[11px\\]")).toBeNull();
  });

  it("shows the order time, then ' · ', then the brand name in the subtitle under the title", () => {
    const detail = makeDetail("COMPLETED");
    const brands = [{ id: "BRD-1", name: "Phin Đi" }];
    const { container } = render(
      <OrderDetailView detail={detail} brands={brands} returnTo="/admin/orders" />
    );

    const titleEl = screen.getByText("ORD000001");
    const headerCol = titleEl.closest(".flex.flex-col.gap-1");
    const subtitleEl = headerCol?.querySelector(".text-sm.text-text-secondary");
    expect(subtitleEl).toBeInTheDocument();
    expect(subtitleEl?.textContent).toBe("01/10/2026 17:00:00 · Phin Đi");
  });
});

