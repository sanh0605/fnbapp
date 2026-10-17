// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversionForm } from "./ConversionForm";
import { updateConversion } from "../actions";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("../actions", () => ({
  addConversion: vi.fn().mockResolvedValue({}),
  updateConversion: vi.fn().mockResolvedValue({}),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
  vi.clearAllMocks();
});

const ITEMS = [
  { id: "ITEM-1", name: "Sữa đặc", item_category_id: "CAT-1" },
] as any;

// BR-UI-005 / BR-UI-008 (wave K3): the rate box is the shared number box with
// 6 decimals; it must be above 0.
describe("ConversionForm rate box", () => {
  const EDIT = {
    id: "CONV-1",
    purchased_item_id: "ITEM-1",
    purchased_unit: "U-THUNG",
    conversion_rate: "1000",
    base_unit: "U-ML",
  } as any;
  const UNITS = [
    { id: "U-THUNG", name: "Thùng", status: "ACTIVE" },
    { id: "U-ML", name: "ml", status: "ACTIVE" },
  ] as any;

  it("shows the stored rate with commas and takes decimals", () => {
    render(<ConversionForm items={ITEMS} conversions={[]} units={UNITS} initialData={EDIT} />);
    const rate = screen.getByLabelText("Hệ số quy đổi") as HTMLInputElement;
    expect(rate.type).toBe("text");
    expect(rate.getAttribute("inputMode")).toBe("decimal");
    expect(rate.value).toBe("1,000");
    fireEvent.change(rate, { target: { value: "0.5" } });
    expect(rate.value).toBe("0.5");
  });

  it("the preview line shows the rate with commas", () => {
    const { container } = render(
      <ConversionForm items={ITEMS} conversions={[EDIT]} units={UNITS} initialData={EDIT} />,
    );
    expect(container.textContent).toContain("1 Thùng = 1,000 ml");
  });

  it('a rate of 0 says "Nhập số lớn hơn 0." under the box when leaving it', () => {
    render(<ConversionForm items={ITEMS} conversions={[]} units={UNITS} initialData={EDIT} />);
    const rate = screen.getByLabelText("Hệ số quy đổi") as HTMLInputElement;
    fireEvent.change(rate, { target: { value: "0" } });
    fireEvent.blur(rate);
    expect(screen.getByText("Nhập số lớn hơn 0.")).toBeInTheDocument();
  });
});

describe("ConversionForm on-page behaviour", () => {
  it("renders on page seeing item select and Bỏ navigates to returnTo without saving", () => {
    render(
      <ConversionForm
        items={ITEMS}
        conversions={[]}
        units={[]}
        returnTo="/admin/inventory/conversions?q=sữa"
      />,
    );

    // SearchableSelect renders with placeholder "Chọn hàng hoá..."
    expect(screen.getByText("Chọn hàng hoá...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/conversions?q=sữa");
  });
});

describe("ConversionForm update_history removed (audit A5)", () => {
  const EDIT = {
    id: "CONV-1",
    purchased_item_id: "ITEM-1",
    purchased_unit: "U-THUNG",
    conversion_rate: "1000",
    base_unit: "U-ML",
  } as any;
  const UNITS = [
    { id: "U-THUNG", name: "Thùng", status: "ACTIVE" },
    { id: "U-ML", name: "ml", status: "ACTIVE" },
  ] as any;

  it("edit form does not render the update_history checkbox and does not send update_history in FormData", () => {
    render(<ConversionForm items={ITEMS} conversions={[EDIT]} units={UNITS} initialData={EDIT} />);

    expect(screen.queryByLabelText(/Cập nhật đơn vị mua cho các đơn hàng cũ/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));

    expect(updateConversion).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(updateConversion).mock.calls[0][0] as FormData;
    expect(fd.get("update_history")).toBeNull();
  });
});

// jsdom has no scrollIntoView; the picker calls it when it opens.
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => {};
}

describe("ConversionForm stopped units (B4)", () => {
  const UNITS_WITH_INACTIVE = [
    { id: "U-THUNG", name: "Thùng", status: "ACTIVE" },
    { id: "U-ML", name: "ml", status: "ACTIVE" },
    { id: "U-INACTIVE", name: "Bao Cũ", status: "INACTIVE" },
  ] as any;

  it("a new conversion does not see the INACTIVE unit in the picker", () => {
    render(<ConversionForm items={ITEMS} conversions={[]} units={UNITS_WITH_INACTIVE} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Ví dụ: Thùng 24 lon" }));
    const options = screen.getAllByRole("option").map(el => el.textContent?.trim());
    expect(options).toContain("Thùng");
    expect(options).toContain("ml");
    expect(options).not.toContain("Bao Cũ");
  });

  it("an existing conversion whose unit is INACTIVE still shows as an option and saves", () => {
    const EDIT_INACTIVE = {
      id: "CONV-INACTIVE",
      purchased_item_id: "ITEM-1",
      purchased_unit: "U-INACTIVE",
      conversion_rate: "10",
      base_unit: "U-ML",
    } as any;
    render(
      <ConversionForm
        items={ITEMS}
        conversions={[EDIT_INACTIVE]}
        units={UNITS_WITH_INACTIVE}
        initialData={EDIT_INACTIVE}
      />
    );
    expect(screen.getByText("Bao Cũ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(updateConversion).toHaveBeenCalledTimes(1);
    const fd = vi.mocked(updateConversion).mock.calls[0][0] as FormData;
    expect(fd.get("purchased_unit")).toBe("U-INACTIVE");
  });

  it("shows FormActionBar with 'Tạo' and 'Bỏ' in create mode", () => {
    render(<ConversionForm items={ITEMS} conversions={[]} units={UNITS_WITH_INACTIVE} />);
    expect(screen.getByRole("button", { name: "Tạo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ" })).toBeInTheDocument();
  });

  it("shows FormActionBar with 'Lưu thay đổi' and 'Bỏ thay đổi' in edit mode", () => {
    const EDIT = {
      id: "CONV-1",
      purchased_item_id: "ITEM-1",
      purchased_unit: "U-THUNG",
      conversion_rate: "1000",
      base_unit: "U-ML",
    } as any;
    render(
      <ConversionForm
        items={ITEMS}
        conversions={[EDIT]}
        units={UNITS_WITH_INACTIVE}
        initialData={EDIT}
        returnTo="/admin/inventory/conversions"
      />
    );
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/conversions");
  });
});

