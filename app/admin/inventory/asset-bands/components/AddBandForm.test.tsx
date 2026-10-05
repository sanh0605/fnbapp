// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddBandForm } from "./AddBandForm";

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

  it("navigates back to /admin/inventory/asset-bands when 'Bỏ' is clicked", () => {
    render(<AddBandForm returnTo="/admin/inventory/asset-bands" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/asset-bands");
  });
});
