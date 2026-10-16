// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import IssueSlipDetailClient from "./IssueSlipDetailClient";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";
import type { IssueSlipItemView } from "../actions";

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

const { replace, refresh, back, push, searchParams, router } = vi.hoisted(() => {
  const replaceFn = vi.fn();
  const refreshFn = vi.fn();
  const backFn = vi.fn();
  const pushFn = vi.fn();
  return {
    replace: replaceFn,
    refresh: refreshFn,
    back: backFn,
    push: pushFn,
    searchParams: new URLSearchParams(),
    router: { replace: replaceFn, refresh: refreshFn, back: backFn, push: pushFn },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/inventory/issue-slips/ISL-00076",
  useSearchParams: () => searchParams,
  useRouter: () => router,
}));

vi.mock("../actions", () => ({
  editIssueSlip: vi.fn(),
  cancelIssueSlip: vi.fn(),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});
beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  back.mockClear();
  push.mockClear();
});

vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...props }: any) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const mockItems: IssueSlipItemView[] = [
  {
    id: "item-oatside",
    name: "Sữa yến mạch Oatside",
    onHand: 10000,
    unitName: "ml",
    packageLines: [
      {
        conversionId: "conv-hop",
        purchasedItemId: "item-oatside",
        purchasedItemName: "Sữa yến mạch Oatside",
        purchasedUnitName: "Hộp",
        baseUnitName: "ml",
        conversionRate: 1000,
        sizeLabel: "Hộp (1,000 ml)",
      },
    ],
  },
];

const defaultDetail: IssueSlipDetail = {
  id: "ISL-00076",
  issuedAt: "2026-09-28T18:20:00Z",
  dateText: "28/09/2026 18:20",
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

describe("IssueSlipDetailClient", () => {
  it("canEdit=false thì không có nút Chỉnh sửa và Huỷ phiếu", () => {
    const detailLocked: IssueSlipDetail = {
      ...defaultDetail,
      canEdit: false,
      lock: { sessionId: "STK-1", confirmedAt: "2026-08-09T00:00:00Z", dateText: "09/08/2026" },
    };
    render(<IssueSlipDetailClient detail={detailLocked} items={mockItems} />);
    expect(screen.queryByRole("button", { name: "Chỉnh sửa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ phiếu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Huỷ phiếu" })).not.toBeInTheDocument();
  });

  it("Huỷ phiếu links to the cancel page", () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    const link = screen.getByRole("link", { name: "Huỷ phiếu" });
    expect(link).toHaveAttribute("href", "/admin/inventory/issue-slips/ISL-00076/cancel");
  });

  it("tick 1 dòng thì nút đổi chữ", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const desktopView = screen.getByRole("table");
    const checkboxes = within(desktopView).getAllByRole("checkbox", { name: "Chọn dòng" });
    fireEvent.click(checkboxes[0]);
    expect(screen.getByRole("button", { name: "Xoá 1 dòng đã chọn" })).toBeInTheDocument();
  });

  it("không đổi gì thì Lưu disabled", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    
    const saveBtn = screen.getByRole("button", { name: "Lưu thay đổi" });
    expect(saveBtn).toBeDisabled();
  });

  it("đổi Oatside sang 1 Hộp thì Quy ra hiện 1,000 ml", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    
    const table = screen.getByRole("table");
    const qtyInputs = within(table).getAllByRole("textbox", { name: "Số lượng" });
    const qtyInput = qtyInputs[0];
    
    fireEvent.change(qtyInput, { target: { value: "1" } });

    expect(within(table).getByText("1,000 ml")).toBeInTheDocument();
  });

  it("bỏ hết dòng thì hiện câu hỏi huỷ với nút Có dẫn sang trang huỷ", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const table = screen.getByRole("table");
    const checkboxes = within(table).getAllByRole("checkbox", { name: "Chọn dòng" });
    fireEvent.click(checkboxes[0]);
    
    fireEvent.click(screen.getByRole("button", { name: "Xoá 1 dòng đã chọn" }));
    
    const dialog = screen.getByRole("dialog", { name: "Phiếu không còn dòng" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Phiếu không còn dòng nào\. Huỷ phiếu này\?/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Có" })).toHaveAttribute(
      "href",
      "/admin/inventory/issue-slips/ISL-00076/cancel"
    );
  });

  it("tick 1 dòng xoá thì tên vẫn hiển thị trên trang", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const table = screen.getByRole("table");
    const checkboxes = within(table).getAllByRole("checkbox", { name: "Chọn dòng" });
    fireEvent.click(checkboxes[0]);
    
    fireEvent.click(screen.getByRole("button", { name: "Xoá 1 dòng đã chọn" }));
    
    // Đóng hộp thoại xác nhận huỷ
    fireEvent.click(screen.getByRole("button", { name: "Không" }));

    // Tên vẫn trong bảng
    expect(within(table).getByText("Sữa yến mạch Oatside")).toBeInTheDocument();
  });

  it("xoá dòng xong ấn bỏ thay đổi thì nút lưu mờ trở lại", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const table = screen.getByRole("table");
    const checkboxes = within(table).getAllByRole("checkbox", { name: "Chọn dòng" });
    fireEvent.click(checkboxes[0]);
    
    fireEvent.click(screen.getByRole("button", { name: "Xoá 1 dòng đã chọn" }));
    
    // Đóng hộp thoại
    fireEvent.click(screen.getByRole("button", { name: "Không" }));
    
    // Ấn bỏ thay đổi (thoát về view)
    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    
    // Vào lại chế độ sửa
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
  });

  // BR-UI-008 (owner 2026-10-07): a dot marks decimals. A saved 2.5 ml must
  // open as "2.5" -- "2,5" would now read as 25 once the box drops the comma.
  it("opens a saved 2.5 ml line with 2.5 in the box, dot not comma", async () => {
    const detail: IssueSlipDetail = {
      ...defaultDetail,
      lines: [{ ...defaultDetail.lines[0], baseQuantity: 2.5, quantityText: "2.5 ml" }],
    };
    render(<IssueSlipDetailClient detail={detail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const table = screen.getByRole("table");
    const qtyInput = within(table).getAllByRole("textbox", { name: "Số lượng" })[0] as HTMLInputElement;
    expect(qtyInput.value).toBe("2.5");
  });

  it("typing 1.5 Hộp reads one and a half boxes: Quy ra 1,500 ml", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const table = screen.getByRole("table");
    const qtyInput = within(table).getAllByRole("textbox", { name: "Số lượng" })[0] as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: "1.5" } });

    expect(qtyInput.value).toBe("1.5");
    expect(within(table).getByText("1,500 ml")).toBeInTheDocument();
  });

  it("shows live computed value when quantity changes", async () => {
    render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    const table = screen.getByRole("table");
    
    // Đổi số lượng từ 2 Hộp (2000 ml) sang 1 Hộp (1000 ml)
    const qtyInputs = within(table).getAllByRole("textbox", { name: "Số lượng" });
    fireEvent.change(qtyInputs[0], { target: { value: "1" } });

    // Hiển thị giá trị mới 36.803đ trên dòng đó
    // The slip has one line, so the line cell and the live total both read 36.803đ.
    expect(within(table).getAllByText("36,803đ")).toHaveLength(2);
  });

  // BR-UI-005 / BR-UI-008 (wave K3): the edit box is the shared number box.
  describe("shared number box (wave K3)", () => {
    function editBox(): HTMLInputElement {
      fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
      const table = screen.getByRole("table");
      return within(table).getAllByRole("textbox", { name: "Số lượng" })[0] as HTMLInputElement;
    }

    it("an emptied box shows the example 'Ví dụ: 1,250.5'", () => {
      render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
      const box = editBox();
      fireEvent.change(box, { target: { value: "" } });
      expect(box.placeholder).toBe("Ví dụ: 1,250.5");
    });

    it("typing 1,5 shows 15 and says the decimal mark is a dot", () => {
      render(<IssueSlipDetailClient detail={defaultDetail} items={mockItems} />);
      const box = editBox();
      fireEvent.change(box, { target: { value: "" } });
      fireEvent.change(box, { target: { value: "1,5" } });
      expect(box.value).toBe("15");
      expect(screen.getByRole("table").textContent).toContain("Số lẻ dùng dấu chấm, ví dụ 1.5");
    });

    it("a saved 1,250.5 ml line opens as 1,250.5", () => {
      const detail: IssueSlipDetail = {
        ...defaultDetail,
        lines: [{ ...defaultDetail.lines[0], baseQuantity: 1250.5, quantityText: "1,250.5 ml" }],
      };
      render(<IssueSlipDetailClient detail={detail} items={mockItems} />);
      expect(editBox().value).toBe("1,250.5");
    });
  });

  // Review Focus 4 (wave K3): the back link returns to the list the slip was
  // opened from, filter included.
  it("the back link goes to the list it came from", () => {
    render(
      <IssueSlipDetailClient
        detail={defaultDetail}
        items={mockItems}
        returnTo="/admin/inventory/issue-slips?kind=SLIP&page=2"
      />,
    );
    const back = screen.getAllByRole("link").find(a => a.textContent?.includes("Phiếu xuất"));
    expect(back?.getAttribute("href")).toBe("/admin/inventory/issue-slips?kind=SLIP&page=2");
  });

  describe("Reason (note) display rules (BR-INV-014)", () => {
    it("does not render 'Lý do:' at all when note is empty", () => {
      const detailEmptyNote = { ...defaultDetail };
      render(<IssueSlipDetailClient detail={detailEmptyNote} items={mockItems} />);
      expect(screen.queryByText(/Lý do:/)).not.toBeInTheDocument();
    });

    it("still renders 'Lý do huỷ:' when cancelled", () => {
      const detailCancelled = {
        ...defaultDetail,
        cancellation: { at: "2026-09-29T10:00:00Z", dateText: "29/09/2026 17:00", reason: "Sai số lượng" },
        canEdit: false,
      };
      render(<IssueSlipDetailClient detail={detailCancelled} items={mockItems} />);
      expect(screen.getByText(/Lý do huỷ:/)).toBeInTheDocument();
      expect(screen.getByText(/Sai số lượng/)).toBeInTheDocument();
    });
  });
});
