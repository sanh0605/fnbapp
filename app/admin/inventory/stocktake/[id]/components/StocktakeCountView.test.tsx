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
  lines: [
    {
      id: "LINE-1",
      itemReference: "SPM-004",
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
      packageCounts: null,
    },
    {
      id: "LINE-2",
      itemReference: "SPM-007",
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
      packageCounts: null,
    },
    {
      id: "LINE-3",
      itemReference: "SPM-053",
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
      packageCounts: null,
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
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
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
          packageCounts: null,
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
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
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
          packageCounts: null,
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
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
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
          packageCounts: null,
        },
        {
          id: "SKL-00002",
          itemReference: "SPM-002",
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
          packageCounts: null,
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

  it("all pack boxes blank on an unsaved line sends nothing on blur (BR-INV-023)", async () => {
    const { saveStocktakeLine } = await import("../../actions");
    vi.mocked(saveStocktakeLine).mockClear();

    const session: StocktakeSessionView = {
      id: "STK-PKG-01",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "LINE-PKG-1",
          itemReference: "SPM-008",
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
          packageCounts: null,
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    // Focus into the package box and blur without typing
    const inputs = screen.getAllByLabelText("Thùng 24 lon");
    fireEvent.blur(inputs[0], { relatedTarget: null });

    expect(saveStocktakeLine).not.toHaveBeenCalled();
    expect(screen.queryByText(/Chưa lưu được/)).not.toBeInTheDocument();
  });

  it("renders preview rows on phone as a divide-y list of PhoneRow", async () => {
    const session: StocktakeSessionView = {
      id: "STK-001",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00001",
          itemReference: "SPM-001",
          itemName: "Sữa tươi",
          unitName: "l",
          countedQty: 8,
          theoreticalAtCount: 10,
          countedAt: "2026-10-14T15:00:00Z",
          packageLines: [],
          groupName: "",
          state: "OFF",
          unitCost: 30000,
          diffValue: -60000,
          packageCounts: null,
        },
      ],
    };

    const previewResult: StocktakeApplyResult = {
      sessionId: "STK-001",
      status: "OPEN",
      dryRun: true,
      ledgerCount: 1,
      issueCount: 1,
      rows: [
        {
          lineId: "SKL-00001",
          itemReference: "SPM-001",
          countedQty: 8,
          theoreticalAtCount: 10,
          currentTheoreticalQty: 10,
          countVariance: -2,
          projectedQty: 8,
        },
      ],
      skippedIngredients: [],
      planHash: "hash-preview-row",
      issueIds: [],
      recomputedLines: [],
    };

    vi.mocked(getStocktakeConfirmPreview).mockResolvedValue({ preview: previewResult });

    const { container } = render(<StocktakeCountView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    await waitFor(() => {
      expect(screen.getByText("Dự kiến áp dụng")).toBeInTheDocument();
    });

    const phoneContainer = container.querySelector(".md\\:hidden");
    expect(phoneContainer).not.toBeNull();
    expect(phoneContainer?.className).toContain("divide-y");
    expect(phoneContainer?.className).not.toContain("space-y-2");

    const rows = phoneContainer?.querySelectorAll(":scope > div");
    expect(rows?.length).toBe(1);
    const firstRow = rows?.[0];
    expect(firstRow?.className).toContain("px-4");
    expect(firstRow?.className).toContain("py-2.5");
    expect(firstRow?.className).not.toContain("p-3");

    // PhoneRow: line 1 has item name and variance
    expect(firstRow?.textContent).toContain("Sữa tươi");
    expect(firstRow?.textContent).toContain("-2 l");

    // Old card text "Dự kiến sau áp dụng:" should not exist
    expect(firstRow?.textContent).not.toContain("Dự kiến sau áp dụng:");
  });

  it("typing in two boxes then blurring out of the line sends one call with both numbers (BR-INV-023)", async () => {
    const { saveStocktakeLine } = await import("../../actions");
    vi.mocked(saveStocktakeLine).mockClear();
    vi.mocked(saveStocktakeLine).mockResolvedValue({ countedQty: 162 });

    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00106",
          itemReference: "SPM-00106",
          itemName: "Ly Nhựa PET 98 - 16OZ - 500ml",
          unitName: "Cái",
          countedQty: null,
          theoreticalAtCount: 200,
          countedAt: null,
          packageLines: [
            {
              conversionId: "QD-162",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cây",
              conversionRate: 50,
              baseUnitName: "Cái",
              purchasedUnitName: "Cây",
            },
            {
              conversionId: "QD-069",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cái",
              conversionRate: 1,
              baseUnitName: "Cái",
              purchasedUnitName: "Cái",
            },
          ],
          groupName: "Vật tư tiêu hao",
          state: "BLANK",
          unitCost: 1000,
          diffValue: null,
          packageCounts: null,
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    const cayInputs = screen.getAllByLabelText("Cây");
    const caiInputs = screen.getAllByLabelText("Cái");

    // Type 3 in Cây
    fireEvent.change(cayInputs[0], { target: { value: "3" } });
    // Focus moves to Cái (inside same line wrapper)
    fireEvent.blur(cayInputs[0], { relatedTarget: caiInputs[0] });
    expect(saveStocktakeLine).not.toHaveBeenCalled();

    // Type 12 in Cái
    fireEvent.change(caiInputs[0], { target: { value: "12" } });
    // Focus leaves the line (relatedTarget outside)
    fireEvent.blur(caiInputs[0], { relatedTarget: null });

    expect(saveStocktakeLine).toHaveBeenCalledTimes(1);
    expect(saveStocktakeLine).toHaveBeenCalledWith("SKL-00106", {
      "QD-162": 3,
      "QD-069": 12,
    });

    await waitFor(() => {
      expect(screen.getAllByText("✓ Đã lưu").length).toBeGreaterThan(0);
    });
  });

  it("re-blurring with no change sends nothing (BR-INV-023)", async () => {
    const { saveStocktakeLine } = await import("../../actions");
    vi.mocked(saveStocktakeLine).mockClear();
    vi.mocked(saveStocktakeLine).mockResolvedValue({ countedQty: 162 });

    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00106",
          itemReference: "SPM-00106",
          itemName: "Ly Nhựa PET 98 - 16OZ - 500ml",
          unitName: "Cái",
          countedQty: 162,
          theoreticalAtCount: 200,
          countedAt: "2026-10-15T10:00:00Z",
          packageLines: [
            {
              conversionId: "QD-162",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cây",
              conversionRate: 50,
              baseUnitName: "Cái",
              purchasedUnitName: "Cây",
            },
          ],
          groupName: "Vật tư tiêu hao",
          state: "OFF",
          unitCost: 1000,
          diffValue: -38000,
          packageCounts: { "QD-162": 3 },
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    const inputs = screen.getAllByLabelText("Cây");
    fireEvent.blur(inputs[0], { relatedTarget: null });

    expect(saveStocktakeLine).not.toHaveBeenCalled();
  });

  it("clearing a saved line sends null (BR-INV-023)", async () => {
    const { saveStocktakeLine } = await import("../../actions");
    vi.mocked(saveStocktakeLine).mockClear();
    vi.mocked(saveStocktakeLine).mockResolvedValue({ countedQty: null });

    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00082",
          itemReference: "SPM-00082",
          itemName: "Dâu sấy",
          unitName: "g",
          countedQty: 1100,
          theoreticalAtCount: 1000,
          countedAt: "2026-10-15T10:00:00Z",
          packageLines: [
            {
              conversionId: "QD-038",
              purchasedItemId: "SPM-00082",
              purchasedItemName: "Dâu sấy",
              sizeLabel: "Túi 100 g",
              conversionRate: 100,
              baseUnitName: "g",
              purchasedUnitName: "Túi 100 g",
            },
            {
              conversionId: "QD-051",
              purchasedItemId: "SPM-00082",
              purchasedItemName: "Dâu sấy",
              sizeLabel: "Túi 500 g",
              conversionRate: 500,
              baseUnitName: "g",
              purchasedUnitName: "Túi 500 g",
            },
          ],
          groupName: "Nguyên liệu",
          state: "OFF",
          unitCost: 100,
          diffValue: 10000,
          packageCounts: { "QD-038": 1, "QD-051": 2 },
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    const t100Inputs = screen.getAllByLabelText("Túi 100 g");
    const t500Inputs = screen.getAllByLabelText("Túi 500 g");

    // Clear both boxes
    fireEvent.change(t100Inputs[0], { target: { value: "" } });
    fireEvent.change(t500Inputs[0], { target: { value: "" } });

    // Blur out of line
    fireEvent.blur(t500Inputs[0], { relatedTarget: null });

    expect(saveStocktakeLine).toHaveBeenCalledTimes(1);
    expect(saveStocktakeLine).toHaveBeenCalledWith("SKL-00082", null);

    await waitFor(() => {
      expect(screen.queryByText("✓ Đã lưu")).not.toBeInTheDocument();
    });
  });

  it("an untouched line saved by the old code sends nothing on blur (BR-INV-023)", async () => {
    const { saveStocktakeLine } = await import("../../actions");
    vi.mocked(saveStocktakeLine).mockClear();

    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00106",
          itemReference: "SPM-00106",
          itemName: "Ly Nhựa PET 98 - 16OZ - 500ml",
          unitName: "Cái",
          countedQty: 162,
          theoreticalAtCount: 200,
          countedAt: "2026-10-15T10:00:00Z",
          packageLines: [
            {
              conversionId: "QD-162",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cây",
              conversionRate: 50,
              baseUnitName: "Cái",
              purchasedUnitName: "Cây",
            },
          ],
          groupName: "Vật tư tiêu hao",
          state: "OFF",
          unitCost: 1000,
          diffValue: -38000,
          packageCounts: null, // Old code: countedQty present, packageCounts null
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    // Boxes are blank, text shows "Đã lưu: 162 Cái"
    expect(screen.getAllByText("Đã lưu: 162 Cái").length).toBeGreaterThan(0);

    const inputs = screen.getAllByLabelText("Cây");
    // Focus in then out without typing
    fireEvent.blur(inputs[0], { relatedTarget: null });

    expect(saveStocktakeLine).not.toHaveBeenCalled();
    expect(screen.getAllByText("Đã lưu: 162 Cái").length).toBeGreaterThan(0);
  });

  it("the live total text (BR-INV-023)", () => {
    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00106",
          itemReference: "SPM-00106",
          itemName: "Ly Nhựa PET 98 - 16OZ - 500ml",
          unitName: "Cái",
          countedQty: null,
          theoreticalAtCount: 200,
          countedAt: null,
          packageLines: [
            {
              conversionId: "QD-162",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cây",
              conversionRate: 50,
              baseUnitName: "Cái",
              purchasedUnitName: "Cây",
            },
            {
              conversionId: "QD-069",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cái",
              conversionRate: 1,
              baseUnitName: "Cái",
              purchasedUnitName: "Cái",
            },
          ],
          groupName: "Vật tư tiêu hao",
          state: "BLANK",
          unitCost: 1000,
          diffValue: null,
          packageCounts: null,
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    const cayInputs = screen.getAllByLabelText("Cây");
    const caiInputs = screen.getAllByLabelText("Cái");

    expect(screen.queryByText(/=/)).not.toBeInTheDocument();

    // Type 3 in Cây
    fireEvent.change(cayInputs[0], { target: { value: "3" } });
    expect(screen.getAllByText("= 150 Cái").length).toBeGreaterThan(0);

    // Type 12 in Cái
    fireEvent.change(caiInputs[0], { target: { value: "12" } });
    expect(screen.getAllByText("= 162 Cái").length).toBeGreaterThan(0);

    // Clear both
    fireEvent.change(cayInputs[0], { target: { value: "" } });
    fireEvent.change(caiInputs[0], { target: { value: "" } });
    expect(screen.queryByText(/=/)).not.toBeInTheDocument();
  });

  it("prefill from packageCounts (BR-INV-023)", () => {
    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "SKL-00106",
          itemReference: "SPM-00106",
          itemName: "Ly Nhựa PET 98 - 16OZ - 500ml",
          unitName: "Cái",
          countedQty: 162,
          theoreticalAtCount: 200,
          countedAt: "2026-10-15T10:00:00Z",
          packageLines: [
            {
              conversionId: "QD-162",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cây",
              conversionRate: 50,
              baseUnitName: "Cái",
              purchasedUnitName: "Cây",
            },
            {
              conversionId: "QD-069",
              purchasedItemId: "SPM-00106",
              purchasedItemName: "Ly Nhựa PET",
              sizeLabel: "Cái",
              conversionRate: 1,
              baseUnitName: "Cái",
              purchasedUnitName: "Cái",
            },
          ],
          groupName: "Vật tư tiêu hao",
          state: "OFF",
          unitCost: 1000,
          diffValue: -38000,
          packageCounts: { "QD-162": 3, "QD-069": 12 },
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    const cayInputs = screen.getAllByLabelText("Cây");
    const caiInputs = screen.getAllByLabelText("Cái");

    expect(cayInputs[0]).toHaveValue("3");
    expect(caiInputs[0]).toHaveValue("12");
    expect(screen.getAllByText("= 162 Cái").length).toBeGreaterThan(0);
    expect(screen.getAllByText("✓ Đã lưu").length).toBeGreaterThan(0);
  });

  it('"Xem trước" waits for a running save (BR-INV-023)', async () => {
    const { saveStocktakeLine, getStocktakeConfirmPreview } = await import("../../actions");
    vi.mocked(saveStocktakeLine).mockClear();
    vi.mocked(getStocktakeConfirmPreview).mockClear();

    let resolveSave!: (val: any) => void;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    vi.mocked(saveStocktakeLine).mockReturnValue(savePromise as any);
    vi.mocked(getStocktakeConfirmPreview).mockResolvedValue({
      preview: {
        sessionId: "STK-002",
        status: "OPEN",
        dryRun: true,
        ledgerCount: 0,
        issueCount: 0,
        rows: [],
        skippedIngredients: [],
        planHash: "hash-preview",
        issueIds: [],
        recomputedLines: [],
      },
    });

    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "LINE-1",
          itemReference: "SPM-004",
          itemName: "Bột cà phê",
          unitName: "g",
          countedQty: null,
          theoreticalAtCount: 6000,
          countedAt: null,
          packageLines: [],
          groupName: "Nguyên liệu",
          state: "BLANK",
          unitCost: 148,
          diffValue: null,
          packageCounts: null,
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    const input = screen.getAllByLabelText("Số đếm Bột cà phê")[0];
    fireEvent.change(input, { target: { value: "5000" } });
    fireEvent.blur(input, { relatedTarget: null });

    // Save is in flight
    expect(saveStocktakeLine).toHaveBeenCalledTimes(1);

    // Click "Xem trước"
    fireEvent.click(screen.getByRole("button", { name: "Xem trước" }));

    // getStocktakeConfirmPreview should not be called yet
    expect(getStocktakeConfirmPreview).not.toHaveBeenCalled();

    // Resolve the save
    resolveSave({ countedQty: 5000 });

    await waitFor(() => {
      expect(getStocktakeConfirmPreview).toHaveBeenCalledTimes(1);
    });
  });

  it('no "Xác nhận"/"Lưu" row button remains (BR-INV-023)', () => {
    const session: StocktakeSessionView = {
      id: "STK-002",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
      confirmedAt: null,
      confirmedByName: null,
      lines: [
        {
          id: "LINE-PKG",
          itemReference: "SPM-008",
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
          packageCounts: null,
        },
        {
          id: "LINE-LEG",
          itemReference: "SPM-004",
          itemName: "Bột cà phê",
          unitName: "g",
          countedQty: null,
          theoreticalAtCount: 6000,
          countedAt: null,
          packageLines: [],
          groupName: "Nguyên liệu",
          state: "BLANK",
          unitCost: 148,
          diffValue: null,
          packageCounts: null,
        },
      ],
    };

    render(<StocktakeCountView session={session} />);

    expect(screen.queryByRole("button", { name: "Xác nhận" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu" })).not.toBeInTheDocument();
    expect(screen.getByText("Trạng thái")).toBeInTheDocument();
    expect(screen.queryByText("Thao tác")).not.toBeInTheDocument();
  });
});
