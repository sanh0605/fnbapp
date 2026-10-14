// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { StocktakeEditForm } from "./StocktakeEditForm";
import type { StocktakeDetailView as Detail } from "@/app/admin/inventory/stocktake/actions";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/admin/inventory/stocktake/STK-001/edit",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/admin/inventory/stocktake/actions", () => ({
  editConfirmedStocktake: vi.fn(),
}));

import { editConfirmedStocktake } from "@/app/admin/inventory/stocktake/actions";

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

// Spec docs/superpowers/specs/2026-10-14-sua-phieu-kiem-ke-design.md, section 2.
const DETAIL: Detail = {
  id: "STK-001",
  status: "CONFIRMED",
  createdByName: "tuyen2612",
  confirmedAt: "2026-08-09T15:02:24.914754+00:00",
  confirmedByName: "admin",
  reversedAt: null,
  notes: "",
  editBlock: null,
  lines: [
    { id: "SKL-00004", itemReference: "SPM-004", itemName: "Bột cà phê truyền thống Phin Đậm", unitName: "g", countedQty: 4000, theoreticalAtCount: 6000 },
    { id: "SKL-00007", itemReference: "SPM-008", itemName: "Bột milkfoam muối biển", unitName: "g", countedQty: 2000, theoreticalAtCount: 2000 },
  ],
};

const box = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const lineOf = (container: HTMLElement, id: string) => container.querySelector(`[data-line-id="${id}"]`) as HTMLElement;

describe("StocktakeEditForm (BR-INV-012)", () => {
  it("has exactly one decimal number box per line, filled with the current count", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(box("Bột cà phê truyền thống Phin Đậm").value).toBe("4,000");
    expect(box("Bột cà phê truyền thống Phin Đậm").getAttribute("inputMode")).toBe("decimal");
    expect(box("Bột milkfoam muối biển").value).toBe("2,000");
  });

  it("recomputes the variance as the owner types", () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    expect(lineOf(container, "SKL-00004")).toHaveTextContent("Thiếu 2,000");
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "5000" } });
    expect(lineOf(container, "SKL-00004")).toHaveTextContent("Thiếu 1,000");
    fireEvent.change(box("Bột milkfoam muối biển"), { target: { value: "2500" } });
    expect(lineOf(container, "SKL-00007")).toHaveTextContent("Dư 500");
  });

  it("sends only the changed lines and goes back to the stocktake page", async () => {
    vi.mocked(editConfirmedStocktake).mockResolvedValue({ success: true, changedCount: 1 } as never);
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "5000" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(editConfirmedStocktake).toHaveBeenCalledWith("STK-001", [{ lineId: "SKL-00004", countedQty: 5000 }]));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/inventory/stocktake/STK-001"));
  });

  it("with nothing changed, saves nothing and goes back", async () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/inventory/stocktake/STK-001"));
    expect(editConfirmedStocktake).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and stays on the page", async () => {
    vi.mocked(editConfirmedStocktake).mockResolvedValue({ error: "Chỉ sửa được phiếu kiểm kê mới nhất (STK-002), không phải STK-001" } as never);
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "5000" } });
    fireEvent.submit(container.querySelector("form")!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Chỉ sửa được phiếu kiểm kê mới nhất");
    expect(push).not.toHaveBeenCalled();
  });

  it("lets a line left uncounted at the count stay empty (BR-INV-011)", () => {
    const uncounted = { ...DETAIL.lines[1], countedQty: null };
    render(<StocktakeEditForm detail={{ ...DETAIL, lines: [DETAIL.lines[0], uncounted] }} />);
    expect(box("Bột cà phê truyền thống Phin Đậm").required).toBe(true);
    expect(box("Bột milkfoam muối biển").required).toBe(false);
  });

  it("has no popup and no reason box (owner 2026-10-14, 2b)", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByLabelText(/lý do/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bỏ" }).getAttribute("href")).toBe("/admin/inventory/stocktake/STK-001");
  });
});
