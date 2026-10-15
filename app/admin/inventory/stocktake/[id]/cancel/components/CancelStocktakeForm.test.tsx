// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CancelStocktakeForm } from "./CancelStocktakeForm";
import * as actions from "../../../actions";
import type { StocktakeSessionView, StocktakeListRow } from "../../../actions";

const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/admin/inventory/stocktake/STK-001/cancel",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("../../../actions", () => ({
  reverseConfirmedStocktakeSession: vi.fn(),
}));

afterEach(cleanup);

const mockSession: StocktakeSessionView = {
  id: "STK-001",
  status: "CONFIRMED",
  createdByName: "Admin",
  createdAt: "2026-08-09T15:02:24.000Z",
  confirmedAt: null,
  confirmedByName: null,
  notes: "",
  lines: [
    {
      id: "LINE-1",
      itemReference: "SPM-004",
      itemType: "PURCHASED_ITEM",
      itemName: "Bột cà phê truyền thống Phin Đậm",
      unitName: "g",
      countedQty: 4000,
      theoreticalAtCount: 6000,
      countedAt: "2026-08-09T15:00:00.000Z",
      packageLines: [],
      groupName: "Nguyên liệu",
      state: "OFF",
      unitCost: 148,
      diffValue: -296033,
    },
  ],
};

const mockListRow: StocktakeListRow = {
  id: "STK-001",
  status: "CONFIRMED",
  at: "2026-08-09T15:02:24.000Z",
  personName: "Admin",
  countedLines: 50,
  totalLines: 50,
  shortValue: 296033,
  foundValue: 0,
  isLatestConfirmed: true,
};

describe("CancelStocktakeForm (Screen 4)", () => {
  it("empty reason blocked", async () => {
    render(<CancelStocktakeForm session={mockSession} listRow={mockListRow} />);

    // Click "Hoàn tác" button with empty reason
    const submitBtn = screen.getByRole("button", { name: "Hoàn tác" });
    fireEvent.click(submitBtn);

    // Empty reason error message must be shown
    expect(screen.getByText("Nhập lý do hoàn tác")).toBeInTheDocument();
    expect(actions.reverseConfirmedStocktakeSession).not.toHaveBeenCalled();

    // Whitespace only reason must also be blocked
    const textarea = screen.getByLabelText(/Lý do hoàn tác/);
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(submitBtn);

    expect(screen.getByText("Nhập lý do hoàn tác")).toBeInTheDocument();
    expect(actions.reverseConfirmedStocktakeSession).not.toHaveBeenCalled();
  });

  it("submits trimmed reason when valid", async () => {
    vi.mocked(actions.reverseConfirmedStocktakeSession).mockResolvedValue({
      success: true,
    } as any);

    render(<CancelStocktakeForm session={mockSession} listRow={mockListRow} />);

    const textarea = screen.getByLabelText(/Lý do hoàn tác/);
    fireEvent.change(textarea, { target: { value: "  Đếm nhầm ngày kiểm kho  " } });

    const submitBtn = screen.getByRole("button", { name: "Hoàn tác" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.reverseConfirmedStocktakeSession).toHaveBeenCalledWith(
        "STK-001",
        "Đếm nhầm ngày kiểm kho"
      );
      expect(routerMock.push).toHaveBeenCalledWith("/admin/inventory/stocktake/STK-001");
    });
  });
});
