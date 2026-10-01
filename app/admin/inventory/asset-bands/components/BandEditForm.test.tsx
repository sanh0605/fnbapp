// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BandEditForm } from "./BandEditForm";
import type { DBAssetDepreciationBand } from "@/types/db";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));
vi.mock("../actions", () => ({
  updateAssetBand: vi.fn(),
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});

const BAND: DBAssetDepreciationBand = {
  id: "ADB-001",
  min_unit_price: 100000,
  max_unit_price: 500000,
  term_months: 24,
  status: "ACTIVE",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("BandEditForm", () => {
  it("renders on page, immediately shows 'Số tháng khấu hao', and prefills band term", () => {
    render(<BandEditForm band={BAND} />);
    const termInput = screen.getByLabelText("Số tháng khấu hao") as HTMLInputElement;
    expect(termInput).toBeDefined();
    expect(termInput.value).toBe("24");
    expect(termInput.getAttribute("inputMode")).toBe("numeric");
  });

  it("navigates back to /admin/inventory/asset-bands when 'Bỏ' is clicked", () => {
    render(<BandEditForm band={BAND} returnTo="/admin/inventory/asset-bands" />);
    fireEvent.click(screen.getByRole("button", { name: "Bỏ" }));
    expect(push).toHaveBeenCalledWith("/admin/inventory/asset-bands");
  });
});
