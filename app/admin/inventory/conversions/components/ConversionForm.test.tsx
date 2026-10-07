// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversionForm } from "./ConversionForm";

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
    { id: "U-THUNG", name: "Thùng" },
    { id: "U-ML", name: "ml" },
  ] as any;

  it("shows the stored rate with commas and takes decimals", () => {
    render(<ConversionForm items={ITEMS} conversions={[]} units={UNITS} initialData={EDIT} />);
    const rate = screen.getByLabelText("Tỷ lệ quy đổi") as HTMLInputElement;
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
    const rate = screen.getByLabelText("Tỷ lệ quy đổi") as HTMLInputElement;
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

    // SearchableSelect renders with placeholder "Chọn hàng hóa..."
    expect(screen.getByText("Chọn hàng hóa...")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/conversions?q=sữa");
  });
});
