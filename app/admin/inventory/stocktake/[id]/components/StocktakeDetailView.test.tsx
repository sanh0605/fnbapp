// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import React from "react";
import { StocktakeDetailView } from "./StocktakeDetailView";
import type { StocktakeDetailView as Detail } from "@/app/admin/inventory/stocktake/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/inventory/stocktake/STK-001",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => cleanup());

// Spec docs/superpowers/specs/2026-10-14-sua-phieu-kiem-ke-design.md, section 2 (real STK-001 lines).
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
    { id: "SKL-00099", itemReference: "SPM-099", itemName: "Đào ngâm Countree", unitName: "hộp", countedQty: 700, theoreticalAtCount: 200 },
  ],
};

const NOT_LATEST = "Đã có phiếu kiểm kê mới hơn nên phiếu này không sửa được.";
const OPEN_SESSION = "Đang có phiếu kiểm kê mở, xong phiếu đó rồi mới sửa được.";
const NOT_CONFIRMED = "Phiếu đã huỷ nên không sửa được.";

function desktop(container: HTMLElement) {
  return container.querySelector(".hidden.md\\:block") as HTMLElement;
}

describe("StocktakeDetailView (BR-INV-012)", () => {
  it("titles the page with the stocktake code", () => {
    render(<StocktakeDetailView detail={DETAIL} />);
    expect(screen.getByRole("heading", { level: 1, name: /STK-001/ })).toBeInTheDocument();
  });

  it("shows a desktop table with the columns in order", () => {
    const { container } = render(<StocktakeDetailView detail={DETAIL} />);
    const table = within(desktop(container)).getByRole("table");
    const headers = within(table).getAllByRole("columnheader").map(h => h.textContent?.trim());
    expect(headers).toEqual(["Hàng", "Đơn vị", "Sổ lúc đếm", "Đếm được", "Chênh lệch"]);
  });

  it("reads a short line as Thiếu, a found line as Dư, an even line with no variance text", () => {
    const { container } = render(<StocktakeDetailView detail={DETAIL} />);
    const rows = within(desktop(container)).getAllByRole("row");
    const rowOf = (name: string) => rows.find(r => r.textContent?.includes(name))!;
    const short = rowOf("Bột cà phê truyền thống Phin Đậm");
    expect(short).toHaveTextContent("6,000");
    expect(short).toHaveTextContent("4,000");
    expect(short).toHaveTextContent("Thiếu 2,000");
    expect(rowOf("Đào ngâm Countree")).toHaveTextContent("Dư 500");
    const even = rowOf("Bột milkfoam muối biển");
    expect(even).not.toHaveTextContent("Thiếu");
    expect(even).not.toHaveTextContent("Dư");
  });

  it("gives a phone one card per line", () => {
    const { container } = render(<StocktakeDetailView detail={DETAIL} />);
    const phone = container.querySelector(".md\\:hidden") as HTMLElement;
    expect(phone).not.toBeNull();
    // The server already sorts lines by name; the view keeps that order.
    const cards = [...phone.querySelectorAll("[data-line-id]")].map(c => c.getAttribute("data-line-id"));
    expect(cards).toEqual(["SKL-00004", "SKL-00007", "SKL-00099"]);
    expect(phone.querySelector('[data-line-id="SKL-00004"]')).toHaveTextContent("Thiếu 2,000");
  });

  it("offers Sửa to the edit page only when nothing blocks it", () => {
    render(<StocktakeDetailView detail={DETAIL} />);
    const link = screen.getByRole("link", { name: "Sửa" });
    expect(link.getAttribute("href")).toBe("/admin/inventory/stocktake/STK-001/edit");
    expect(screen.queryByText(NOT_LATEST)).toBeNull();
  });

  it.each([
    ["NOT_LATEST", NOT_LATEST],
    ["OPEN_SESSION", OPEN_SESSION],
    ["NOT_CONFIRMED", NOT_CONFIRMED],
  ] as const)("tells the owner why %s cannot be edited, with no Sửa", (block, text) => {
    render(<StocktakeDetailView detail={{ ...DETAIL, editBlock: block }} />);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
  });

  it("shows a manager neither Sửa nor a reason", () => {
    render(<StocktakeDetailView detail={{ ...DETAIL, editBlock: "NOT_OWNER" }} />);
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
    for (const text of [NOT_LATEST, OPEN_SESSION, NOT_CONFIRMED]) expect(screen.queryByText(text)).toBeNull();
  });
});
