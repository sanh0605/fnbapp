// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CancelIssueSlipForm from "./CancelIssueSlipForm";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockCancelIssueSlip = vi.hoisted(() => vi.fn());
vi.mock("@/app/admin/inventory/issue-slips/actions", () => ({
  cancelIssueSlip: mockCancelIssueSlip,
}));

afterEach(cleanup);
beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  mockCancelIssueSlip.mockReset();
});

const sampleDetail: IssueSlipDetail = {
  id: "ISL-00076",
  issuedAt: "2026-09-28T18:20:00Z",
  dateText: "28/09/2026 18:20",
  note: "Khác",
  createdByName: "tuyen2612",
  lines: [
    {
      issueId: "iss-1",
      purchasedItemId: "item-oatside",
      name: "Sữa yến mạch Oatside",
      baseQuantity: 2000,
      baseUnitName: "ml",
      quantityText: "2 Hộp (2,000 ml)",
      value: 120000,
      unitOptions: [
        { key: "conv-hop", label: "Hộp (1,000 ml)", factor: 1000, unitName: "Hộp" },
        { key: "BASE", label: "ml (lẻ)", factor: 1, unitName: "ml" },
      ],
    },
  ],
  totalValue: 120000,
  cancellation: null,
  lock: null,
  canEdit: true,
  unitCostByItem: { "item-oatside": 36.80308163265307 },
};

describe("CancelIssueSlipForm", () => {
  it("A cancelled slip shows 'Phiếu này không huỷ được', the reason and back link, and no form", () => {
    const cancelledDetail: IssueSlipDetail = {
      ...sampleDetail,
      cancellation: {
        at: "2026-09-29T10:00:00Z",
        dateText: "29/09/2026 17:00",
        reason: "Xuất nhầm quán khác",
      },
      canEdit: false,
    };

    render(
      <CancelIssueSlipForm
        detail={cancelledDetail}
        detailHref="/admin/inventory/issue-slips/ISL-00076"
      />
    );

    expect(screen.getByText("Phiếu này không huỷ được")).toBeInTheDocument();
    expect(screen.getByText(/Phiếu đã huỷ: Xuất nhầm quán khác/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xác nhận huỷ" })).toBeNull();
    expect(screen.getByRole("link", { name: "Quay lại" })).toHaveAttribute(
      "href",
      "/admin/inventory/issue-slips/ISL-00076"
    );
  });

  it("A locked slip shows 'Phiếu này không huỷ được', lock note and back link, and no form", () => {
    const lockedDetail: IssueSlipDetail = {
      ...sampleDetail,
      lock: { sessionId: "STK-1", confirmedAt: "2026-08-09T00:00:00Z", dateText: "09/08/2026" },
      canEdit: false,
    };

    render(
      <CancelIssueSlipForm
        detail={lockedDetail}
        detailHref="/admin/inventory/issue-slips/ISL-00076"
      />
    );

    expect(screen.getByText("Phiếu này không huỷ được")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Phiếu nằm trước lần kiểm kê ngày 09/08/2026 nên không sửa được. Sai lệch sẽ được bù ở lần kiểm kê sau."
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Xác nhận huỷ" })).toBeNull();
  });

  it("reason required: button disabled when blank, enabled after typing reason", () => {
    render(
      <CancelIssueSlipForm
        detail={sampleDetail}
        detailHref="/admin/inventory/issue-slips/ISL-00076"
      />
    );

    const button = screen.getByRole("button", { name: "Xác nhận huỷ" });
    const textarea = screen.getByRole("textbox", { name: "Lý do huỷ (bắt buộc)" });

    expect(button).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "   " } });
    expect(button).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Nhầm số lượng hàng xuất" } });
    expect(button).toBeEnabled();
  });

  it("success navigates to the slip page and calls refresh", async () => {
    mockCancelIssueSlip.mockResolvedValueOnce({
      success: true,
      result: { slipId: "ISL-00076" },
    });

    render(
      <CancelIssueSlipForm
        detail={sampleDetail}
        detailHref="/admin/inventory/issue-slips/ISL-00076"
      />
    );

    const textarea = screen.getByRole("textbox", { name: "Lý do huỷ (bắt buộc)" });
    fireEvent.change(textarea, { target: { value: "Ghi nhầm phiếu" } });

    const button = screen.getByRole("button", { name: "Xác nhận huỷ" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockCancelIssueSlip).toHaveBeenCalledWith({
        slipId: "ISL-00076",
        reason: "Ghi nhầm phiếu",
      });
      expect(push).toHaveBeenCalledWith("/admin/inventory/issue-slips/ISL-00076");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("refusal shows in the alert and preserves typed reason", async () => {
    mockCancelIssueSlip.mockResolvedValueOnce({
      success: false,
      error: "Không thể huỷ phiếu xuất này do lỗi tồn kho.",
    });

    render(
      <CancelIssueSlipForm
        detail={sampleDetail}
        detailHref="/admin/inventory/issue-slips/ISL-00076"
      />
    );

    const textarea = screen.getByRole("textbox", { name: "Lý do huỷ (bắt buộc)" });
    fireEvent.change(textarea, { target: { value: "Ghi nhầm phiếu" } });

    const button = screen.getByRole("button", { name: "Xác nhận huỷ" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("Không thể huỷ phiếu xuất này do lỗi tồn kho.")
      ).toBeInTheDocument();
    });

    expect(textarea).toHaveValue("Ghi nhầm phiếu");
    expect(button).toBeEnabled();
  });

  it("renders lines table on desktop and card list on phone", () => {
    render(
      <CancelIssueSlipForm
        detail={sampleDetail}
        detailHref="/admin/inventory/issue-slips/ISL-00076"
      />
    );

    const desktopTable = screen.getByTestId("desktop-lines-table");
    expect(within(desktopTable).getByText("Mặt hàng")).toBeInTheDocument();
    expect(within(desktopTable).getByText("Số lượng")).toBeInTheDocument();
    expect(within(desktopTable).getByText("Giá trị")).toBeInTheDocument();
    expect(within(desktopTable).getByText("Sữa yến mạch Oatside")).toBeInTheDocument();
    expect(within(desktopTable).getByText("2 Hộp (2,000 ml)")).toBeInTheDocument();
    expect(within(desktopTable).getAllByText("120,000đ").length).toBeGreaterThan(0);

    const phoneList = screen.getByTestId("phone-lines-list");
    expect(within(phoneList).getByText("Sữa yến mạch Oatside")).toBeInTheDocument();
    expect(within(phoneList).getByText("2 Hộp (2,000 ml)")).toBeInTheDocument();
    expect(within(phoneList).getAllByText("120,000đ").length).toBeGreaterThan(0);

    expect(
      screen.getByText("Toàn bộ các dòng còn hiệu lực được trả về kho hôm nay.")
    ).toBeInTheDocument();
  });
});
