// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import AssetsClient from "./AssetsClient";
import type { AssetItemRow } from "@/lib/assets/asset-items";

const { replace, refresh, push, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    push: pushFn,
    router: { replace: replaceFn, refresh: refreshFn, push: pushFn },
  };
});

let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/admin/inventory/assets",
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

// Real figures from the plan:
// Bình bơm (thuỷ tinh, 1300ml, 10ml/lần): 2 mua, còn 1, đã thanh lý 1, ngày mua 04/04/2026, còn lại 145.860đ
const BINH_BOM: AssetItemRow = {
  itemId: "SPM-BINH",
  name: "Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)",
  quantity: 2,
  remainingQuantity: 1,
  disposedQuantity: 1,
  remainingValue: 145860,
  latestAcquiredDate: "2026-04-04",
  fullyDisposed: false,
};

// Cốc đong 100ml: 3 lần mua (TS-025, TS-030, TS-057), tổng mua 8, còn 6, đã thanh lý 2, mua gần nhất 01/07/2026
const COC_DONG: AssetItemRow = {
  itemId: "SPM-COC",
  name: "Cốc đong 100ml",
  quantity: 8,
  remainingQuantity: 6,
  disposedQuantity: 2,
  remainingValue: 90000,
  latestAcquiredDate: "2026-07-01",
  fullyDisposed: false,
};

// Item with 0 disposals to test the dash '—' in 'Đã thanh lý'
const CA_DONG: AssetItemRow = {
  itemId: "SPM-CA",
  name: "Ca đong chia vạch 500ml",
  quantity: 3,
  remainingQuantity: 3,
  disposedQuantity: 0,
  remainingValue: 150000,
  latestAcquiredDate: "2026-05-15",
  fullyDisposed: false,
};

// Fully disposed item
const KHAY_CU: AssetItemRow = {
  itemId: "SPM-CU",
  name: "Khay inox cũ",
  quantity: 2,
  remainingQuantity: 0,
  disposedQuantity: 2,
  remainingValue: 0,
  latestAcquiredDate: "2026-01-10",
  fullyDisposed: true,
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

describe("AssetsClient", () => {
  it("renders desktop columns in exact order: Mã hàng, Tên, Còn / Đã mua, Đã thanh lý, Giá trị còn lại, Mua gần nhất", () => {
    render(<AssetsClient items={[BINH_BOM, COC_DONG]} />);

    const headers = screen.getAllByRole("columnheader");
    const headerTexts = headers.map((h) => h.textContent?.replace(/[▲▼]/g, "").trim());
    expect(headerTexts).toEqual([
      "Mã hàng",
      "Tên",
      "Còn / Đã mua",
      "Đã thanh lý",
      "Giá trị còn lại",
      "Mua gần nhất",
    ]);
  });

  it("renders formatted numbers and dates for real items (Cốc đong 100ml and Bình bơm)", () => {
    render(<AssetsClient items={[BINH_BOM, COC_DONG, CA_DONG]} />);

    // Cốc đong 100ml: còn 6 / mua 8, đã thanh lý 2, mua gần nhất 01/07/2026
    expect(screen.getAllByText("SPM-COC").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cốc đong 100ml").length).toBeGreaterThan(0);
    expect(screen.getAllByText("6 / 8 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("01/07/2026").length).toBeGreaterThan(0);

    // Bình bơm: còn 1 / mua 2, đã thanh lý 1, giá trị còn lại 145.860đ, mua gần nhất 04/04/2026
    expect(screen.getAllByText("SPM-BINH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 / 2 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("145.860đ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("04/04/2026").length).toBeGreaterThan(0);

    // Ca đong: 0 thanh lý renders as '—'
    expect(screen.getAllByText("SPM-CA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("3 / 3 cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("renders rows linking to /admin/inventory/assets/[itemId]?returnTo=...", () => {
    render(<AssetsClient items={[BINH_BOM]} />);

    const links = screen.getAllByRole("link").filter((l) =>
      l.getAttribute("href")?.startsWith("/admin/inventory/assets/SPM-BINH?returnTo="),
    );
    expect(links.length).toBeGreaterThan(0);
  });

  it("orders items by item code naturally, newest first, by default (BR-DATA-008)", () => {
    const item1 = { ...BINH_BOM, itemId: "SPM-101", name: "Món 101" };
    const item2 = { ...BINH_BOM, itemId: "SPM-9", name: "Món 9" };
    const item3 = { ...BINH_BOM, itemId: "SPM-10", name: "Món 10" };

    render(<AssetsClient items={[item1, item2, item3]} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("SPM-101");
    expect(rows[1]).toHaveTextContent("SPM-10");
    expect(rows[2]).toHaveTextContent("SPM-9");
  });

  it("orders items by item code ascending when sort=itemId&dir=asc", () => {
    mockSearchParams = new URLSearchParams("sort=itemId&dir=asc");
    const item1 = { ...BINH_BOM, itemId: "SPM-101", name: "Món 101" };
    const item2 = { ...BINH_BOM, itemId: "SPM-9", name: "Món 9" };
    const item3 = { ...BINH_BOM, itemId: "SPM-10", name: "Món 10" };

    render(<AssetsClient items={[item1, item2, item3]} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("SPM-9");
    expect(rows[1]).toHaveTextContent("SPM-10");
    expect(rows[2]).toHaveTextContent("SPM-101");
  });

  it("hides fullyDisposed items by default", () => {
    render(<AssetsClient items={[BINH_BOM, KHAY_CU]} />);

    expect(screen.queryByText("Khay inox cũ")).toBeNull();
    expect(screen.queryByText("SPM-CU")).toBeNull();
    expect(screen.getAllByText("Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)").length).toBeGreaterThan(0);
  });

  it("shows fullyDisposed items with badge when ?all=1", () => {
    mockSearchParams = new URLSearchParams("all=1");
    render(<AssetsClient items={[BINH_BOM, KHAY_CU]} />);

    expect(screen.getAllByText("Khay inox cũ").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SPM-CU").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Đã thanh lý hết").length).toBeGreaterThan(0);
  });

  it("filters items by case-insensitive Vietnamese query ?q=", () => {
    mockSearchParams = new URLSearchParams("q=BÌNH bơm");
    render(<AssetsClient items={[BINH_BOM, COC_DONG]} />);

    expect(screen.getAllByText("Bình bơm (thuỷ tinh, 1300ml, 10ml/lần)").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cốc đong 100ml")).toBeNull();
  });

  it("does not render row selection checkboxes or bin/delete buttons", () => {
    render(<AssetsClient items={[BINH_BOM, COC_DONG]} />);

    // Table rows must not contain selection checkboxes
    const table = screen.getByRole("table");
    expect(within(table).queryAllByRole("checkbox")).toHaveLength(0);

    // No delete or bin button
    expect(screen.queryByRole("button", { name: /Xoá/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Trash/i })).toBeNull();
  });

  it("renders phone card with 'Còn 1 / mua 2 · Đã thanh lý 1'", () => {
    render(<AssetsClient items={[BINH_BOM]} />);

    expect(screen.getAllByText("Còn 1 / mua 2 · Đã thanh lý 1").length).toBeGreaterThan(0);
  });

  it("renders empty state when there are no matching items", () => {
    render(<AssetsClient items={[]} />);

    expect(screen.getAllByText(/Không có tài sản/i).length).toBeGreaterThan(0);
  });
});
