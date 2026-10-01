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
