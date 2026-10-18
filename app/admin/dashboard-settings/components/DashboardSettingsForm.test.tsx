// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSettingsForm } from "./DashboardSettingsForm";
import { saveDashboardSettings } from "../actions";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("../actions", () => ({ saveDashboardSettings: vi.fn() }));

afterEach(() => cleanup());
beforeEach(() => {
  vi.mocked(saveDashboardSettings).mockReset();
  push.mockClear();
});

const SETTINGS = {
  id: 1,
  stale_stocktake_days: 30,
  open_stocktake_days: 2,
  reminder_start_day: 25,
  food_product_ids: ["PROD-028", "PROD-027"],
  topping_type_id: "PT-003",
  updated_at: "2026-10-14T09:00:00Z",
} as any;
const PRODUCTS = [
  { id: "PROD-001", name: "Cà phê đá", status: "ACTIVE" },
  { id: "PROD-027", name: "Khoai lang", status: "ACTIVE" },
  { id: "PROD-028", name: "Trứng luộc", status: "ACTIVE" },
  { id: "PROD-090", name: "Bánh mì", status: "INACTIVE" },
] as any;
const TYPES = [
  { id: "PT-001", name: "Thức uống", is_drink: true },
  { id: "PT-003", name: "Topping", is_drink: false },
] as any;

function renderForm() {
  return render(<DashboardSettingsForm settings={SETTINGS} products={PRODUCTS} types={TYPES} />);
}

describe("DashboardSettingsForm (plan 2026-10-14-tong-quan-moi, Hiện trạng item 4)", () => {
  it("starts with the saved numbers in numeric boxes", () => {
    const { container } = renderForm();
    // Shared NumberInput (BR-UI-005): the visible box shows the number, a hidden input posts it.
    const posted = (name: string) => (container.querySelector(`input[type=hidden][name=${name}]`) as HTMLInputElement).value;
    const stale = screen.getByLabelText(/lâu chưa kiểm kê/) as HTMLInputElement;
    const open = screen.getByLabelText(/phiếu kiểm kê mở dở/) as HTMLInputElement;
    const start = screen.getByLabelText(/Ngày bắt đầu nhắc/) as HTMLInputElement;
    expect([posted("stale_stocktake_days"), stale.value, stale.getAttribute("inputMode")]).toEqual(["30", "30", "numeric"]);
    expect([posted("open_stocktake_days"), open.value, open.getAttribute("inputMode")]).toEqual(["2", "2", "numeric"]);
    expect([posted("reminder_start_day"), start.value, start.getAttribute("inputMode")]).toEqual(["25", "25", "numeric"]);
  });

  it("offers active dishes as food columns with the saved ones ticked, hiding retired dishes not chosen", () => {
    renderForm();
    const ticked = (name: string) => (screen.getByLabelText(name) as HTMLInputElement).checked;
    expect(ticked("Trứng luộc")).toBe(true);
    expect(ticked("Khoai lang")).toBe(true);
    expect(ticked("Cà phê đá")).toBe(false);
    expect(screen.queryByLabelText("Bánh mì")).toBeNull();
    expect((screen.getByLabelText("Trứng luộc") as HTMLInputElement).name).toBe("food_product_ids");
  });

  it("keeps a chosen dish that has since stopped selling and marks it as không còn bán", () => {
    render(<DashboardSettingsForm settings={{ ...SETTINGS, food_product_ids: ["PROD-090"] }} products={PRODUCTS} types={TYPES} />);
    expect((screen.getByLabelText("Bánh mì") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/không còn bán/)).toBeInTheDocument();
  });

  it("settings save disabled for a manager", () => {
    render(<DashboardSettingsForm settings={SETTINGS} products={PRODUCTS} types={TYPES} isOwner={false} />);
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(screen.getByText("Chỉ chủ quán sửa được mục này")).toBeInTheDocument();
    expect(screen.getByLabelText("Trứng luộc")).toBeDisabled();
    expect(screen.getByLabelText("Cột topping mua riêng")).toBeDisabled();
  });

  it("sorts saved food columns first, then rest by name", () => {
    renderForm();
    const checkboxes = screen.getAllByRole("checkbox");
    const labels = checkboxes.map((cb) => cb.getAttribute("aria-label"));
    expect(labels).toEqual(["Khoai lang", "Trứng luộc", "Cà phê đá"]);
  });

  it("inactive dish not offered if not already chosen", () => {
    renderForm();
    expect(screen.queryByLabelText("Bánh mì")).toBeNull();
    expect(screen.queryByText(/Bánh mì/)).toBeNull();
  });

  it("chooses the topping column's type or Không hiện", () => {
    renderForm();
    const select = screen.getByLabelText(/Cột topping mua riêng/) as HTMLSelectElement;
    expect(select.name).toBe("topping_type_id");
    expect([...select.options].map(o => [o.value, o.textContent])).toEqual([
      ["", "Không hiện"], ["PT-001", "Thức uống"], ["PT-003", "Topping"],
    ]);
    expect(select.value).toBe("PT-003");
  });

  it("shows the server's message under the box it is about and does not leave the page", async () => {
    vi.mocked(saveDashboardSettings).mockResolvedValue({ error: "Nhập số từ 1 đến 28", field: "reminder_start_day" } as never);
    const { container } = renderForm();
    fireEvent.change(screen.getByLabelText(/Ngày bắt đầu nhắc/), { target: { value: "31" } });
    fireEvent.submit(container.querySelector("form")!);
    const msg = await screen.findByText("Nhập số từ 1 đến 28");
    // The shared Field puts its error at id `${htmlFor}-message`, right under the box.
    const startBox = screen.getByLabelText(/Ngày bắt đầu nhắc/) as HTMLElement;
    expect(msg.id).toBe(`${startBox.id}-message`);
    expect(push).not.toHaveBeenCalled();
  });

  it("a successful save goes back to Tổng quan", async () => {
    vi.mocked(saveDashboardSettings).mockResolvedValue({ error: null } as never);
    const { container } = renderForm();
    fireEvent.submit(container.querySelector("form")!);
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });
});
