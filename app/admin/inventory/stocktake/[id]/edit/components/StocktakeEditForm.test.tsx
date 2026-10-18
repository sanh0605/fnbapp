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
    expect(screen.getAllByRole("textbox")).toHaveLength(3); // two count boxes + the Tìm hàng box
    expect(box("Bột cà phê truyền thống Phin Đậm").value).toBe("4,000");
    expect(box("Bột cà phê truyền thống Phin Đậm").getAttribute("inputMode")).toBe("decimal");
    expect(box("Bột milkfoam muối biển").value).toBe("2,000");
  });

  it("recomputes the variance as the owner types", () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    expect(lineOf(container, "SKL-00004")).toHaveTextContent("Thiếu 2,000 g");
    expect(lineOf(container, "SKL-00007")).toHaveTextContent("Khớp");
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "5000" } });
    expect(lineOf(container, "SKL-00004")).toHaveTextContent("Thiếu 1,000 g");
    fireEvent.change(box("Bột milkfoam muối biển"), { target: { value: "2500" } });
    expect(lineOf(container, "SKL-00007")).toHaveTextContent("Thừa 500 g");
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
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ thay đổi" })).toBeInTheDocument();
  });
});

describe("Ticket 6c: StocktakeEditForm FormActionBar and phone layout", () => {
  it("uses FormActionBar with 'Lưu thay đổi' and cancel button", () => {
    render(<StocktakeEditForm detail={DETAIL} />);

    const saveBtn = screen.getByRole("button", { name: "Lưu thay đổi" });
    expect(saveBtn).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Bỏ thay đổi" });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);
    expect(push).toHaveBeenCalledWith("/admin/inventory/stocktake/STK-001");
  });

  it("on phone layout: each line has name + unit on the left and a 48px number box 9rem wide on the right", () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    const lineEl = lineOf(container, "SKL-00004");
    expect(lineEl).toBeInTheDocument();

    expect(lineEl.textContent).toContain("Bột cà phê truyền thống Phin Đậm");
    expect(lineEl.textContent).toMatch(/Sổ lúc đếm.*\d.*g/);

    const input = lineEl.querySelector("input")!;
    expect(input).toBeInTheDocument();
    expect(input.className).toContain("min-h-[48px]");

    const inputContainer = input.closest(".w-36, .w-\\[9rem\\]") || input;
    expect(inputContainer.className).toMatch(/\b(w-36|w-\[9rem\])\b/);
  });
});

describe("search and chips (H2)", () => {
  it("typing 'milkfoam' in the 'Tìm hàng' box leaves only the 'Bột milkfoam muối biển' box", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(screen.getByLabelText("Tìm hàng"), { target: { value: "milkfoam" } });
    expect(screen.getByLabelText("Bột milkfoam muối biển")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bột cà phê truyền thống Phin Đậm")).toBeNull();
  });

  it("typing a search is not an unsaved change; typing a count is", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(screen.getByLabelText("Tìm hàng"), { target: { value: "milkfoam" } });
    expect(screen.queryByText("Có thay đổi chưa lưu")).toBeNull();
    fireEvent.change(box("Bột milkfoam muối biển"), { target: { value: "1500" } });
    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument();
  });

  it("tapping 'Lệch (1)' leaves only Phin Đậm, tapping 'Khớp (1)' leaves only milkfoam, tapping 'Tất cả (2)' shows both", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.click(screen.getByRole("button", { name: "Lệch (1)" }));
    expect(screen.getByLabelText("Bột cà phê truyền thống Phin Đậm")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bột milkfoam muối biển")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Khớp (1)" }));
    expect(screen.getByLabelText("Bột milkfoam muối biển")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bột cà phê truyền thống Phin Đậm")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả (2)" }));
    expect(screen.getByLabelText("Bột cà phê truyền thống Phin Đậm")).toBeInTheDocument();
    expect(screen.getByLabelText("Bột milkfoam muối biển")).toBeInTheDocument();
  });

  it("after tapping 'Lệch (1)', typing 6000 keeps row on screen and updates chips, and submitting sends changed line", async () => {
    vi.mocked(editConfirmedStocktake).mockResolvedValue({ success: true, changedCount: 1 } as never);
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);

    fireEvent.click(screen.getByRole("button", { name: "Lệch (1)" }));
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "6000" } });

    expect(screen.getByLabelText("Bột cà phê truyền thống Phin Đậm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lệch (0)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Khớp (2)" })).toBeInTheDocument();

    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(editConfirmedStocktake).toHaveBeenCalledWith("STK-001", [
        { lineId: "SKL-00004", countedQty: 6000 },
      ])
    );
  });

  it("a changed line hidden by a chip is still saved", async () => {
    vi.mocked(editConfirmedStocktake).mockResolvedValue({ success: true, changedCount: 1 } as never);
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Khớp (1)" }));
    expect(screen.queryByLabelText("Bột cà phê truyền thống Phin Đậm")).toBeNull();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(editConfirmedStocktake).toHaveBeenCalledWith("STK-001", [
        { lineId: "SKL-00004", countedQty: 5000 },
      ])
    );
  });

  it("a counted line emptied and hidden by a chip blocks Lưu and names the item", async () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Khớp (1)" }));
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByRole("button", { name: "Chưa đếm (1)" })).toHaveAttribute("aria-pressed", "true");
    expect(box("Bột cà phê truyền thống Phin Đậm")).toBeInTheDocument();
    expect(screen.getByText(/"Bột cà phê truyền thống Phin Đậm" chưa có số đếm/)).toBeInTheDocument();
    expect(editConfirmedStocktake).not.toHaveBeenCalled();
    await waitFor(() => expect(box("Bột cà phê truyền thống Phin Đậm")).toHaveFocus());
    await waitFor(() => expect(screen.getByText("Cần nhập số.")).toBeInTheDocument());
  });

  it("a counted line emptied and hidden by a search is shown again on Lưu", () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Tìm hàng"), { target: { value: "milkfoam" } });
    fireEvent.submit(container.querySelector("form")!);
    expect((screen.getByLabelText("Tìm hàng") as HTMLInputElement).value).toBe("");
    expect(box("Bột cà phê truyền thống Phin Đậm")).toBeInTheDocument();
    expect(editConfirmedStocktake).not.toHaveBeenCalled();
  });

  it("typing a number clears the message", () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Khớp (1)" }));
    fireEvent.submit(container.querySelector("form")!);
    expect(screen.getByText(/chưa có số đếm/)).toBeInTheDocument();
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "4000" } });
    expect(screen.queryByText(/chưa có số đếm/)).toBeNull();
  });

  it("the selected 'Chưa đếm' chip stays while its last row gets a number", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Chưa đếm (1)" }));
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "4000" } });
    expect(screen.getByRole("button", { name: "Chưa đếm (0)" })).toHaveAttribute("aria-pressed", "true");
  });

  it("'Chưa đếm (0)' goes away when another chip is picked", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Chưa đếm (1)" }));
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "4000" } });
    fireEvent.click(screen.getByRole("button", { name: "Tất cả (2)" }));
    expect(screen.queryByRole("button", { name: /^Chưa đếm/ })).toBeNull();
  });

  it("the form skips the browser's own check so every Lưu reaches the cleared line", () => {
    const { container } = render(<StocktakeEditForm detail={DETAIL} />);
    const form = container.querySelector("form")!;
    expect(form.noValidate).toBe(true);
  });

  it("pressing Lưu again on a visible emptied line still names it", () => {
    render(<StocktakeEditForm detail={DETAIL} />);
    fireEvent.change(box("Bột cà phê truyền thống Phin Đậm"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(screen.getByText(/"Bột cà phê truyền thống Phin Đậm" chưa có số đếm/)).toBeInTheDocument();
    expect(editConfirmedStocktake).not.toHaveBeenCalled();
  });
});

