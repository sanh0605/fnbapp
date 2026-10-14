// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ActiveSessionView } from "./ActiveSessionView";
import type { StocktakeSessionView } from "../actions";
import type { StocktakeApplyResult } from "@/lib/stock/stocktake-transaction";

if (typeof window.matchMedia !== "function") {
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

const mocks = vi.hoisted(() => ({
  routerRefresh: vi.fn(),
  routerPush: vi.fn(),
  getStocktakeConfirmPreview: vi.fn(),
  confirmStocktakeSession: vi.fn(),
  cancelStocktakeSession: vi.fn(),
  saveStocktakeLine: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.routerRefresh, push: mocks.routerPush }),
}));

vi.mock("../actions", () => ({
  getStocktakeConfirmPreview: mocks.getStocktakeConfirmPreview,
  confirmStocktakeSession: mocks.confirmStocktakeSession,
  cancelStocktakeSession: mocks.cancelStocktakeSession,
  saveStocktakeLine: mocks.saveStocktakeLine,
}));

vi.mock("@/lib/shared/dialog", () => ({
  alert: vi.fn(),
  confirm: vi.fn(),
}));

describe("ActiveSessionView recomputed lines (BR-INV-017)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows the recomputed alert and 'Sữa tươi: 10 → 8' when preview has recomputed lines with no rows (BR-INV-017)", async () => {
    const session: StocktakeSessionView = {
      id: "STK-001",
      status: "OPEN",
      createdByName: "Admin",
      createdAt: "2026-10-14T15:00:00Z",
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

    mocks.getStocktakeConfirmPreview.mockResolvedValue({ preview: previewResult });

    render(<ActiveSessionView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và áp dụng" }));

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

    mocks.getStocktakeConfirmPreview.mockResolvedValue({ preview: previewResult });

    render(<ActiveSessionView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và áp dụng" }));

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

    mocks.getStocktakeConfirmPreview.mockResolvedValue({ preview: previewResult });

    render(<ActiveSessionView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và áp dụng" }));

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

    mocks.getStocktakeConfirmPreview.mockResolvedValue({ preview: previewResult });

    render(<ActiveSessionView session={session} />);

    fireEvent.click(screen.getByRole("button", { name: "Xác nhận và áp dụng" }));

    await waitFor(() => {
      expect(screen.getByText("Số trên sổ đã tính lại theo giờ đếm")).toBeInTheDocument();
    });

    expect(screen.getByText("SPM-999: 12 → 9")).toBeInTheDocument();
  });
});
