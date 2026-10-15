// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerSession } from "next-auth/next";
import { redirect, notFound } from "next/navigation";
import { getOrderDetailV2 } from "@/app/admin/orders/order-detail-actions";
import { render, screen, cleanup } from "@testing-library/react";
import VoidOrderPage from "./page";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Next's redirect/notFound throw to stop the page; the mocks do the same.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => { throw new Error(`redirect:${to}`); }),
  notFound: vi.fn(() => { throw new Error("notFound"); }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/app/admin/orders/order-detail-actions", () => ({
  getOrderDetailV2: vi.fn(),
}));

vi.mock("./components/VoidOrderForm", () => ({
  VoidOrderForm: () => <div data-testid="void-order-form">VoidOrderForm</div>,
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeDetail(status: string = "COMPLETED") {
  return {
    order: {
      id: "ORD-1",
      order_no: "261013001001",
      display_order_no: "261013001001",
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
      lines: [],
    },
    timeline: [],
    events: [],
  };
}

describe("VoidOrderPage (access and validation)", () => {
  it("redirects to /login if user is not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    await expect(VoidOrderPage({ params: Promise.resolve({ id: "ORD-1" }) })).rejects.toThrow("redirect:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects STAFF to the order page", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: "Staff", role: "STAFF" },
    });

    await expect(VoidOrderPage({ params: Promise.resolve({ id: "ORD-1" }) })).rejects.toThrow("redirect:/admin/orders/ORD-1");
  });

  it("calls notFound() if order does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: "Admin", role: "ADMIN" },
    });
    vi.mocked(getOrderDetailV2).mockResolvedValueOnce(null);

    await expect(VoidOrderPage({ params: Promise.resolve({ id: "NONEXISTENT" }) })).rejects.toThrow("notFound");
    expect(notFound).toHaveBeenCalled();
  });

  it("shows refusal message when order is not COMPLETED", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: "Manager", role: "MANAGER" },
    });
    vi.mocked(getOrderDetailV2).mockResolvedValueOnce(makeDetail("VOIDED") as any);

    render(await VoidOrderPage({ params: Promise.resolve({ id: "ORD-1" }) }));
    expect(screen.getByText("Đơn này không huỷ được")).toBeDefined();
    expect(screen.queryByTestId("void-order-form")).toBeNull();
  });

  it("renders DetailHeader and VoidOrderForm for COMPLETED order", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: { name: "Admin", role: "ADMIN" },
    });
    vi.mocked(getOrderDetailV2).mockResolvedValueOnce(makeDetail("COMPLETED") as any);

    render(await VoidOrderPage({ params: Promise.resolve({ id: "ORD-1" }) }));
    expect(screen.getByRole("heading", { name: "Huỷ đơn 261013001001" })).toBeDefined();
    expect(screen.getByTestId("void-order-form")).toBeDefined();
  });
});
