// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { StocktakeCountView } from "./StocktakeCountView";
import { getStocktakeConfirmPreview, type StocktakeSessionView } from "../../actions";
import type { StocktakeApplyResult } from "@/lib/stock/stocktake-transaction";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/admin/inventory/stocktake/STK-002",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../actions", () => ({
  saveStocktakeLine: vi.fn().mockResolvedValue({ success: true }),
  cancelStocktakeSession: vi.fn().mockResolvedValue({ success: true }),
  getStocktakeConfirmPreview: vi.fn(),
  confirmStocktakeSession: vi.fn().mockResolvedValue({ success: true }),
}));

afterEach(cleanup);

const mockSession: StocktakeSessionView = {
  id: "STK-002",
  status: "OPEN",
  createdByName: "Admin",
  createdAt: "2026-10-15T10:00:00.000Z",
  confirmedAt: null,
  confirmedByName: null,
  notes: "Phiên đếm tháng 10",
  lines: [
    {
      id: "LINE-1",
      itemReference: "SPM-004",
      itemType: "PURCHASED_ITEM",
      itemName: "Bột cà phê truyền thống Phin Đậm",
      unitName: "g",
      countedQty: null,
      theoreticalAtCount: 6000,
      countedAt: null,
      packageLines: [],
      groupName: "Nguyên liệu",
      state: "BLANK",
      unitCost: 148,
      diffValue: null,
    },
    {
      id: "LINE-2",
      itemReference: "SPM-007",
      itemType: "PURCHASED_ITEM",
      itemName: "Sữa tươi Mlekovita",
      unitName: "hộp",
      countedQty: 8,
      theoreticalAtCount: 10,
      countedAt: "2026-10-15T10:05:00.000Z",
      packageLines: [],
      groupName: "Nguyên liệu",
      state: "OFF",
      unitCost: 32000,
      diffValue: -64000,
    },
    {
      id: "LINE-3",
      itemReference: "SPM-053",
      itemType: "PURCHASED_ITEM",
      itemName: "Ống hút nhỏ",
      unitName: "bao",
      countedQty: 5,
      theoreticalAtCount: 5,
      countedAt: "2026-10-15T10:06:00.000Z",
      packageLines: [],
      groupName: "Vật tư tiêu hao",
      state: "MATCH",
      unitCost: 15000,
      diffValue: 0,
    },
  ],
};

describe("StocktakeCountView (Screen 2)", () => {
  it("default tab Chưa đếm", () => {
    render(<StocktakeCountView session={mockSession} />);

    // LINE-1 is BLANK (Chưa đếm), LINE-2 is OFF (Lệch), LINE-3 is MATCH (Khớp)
    // Since mockSession has a BLANK line, active tab defaults to Chưa đếm
    const chuaDemBtn = screen.getByRole("button", { name: /Chưa đếm \(1\)/ });
    expect(chuaDemBtn).toBeInTheDocument();
    // In primary variant (active tab), Button has bg-primary class
    expect(chuaDemBtn.className).toContain("bg-primary");

    // Only LINE-1 should be visible under Chưa đếm
    expect(screen.getAllByText("Bột cà phê truyền thống Phin Đậm").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Sữa tươi Mlekovita")).toBeNull();
    expect(screen.queryByText("Ống hút nhỏ")).toBeNull();
  });

  it("search 'bot ca phe' finds Bột cà phê truyền thống Phin Đậm", () => {
    render(<StocktakeCountView session={mockSession} />);

    // Switch to 'Tất cả' tab to see all lines
    const tatCaBtn = screen.getByRole("button", { name: /Tất cả \(3\)/ });
    fireEvent.click(tatCaBtn);

    const searchInput = screen.getByPlaceholderText("Ví dụ: Bột cà phê");
    fireEvent.change(searchInput, { target: { value: "bot ca phe" } });

    // Accent-blind search should match "Bột cà phê truyền thống Phin Đậm"
    expect(screen.getAllByText("Bột cà phê truyền thống Phin Đậm").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Sữa tươi Mlekovita")).toBeNull();
    expect(screen.queryByText("Ống hút nhỏ")).toBeNull();
  });

  it("group headers with counts", () => {
    render(<StocktakeCountView session={mockSession} />);

    // Switch to 'Tất cả' to see both groups
    const tatCaBtn = screen.getByRole("button", { name: /Tất cả \(3\)/ });
    fireEvent.click(tatCaBtn);

    // Group Nguyên liệu has 2 total, 1 counted (LINE-2 is counted, LINE-1 is blank) -> (1/2)
    expect(screen.getByText("Nguyên liệu (1/2)")).toBeInTheDocument();

    // Group Vật tư tiêu hao has 1 total, 1 counted (LINE-3 is counted) -> (1/1)
    expect(screen.getByText("Vật tư tiêu hao (1/1)")).toBeInTheDocument();
  });

  it("shows the recomputed alert and 'Sữa tươi: 10 → 8' when preview has recomputed lines with no rows (BR-INV-017)", async () => {
    const session: StocktakeSessionView = {
      id: "STK-001",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      notes: "",
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
          itemType: "PURCHASED_ITEM",
          itemName: "Sữa tươi",
          unitName: "",
          countedQty: 8,
          theoreticalAtCount: 10,
          countedAt: "2026-10-14T15:00:00Z",
          packageLines: [],
          groupName: "",
          state: "OFF",
          unitCost: null,
          diffValue: null,
        },
      ],
    };

    const previewResult: StocktakeApplyResult = {
      sessionId: "STK-001",
      status: "OPEN",
      dryRun: true,
      ledgerCount: 0,
      issueCount: 0,
      rows: [],
      skippedIngredients: [],
      planHash: "hash-sua-tuoi",
      issueIds: [],
      recomputedLines: [
        {
          lineId: "SKL-00001",
          itemReference: "SPM-001",
          frozenQty: 10,
          recomputedQty: 8,
        },
      ],
    };

    vi.mocked(getStocktakeConfirmPreview).mockResolvedValue({ preview: previewResult });

    render(<StocktakeCountView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await waitFor(() => {
      expect(screen.getByText("Số trên sổ đã tính lại theo giờ đếm")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        "Có phiếu nhập hoặc phiếu xuất ghi ngày trước giờ đếm nhưng nhập sau, nên số trên sổ lúc đếm đã được tính lại.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Sữa tươi: 10 → 8")).toBeInTheDocument();
  });

  it("shows nothing when recomputed lines have equal numbers (frozenQty === recomputedQty)", async () => {
    const session: StocktakeSessionView = {
      id: "STK-001",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      notes: "",
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
          itemType: "PURCHASED_ITEM",
          itemName: "Sữa tươi",
          unitName: "",
          countedQty: 10,
          theoreticalAtCount: 10,
          countedAt: "2026-10-14T15:00:00Z",
          packageLines: [],
          groupName: "",
          state: "OFF",
          unitCost: null,
          diffValue: null,
        },
      ],
    };

    const previewResult: StocktakeApplyResult = {
      sessionId: "STK-001",
      status: "OPEN",
      dryRun: true,
      ledgerCount: 0,
      issueCount: 0,
      rows: [],
      skippedIngredients: [],
      planHash: "hash-equal",
      issueIds: [],
      recomputedLines: [
        {
          lineId: "SKL-00001",
          itemReference: "SPM-001",
          frozenQty: 10,
          recomputedQty: 10,
        },
      ],
    };

    vi.mocked(getStocktakeConfirmPreview).mockResolvedValue({ preview: previewResult });

    render(<StocktakeCountView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await waitFor(() => {
      expect(screen.getByText("Dự kiến áp dụng")).toBeInTheDocument();
    });

    expect(screen.queryByText("Số trên sổ đã tính lại theo giờ đếm")).not.toBeInTheDocument();
    expect(screen.queryByText(/Sữa tươi: 10 → 10/)).not.toBeInTheDocument();
  });

  it("only lists lines with differences when preview has both changed and unchanged lines", async () => {
    const session: StocktakeSessionView = {
      id: "STK-001",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      notes: "",
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
          itemType: "PURCHASED_ITEM",
          itemName: "Sữa tươi",
          unitName: "l",
          countedQty: 8,
          theoreticalAtCount: 10,
          countedAt: "2026-10-14T15:00:00Z",
          packageLines: [],
          groupName: "",
          state: "OFF",
          unitCost: null,
          diffValue: null,
        },
        {
          id: "SKL-00002",
          itemReference: "SPM-002",
          itemType: "PURCHASED_ITEM",
          itemName: "Đường cát",
          unitName: "kg",
          countedQty: 5,
          theoreticalAtCount: 5,
          countedAt: "2026-10-14T15:00:00Z",
          packageLines: [],
          groupName: "",
          state: "OFF",
          unitCost: null,
          diffValue: null,
        },
      ],
    };

    const previewResult: StocktakeApplyResult = {
      sessionId: "STK-001",
      status: "OPEN",
      dryRun: true,
      ledgerCount: 0,
      issueCount: 0,
      rows: [],
      skippedIngredients: [],
      planHash: "hash-mixed",
      issueIds: [],
      recomputedLines: [
        {
          lineId: "SKL-00001",
          itemReference: "SPM-001",
          frozenQty: 10,
          recomputedQty: 8,
        },
        {
          lineId: "SKL-00002",
          itemReference: "SPM-002",
          frozenQty: 5,
          recomputedQty: 5,
        },
      ],
    };

    vi.mocked(getStocktakeConfirmPreview).mockResolvedValue({ preview: previewResult });

    render(<StocktakeCountView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await waitFor(() => {
      expect(screen.getByText("Số trên sổ đã tính lại theo giờ đếm")).toBeInTheDocument();
    });

    expect(screen.getByText("Sữa tươi: 10 → 8 l")).toBeInTheDocument();
    expect(screen.queryByText(/Đường cát: /)).not.toBeInTheDocument();
  });

  it("falls back to itemReference when lineId does not match session lines", async () => {
    const session: StocktakeSessionView = {
      id: "STK-001",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      notes: "",
      lines: [],
    };

    const previewResult: StocktakeApplyResult = {
      sessionId: "STK-001",
      status: "OPEN",
      dryRun: true,
      ledgerCount: 0,
      issueCount: 0,
      rows: [],
      skippedIngredients: [],
      planHash: "hash-fallback",
      issueIds: [],
      recomputedLines: [
        {
          lineId: "SKL-UNKNOWN",
          itemReference: "SPM-999",
          frozenQty: 12,
          recomputedQty: 9,
        },
      ],
    };

    vi.mocked(getStocktakeConfirmPreview).mockResolvedValue({ preview: previewResult });

    render(<StocktakeCountView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await waitFor(() => {
      expect(screen.getByText("Số trên sổ đã tính lại theo giờ đếm")).toBeInTheDocument();
    });

    expect(screen.getByText("SPM-999: 12 → 9")).toBeInTheDocument();
  });

  it("all pack boxes blank does not call saveStocktakeLine and shows error", async () => {
    const { saveStocktakeLine } = await import("../../actions");
    const session: StocktakeSessionView = {
      id: "STK-PKG-01",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      notes: "",
      lines: [
        {
          id: "LINE-PKG-1",
          itemReference: "SPM-008",
          itemType: "PURCHASED_ITEM",
          itemName: "Sữa đặc Larosee",
          unitName: "lon",
          countedQty: null,
          theoreticalAtCount: 24,
          countedAt: null,
          packageLines: [
            {
              conversionId: "CONV-1",
              purchasedItemId: "SPM-008",
              purchasedItemName: "Sữa đặc Larosee",
              sizeLabel: "Thùng 24 lon",
              conversionRate: 24,
              baseUnitName: "lon",
              purchasedUnitName: "Thùng",
            },
          ],
          groupName: "Nguyên liệu",
          state: "BLANK",
          unitCost: 20000,
          diffValue: null,
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    // Click "Xác nhận" without typing any count in the package box
    const confirmButtons = screen.getAllByRole("button", { name: "Xác nhận" });
    fireEvent.click(confirmButtons[0]);

    expect(saveStocktakeLine).not.toHaveBeenCalled();
    expect(screen.getAllByText("Cần nhập số đếm").length).toBeGreaterThan(0);
  });
});
