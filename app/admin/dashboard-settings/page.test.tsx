// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DashboardSettingsPage from "./page";
import { getDashboardSettings } from "./actions";
import { findAll } from "@/lib/db/tables";
import { getProductTypes } from "@/app/admin/products/types/actions";
import { resolveActor } from "@/lib/auth/auth";

vi.mock("./actions", () => ({
  getDashboardSettings: vi.fn(),
  saveDashboardSettings: vi.fn(),
}));

vi.mock("@/lib/db/tables", () => ({
  findAll: vi.fn(),
}));

vi.mock("@/app/admin/products/types/actions", () => ({
  getProductTypes: vi.fn(),
}));

vi.mock("@/lib/auth/auth", () => ({
  resolveActor: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveActor).mockResolvedValue({
    ok: true,
    actor: { id: "USR-001", name: "Chủ quán", role: "ADMIN" },
  });
});

const SETTINGS = {
  id: 1,
  stale_stocktake_days: 30,
  open_stocktake_days: 2,
  reminder_start_day: 25,
  food_product_ids: ["PROD-028"],
  topping_type_id: "PT-003",
  updated_at: "2026-10-14T09:00:00Z",
};

const PRODUCTS = [
  { id: "PROD-028", name: "Trứng luộc", status: "ACTIVE" },
];

const TYPE_ROWS = [
  {
    type: { id: "PT-003", name: "Topping", is_drink: false, created_at: "2026-10-14T09:00:00Z" },
    categoryCount: 1,
    categoryNames: ["Topping"],
  },
];

describe("DashboardSettingsPage", () => {
  it("renders page with header, back link and form when settings exist", async () => {
    vi.mocked(getDashboardSettings).mockResolvedValue(SETTINGS as any);
    vi.mocked(findAll).mockResolvedValue(PRODUCTS as any);
    vi.mocked(getProductTypes).mockResolvedValue(TYPE_ROWS as any);

    const jsx = await DashboardSettingsPage();
    render(jsx);

    expect(screen.getByText("Cài đặt Tổng quan")).toBeInTheDocument();
    expect(screen.getByText("Chỉnh các mốc báo động và các cột của bảng 7 ngày.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tổng quan/ })).toHaveAttribute("href", "/admin");
    expect(screen.getByLabelText(/lâu chưa kiểm kê/)).toHaveValue("30");
  });

  it("shows alert when settings row is null", async () => {
    vi.mocked(getDashboardSettings).mockResolvedValue(null);
    vi.mocked(findAll).mockResolvedValue(PRODUCTS as any);
    vi.mocked(getProductTypes).mockResolvedValue(TYPE_ROWS as any);

    const jsx = await DashboardSettingsPage();
    render(jsx);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Chưa có dòng cài đặt. Báo lại cho người làm phần mềm.");
  });

  it("a manager sees 'Chỉ chủ quán sửa được mục này'", async () => {
    vi.mocked(resolveActor).mockResolvedValue({
      ok: true,
      actor: { id: "USR-002", name: "Quản lý", role: "MANAGER" },
    });
    vi.mocked(getDashboardSettings).mockResolvedValue(SETTINGS as any);
    vi.mocked(findAll).mockResolvedValue(PRODUCTS as any);
    vi.mocked(getProductTypes).mockResolvedValue(TYPE_ROWS as any);

    const jsx = await DashboardSettingsPage();
    render(jsx);

    expect(screen.getByText("Chỉ chủ quán sửa được mục này")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeDisabled();
  });
});
