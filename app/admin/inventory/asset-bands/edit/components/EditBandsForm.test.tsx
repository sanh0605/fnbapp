// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { EditBandsForm } from "./EditBandsForm";
import type { DBAssetDepreciationBand } from "@/types/db";
import { saveAssetBands } from "../../actions";

const { push, refresh, router } = vi.hoisted(() => {
  const pushFn = vi.fn();
  const refreshFn = vi.fn();
  return {
    push: pushFn,
    refresh: refreshFn,
    router: { push: pushFn, refresh: refreshFn },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../../actions", () => ({
  saveAssetBands: vi.fn(),
}));

vi.mock("@/app/admin/inventory/asset-bands/actions", () => ({
  saveAssetBands: vi.fn(),
}));

const INITIAL_BANDS: DBAssetDepreciationBand[] = [
  {
    id: "KH-001",
    min_unit_price: 0,
    max_unit_price: 200000,
    term_months: 12,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-002",
    min_unit_price: 200000,
    max_unit_price: 500000,
    term_months: 24,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "KH-003",
    min_unit_price: 500000,
    max_unit_price: null,
    term_months: 36,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditBandsForm", () => {
  it("worked example: adds row (50000, 12), changes first row to 6, Lưu sends four rows with ids KH-001/KH-002/KH-003 kept and one id: null", async () => {
    vi.mocked(saveAssetBands).mockResolvedValue({ success: true, ok: true } as any);

    render(
      <EditBandsForm
        bands={INITIAL_BANDS}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    const table = screen.getByRole("table");

    // Click "Thêm khung" to append a new row
    const addBtn = screen.getByRole("button", { name: "Thêm khung" });
    fireEvent.click(addBtn);

    // Get the min and term inputs inside desktop table
    const minInputs = within(table).getAllByLabelText("Từ giá (đ)");
    const termInputs = within(table).getAllByLabelText("Số tháng");

    expect(minInputs).toHaveLength(4);
    expect(termInputs).toHaveLength(4);

    // Type 50000 and 12 on the newly added 4th row (index 3)
    fireEvent.change(minInputs[3], { target: { value: "50000" } });
    fireEvent.change(termInputs[3], { target: { value: "12" } });

    // Change the first row's term from 12 to 6
    fireEvent.change(termInputs[0], { target: { value: "6" } });

    // Click "Lưu"
    const saveBtn = screen.getByRole("button", { name: "Lưu" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(saveAssetBands).toHaveBeenCalledTimes(1);
    });

    const fd = vi.mocked(saveAssetBands).mock.calls[0][0];
    const bandsJson = fd.get("bands") as string;
    expect(bandsJson).toBeDefined();

    const bands = JSON.parse(bandsJson);
    expect(bands).toHaveLength(4);

    expect(bands).toEqual(
      expect.arrayContaining([
        { id: "KH-001", min_unit_price: 0, term_months: 6 },
        { id: "KH-002", min_unit_price: 200000, term_months: 24 },
        { id: "KH-003", min_unit_price: 500000, term_months: 36 },
        { id: null, min_unit_price: 50000, term_months: 12 },
      ])
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/admin/inventory/asset-bands");
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("'Đến dưới' follows the next row's 'Từ giá' and last row is 'Không giới hạn'", () => {
    render(
      <EditBandsForm
        bands={INITIAL_BANDS}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    const table = screen.getByRole("table");
    const tableRows = within(table).getAllByRole("row");
    // Row 0 is header. Row 1: KH-001, Row 2: KH-002, Row 3: KH-003
    expect(within(tableRows[1]).getByText("200,000đ")).toBeInTheDocument();
    expect(within(tableRows[2]).getByText("500,000đ")).toBeInTheDocument();
    expect(within(tableRows[3]).getByText("Không giới hạn")).toBeInTheDocument();

    // Change row 2 (KH-002)'s min from 200,000 to 300,000
    const minInputs = within(table).getAllByLabelText("Từ giá (đ)");
    fireEvent.change(minInputs[1], { target: { value: "300000" } });

    // Row 1's "Đến dưới" should now reflect 300,000đ
    expect(within(tableRows[1]).getByText("300,000đ")).toBeInTheDocument();
  });

  it("trash hidden when canRemove is false", () => {
    render(
      <EditBandsForm
        bands={INITIAL_BANDS}
        canRemove={false}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("trash hidden when only one row is left", () => {
    const singleBand: DBAssetDepreciationBand[] = [INITIAL_BANDS[0]];
    render(
      <EditBandsForm
        bands={singleBand}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("removes row when trash is clicked and hides trash when 1 row is left", () => {
    const twoBands: DBAssetDepreciationBand[] = [INITIAL_BANDS[0], INITIAL_BANDS[1]];
    render(
      <EditBandsForm
        bands={twoBands}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    const table = screen.getByRole("table");
    const deleteButtons = within(table).getAllByRole("button", { name: /Xoá/ });
    expect(deleteButtons).toHaveLength(2);

    // Delete row 1 (KH-002)
    fireEvent.click(deleteButtons[1]);

    // Now only 1 row remains
    const remainingMinInputs = within(table).getAllByLabelText("Từ giá (đ)");
    expect(remainingMinInputs).toHaveLength(1);

    // Trash buttons must now be hidden
    expect(within(table).queryByRole("button", { name: /Xoá/ })).toBeNull();
  });

  it("first row 'Từ giá' is fixed at 0 and not editable (disabled)", () => {
    render(
      <EditBandsForm
        bands={INITIAL_BANDS}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    const table = screen.getByRole("table");
    const minInputs = within(table).getAllByLabelText("Từ giá (đ)");
    const firstMin = minInputs[0] as HTMLInputElement;

    expect(firstMin.value).toBe("0");
    expect(firstMin).toBeDisabled();
  });

  it("shows Vietnamese error inline on action failure", async () => {
    vi.mocked(saveAssetBands).mockResolvedValue({
      ok: false,
      error: "Khung khấu hao và khung tiếp theo chồng lấn",
    } as any);

    render(
      <EditBandsForm
        bands={INITIAL_BANDS}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands"
      />
    );

    const saveBtn = screen.getByRole("button", { name: "Lưu" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Khung khấu hao và khung tiếp theo chồng lấn");
    });

    expect(push).not.toHaveBeenCalled();
  });

  it("navigates back to returnTo without saving when 'Bỏ' is clicked", () => {
    render(
      <EditBandsForm
        bands={INITIAL_BANDS}
        canRemove={true}
        returnTo="/admin/inventory/asset-bands?page=2"
      />
    );

    const cancelBtn = screen.getByRole("button", { name: "Bỏ" });
    fireEvent.click(cancelBtn);

    expect(push).toHaveBeenCalledWith("/admin/inventory/asset-bands?page=2");
    expect(saveAssetBands).not.toHaveBeenCalled();
  });
});
