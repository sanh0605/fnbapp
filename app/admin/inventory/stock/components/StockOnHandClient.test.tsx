// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import StockOnHandClient from "./StockOnHandClient";
import type { StockOnHandRow } from "@/lib/stock/stock-on-hand";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const { replace, router, getSearchParams, setSearchParams } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  let currentSearchParams = new URLSearchParams();
  return {
    replace: replaceFn,
    router: { replace: replaceFn },
    getSearchParams: () => currentSearchParams,
    setSearchParams: (params: string | URLSearchParams) => {
      currentSearchParams = typeof params === "string" ? new URLSearchParams(params) : params;
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin/inventory/stock",
  useSearchParams: () => getSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const SAMPLE_ROWS: StockOnHandRow[] = [
  {
    itemId: "ITM-01",
    name: "Sữa chua không đường Vinamilk",
    categoryName: "Nguyên liệu",
    onHand: 1100,
    unitName: "g",
    value: 74414,
    daysLeft: 5,
    lastCountedAt: "2026-08-09T00:00:00.000Z",
    inactive: false,
  },
  {
    itemId: "ITM-02",
    name: "Bột cà phê truyền thống Phin Đậm",
    categoryName: "Nguyên liệu",
    onHand: 2500,
    unitName: "g",
    value: 368340,
    daysLeft: 10,
    lastCountedAt: "2026-08-09T00:00:00.000Z",
    inactive: false,
  },
  {
    itemId: "ITM-03",
    name: "Trứng gà",
    categoryName: "Nguyên liệu",
    onHand: 236,
    unitName: "trái",
    value: 590018,
    daysLeft: 14,
    lastCountedAt: "2026-08-09T00:00:00.000Z",
    inactive: false,
  },
  {
    itemId: "ITM-04",
    name: "Ly Uchako - 700ml",
    categoryName: "Vật tư tiêu hao",
    onHand: 1650,
    unitName: "cái",
    value: 2053982,
    daysLeft: 330,
    lastCountedAt: null,
    inactive: false,
  },
  {
    itemId: "ITM-05",
    name: "Syrup Vani",
    categoryName: "Nguyên liệu",
    onHand: 0,
    unitName: "chai",
    value: 0,
    daysLeft: "OUT",
    lastCountedAt: null,
    inactive: false,
  },
  {
    itemId: "ITM-06",
    name: "Muỗng gỗ",
    categoryName: "Vật tư tiêu hao",
    onHand: 50,
    unitName: "cái",
    value: 25000,
    daysLeft: null,
    lastCountedAt: "2026-07-01T00:00:00.000Z",
    inactive: false,
  },
  {
    itemId: "ITM-07",
    name: "Hạt chia",
    categoryName: "Nguyên liệu",
    onHand: -5,
    unitName: "g",
    value: null,
    daysLeft: null,
    lastCountedAt: null,
    inactive: false,
  },
  {
    itemId: "ITM-08",
    name: "Hạt sen sấy",
    categoryName: "Nguyên liệu",
    onHand: 10,
    unitName: "g",
    value: 15000,
    daysLeft: null,
    lastCountedAt: null,
    inactive: true,
  },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  replace.mockClear();
  setSearchParams("");
});

describe("StockOnHandClient", () => {
  it("renders labels correctly ('khoảng 10 ngày', 'Hết', '—', 'Chưa kiểm lần nào')", () => {
    render(
      <StockOnHandClient
        total={18013339}
        unpricedCount={0}
        rows={SAMPLE_ROWS}
      />,
    );

    // "khoảng 10 ngày"
    expect(screen.getAllByText("khoảng 10 ngày").length).toBeGreaterThan(0);

    // "Hết" with warning badge
    const hetElements = screen.getAllByText("Hết");
    expect(hetElements.length).toBeGreaterThan(0);
    expect(hetElements[0].className).toContain("text-warning");

    // Few days (<= 7) like "khoảng 5 ngày" also has warning colour
    const fiveDaysElements = screen.getAllByText("khoảng 5 ngày");
    expect(fiveDaysElements.length).toBeGreaterThan(0);
    expect(fiveDaysElements[0].className).toContain("text-warning");

    // "—" for row with no 30-day use and onHand >= 0
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    // "Chưa kiểm lần nào" for null lastCountedAt
    expect(screen.getAllByText(/Chưa kiểm lần nào/).length).toBeGreaterThan(0);

    // Formatted date dd/mm/yyyy in Asia/Saigon for non-null lastCountedAt
    expect(screen.getAllByText(/09\/08\/2026/).length).toBeGreaterThan(0);
  });

  it("accent-blind search finds 'Trứng gà' when typing 'trung ga', and displays empty state when no match", () => {
    render(
      <StockOnHandClient
        total={18013339}
        unpricedCount={0}
        rows={SAMPLE_ROWS}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Ví dụ: Trứng gà");

    // Search accent-blind "trung ga"
    fireEvent.change(searchInput, { target: { value: "trung ga" } });

    // "Trứng gà" matches
    expect(screen.getAllByText("Trứng gà").length).toBeGreaterThan(0);

    // Other items are filtered out
    expect(screen.queryByText("Sữa chua không đường Vinamilk")).toBeNull();
    expect(screen.queryByText("Bột cà phê truyền thống Phin Đậm")).toBeNull();

    // Search with no match
    fireEvent.change(searchInput, { target: { value: "khongtimthay" } });
    expect(screen.getByText("Không có món nào khớp")).toBeInTheDocument();
  });

  it("renders red negative stock and suppresses 'đủ dùng' label for negative onHand", () => {
    const { container } = render(
      <StockOnHandClient
        total={18013339}
        unpricedCount={0}
        rows={SAMPLE_ROWS}
      />,
    );

    // Negative stock "-5 g" is rendered with text-danger
    const redStockElements = container.querySelectorAll(".text-danger");
    expect(redStockElements.length).toBeGreaterThan(0);
    const hasNegativeStock = Array.from(redStockElements).some(el => el.textContent?.includes("-5 g"));
    expect(hasNegativeStock).toBe(true);

    // Table row for Hạt chia (negative stock) should not contain any daysLeft label
    const table = screen.getByRole("table");
    const chiaRow = within(table).getByText("Hạt chia").closest("tr")!;
    // In chiaRow, the "Đủ dùng" column should not show "Hết" or "khoảng"
    expect(within(chiaRow).queryByText("Hết")).toBeNull();
    expect(within(chiaRow).queryByText(/khoảng/)).toBeNull();
  });

  it("renders header band with total and unpriced caption", () => {
    // When unpricedCount is 0
    const { rerender } = render(
      <StockOnHandClient
        total={18013339}
        unpricedCount={0}
        rows={SAMPLE_ROWS}
      />,
    );

    expect(screen.getByText("Giá trị tồn kho")).toBeInTheDocument();
    expect(screen.getByText("18,013,339đ")).toBeInTheDocument();
    expect(
      screen.getByText("Theo sổ: đã nhập trừ đã xuất. Mỗi món đúng tới ngày kiểm gần nhất của nó."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Chưa gồm/)).toBeNull();

    // When unpricedCount > 0
    rerender(
      <StockOnHandClient
        total={18013339}
        unpricedCount={3}
        rows={SAMPLE_ROWS}
      />,
    );

    expect(
      screen.getByText(
        "Theo sổ: đã nhập trừ đã xuất. Mỗi món đúng tới ngày kiểm gần nhất của nó. Chưa gồm 3 món không tính được giá.",
      ),
    ).toBeInTheDocument();
  });

  it("links each row and card to /admin/inventory/items/[itemId]", () => {
    render(
      <StockOnHandClient
        total={18013339}
        unpricedCount={0}
        rows={SAMPLE_ROWS}
      />,
    );

    const vinamilkLinks = screen.getAllByRole("link", { name: /Sữa chua không đường Vinamilk/ });
    expect(vinamilkLinks.length).toBeGreaterThan(0);
    expect(
      vinamilkLinks.some(l => l.getAttribute("href")?.startsWith("/admin/inventory/items/ITM-01")),
    ).toBe(true);
  });

  it("shows 'Ngừng dùng' tag for inactive items", () => {
    render(
      <StockOnHandClient
        total={18013339}
        unpricedCount={0}
        rows={SAMPLE_ROWS}
      />,
    );

    expect(screen.getAllByText("Ngừng dùng").length).toBeGreaterThan(0);
  });
});
