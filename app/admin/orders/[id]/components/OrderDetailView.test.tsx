// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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

  it("shows the dishes as a table on a computer and as cards on a phone", () => {
    render(<OrderDetailView detail={makeDetail()} brands={[]} returnTo="/admin/orders" />);
    const table = screen.getByRole("table");
    expect(table.closest(".hidden.md\\:block")).not.toBeNull();
    const headers = screen.getAllByRole("columnheader").map(h => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(["Món", "Size", "SL", "Thành tiền"]));
    expect(table.textContent).toContain("Cà phê sữa");
    const phone = screen.getByTestId("detail-lines-phone");
    expect(phone.className).toContain("md:hidden");
    expect(phone.textContent).toContain("Cà phê sữa");
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
