// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddBandForm } from "./AddBandForm";
import { createAssetBand } from "../actions";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("../actions", () => ({
  createAssetBand: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

describe("AddBandForm", () => {
  it("renders on page and immediately shows the 'Số tháng khấu hao' input", () => {
    render(<AddBandForm />);
    const termInput = screen.getByLabelText("Số tháng khấu hao") as HTMLInputElement;
    expect(termInput).toBeDefined();
    expect(termInput.value).toBe("");
    expect(termInput.getAttribute("inputMode")).toBe("numeric");
  });

  // BR-UI-005 / BR-UI-008 (wave K3): the shared number box, no spinner arrows,
  // commas added while typing, the posted value still plain digits.
  it("the price and term boxes are the shared number box and post plain digits", async () => {
    vi.mocked(createAssetBand).mockResolvedValue({} as never);
    render(<AddBandForm />);
    const min = screen.getByLabelText(/^Giá thấp nhất/) as HTMLInputElement;
    const max = screen.getByLabelText(/^Giá cao nhất/) as HTMLInputElement;
    const term = screen.getByLabelText("Số tháng khấu hao") as HTMLInputElement;
    expect(min.type).toBe("text");
    expect(min.placeholder).toBe("Ví dụ: 150,000");
    expect(term.type).toBe("text");
    expect(term.placeholder).toBe("Ví dụ: 12");

    fireEvent.change(min, { target: { value: "1500000" } });
    expect(min.value).toBe("1,500,000");
    fireEvent.change(term, { target: { value: "36" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await vi.waitFor(() => expect(createAssetBand).toHaveBeenCalled());
    const fd = vi.mocked(createAssetBand).mock.calls[0][0] as FormData;
    expect(fd.get("min_unit_price")).toBe("1500000");
    expect(fd.get("max_unit_price")).toBe("");
    expect(fd.get("term_months")).toBe("36");
    void max;
  });

  // Review Focus 2: a band can start at 0đ, so a typed 0 stays 0.
  it("keeps a typed 0 in the lowest-price box", () => {
    render(<AddBandForm />);
    const min = screen.getByLabelText(/^Giá thấp nhất/) as HTMLInputElement;
    fireEvent.change(min, { target: { value: "0" } });
    expect(min.value).toBe("0");
  });

  it("navigates back to /admin/inventory/asset-bands when 'Bỏ' is clicked", () => {
    render(<AddBandForm returnTo="/admin/inventory/asset-bands" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/asset-bands");
  });
});
